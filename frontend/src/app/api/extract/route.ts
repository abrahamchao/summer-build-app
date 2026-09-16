import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PERMIT_TABLE = "permit summaries";
const MAX_TEXT_CHARS = 120_000;

function loadRootEnv() {
  const envPath = resolve(process.cwd(), "..", ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function getUploadedFiles(formData: FormData) {
  const values = [...formData.getAll("files"), ...formData.getAll("file")];
  return values.filter(
    (value): value is File => value instanceof File && value.size > 0,
  );
}

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function parseJsonFromModel(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // Fall through to raw summary.
      }
    }
    return { summary: trimmed };
  }
}

async function extractPdfText(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

async function analyzeWithAnthropic(
  anthropic: Anthropic,
  file: File,
  bytes: Uint8Array,
  text: string,
) {
  const model = env("ANTHROPIC_MODEL") || "claude-sonnet-5";
  const instruction =
    "Analyze this regulatory PDF and provide a JSON summary. Extract structured fields such as facility name, permit number, key obligations, and other important compliance details. Return valid JSON only.";

  const content: Anthropic.ContentBlockParam[] = text
    ? [
        {
          type: "text",
          text: `${instruction}\n\nFile name: ${file.name}\n\n${text.slice(0, MAX_TEXT_CHARS)}`,
        },
      ]
    : [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: Buffer.from(bytes).toString("base64"),
          },
        },
        {
          type: "text",
          text: `${instruction}\n\nFile name: ${file.name}`,
        },
      ];

  const message = await anthropic.messages.create({
    model,
    max_tokens: 4000,
    messages: [{ role: "user", content }],
  });

  const output = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!output) {
    throw new Error("Anthropic returned no extracted text.");
  }

  return parseJsonFromModel(output);
}

async function extractOnePdf(
  file: File,
  anthropic: Anthropic,
  supabase: ReturnType<typeof createClient>,
) {
  if (!isPdfFile(file)) {
    throw new Error(`${file.name} is not a PDF.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = await extractPdfText(bytes);
  const extractedData = await analyzeWithAnthropic(
    anthropic,
    file,
    bytes,
    text,
  );

  const { error } = await supabase.from(PERMIT_TABLE).insert({
    file_name: file.name,
    extracted_data: extractedData,
  });

  if (error) {
    throw new Error(`Failed to save to Supabase: ${error.message}`);
  }

  return {
    file_name: file.name,
    extracted_data: extractedData,
    saved: true,
  };
}

export async function POST(request: Request) {
  try {
    loadRootEnv();

    const supabaseUrl = env("SUPABASE_URL");
    const supabaseKey = env("SUPABASE_KEY");
    const anthropicKey = env("ANTHROPIC_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return jsonError("Missing SUPABASE_URL or SUPABASE_KEY.", 500);
    }
    if (!anthropicKey) {
      return jsonError("Missing ANTHROPIC_API_KEY.", 500);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError(
        "Upload a PDF as multipart form data using the files field.",
        400,
      );
    }
    const files = getUploadedFiles(formData);

    if (files.length === 0) {
      return jsonError("Upload at least one PDF file.", 400);
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const supabase = createClient(supabaseUrl, supabaseKey);
    const results = [];

    for (const file of files) {
      results.push(await extractOnePdf(file, anthropic, supabase));
    }

    return Response.json({
      extracted_data: results[0]?.extracted_data ?? null,
      file_name: results[0]?.file_name ?? null,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to extract PDF.";
    return jsonError(message, 500);
  }
}
