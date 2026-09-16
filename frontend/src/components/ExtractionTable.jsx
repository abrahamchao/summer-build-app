"use client";

const METADATA_KEYS = new Set([
  "id",
  "file_name",
  "fileName",
  "created_at",
  "createdAt",
  "updated_at",
  "updatedAt",
]);

function parseExtractedData(value) {
  if (value == null || value === "") {
    return {};
  }

  if (Array.isArray(value)) {
    return { items: value };
  }

  if (typeof value === "object") {
    return value;
  }

  if (typeof value !== "string") {
    return { value: String(value) };
  }

  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;

  try {
    return parseExtractedData(JSON.parse(jsonText));
  } catch {
    return { summary: trimmed };
  }
}

function getExtractedFields(row) {
  if (row == null || typeof row !== "object") {
    return parseExtractedData(row);
  }

  if ("extracted_data" in row || "extractedData" in row) {
    return parseExtractedData(row.extracted_data ?? row.extractedData);
  }

  return parseExtractedData(
    Object.fromEntries(
      Object.entries(row).filter(([key]) => !METADATA_KEYS.has(key)),
    ),
  );
}

function formatLabel(key) {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function FieldValue({ value }) {
  if (value == null || value === "") {
    return <span className="text-zinc-400">—</span>;
  }

  if (typeof value === "boolean") {
    return <span>{value ? "Yes" : "No"}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-zinc-400">—</span>;
    }

    const primitives = value.every(
      (item) => item == null || typeof item !== "object",
    );

    if (primitives) {
      return (
        <ul className="list-disc space-y-1 pl-5">
          {value.map((item, index) => (
            <li key={index}>{item == null || item === "" ? "—" : String(item)}</li>
          ))}
        </ul>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
          >
            {item != null && typeof item === "object" ? (
              <FieldTable fields={item} />
            ) : (
              String(item)
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return <FieldTable fields={value} />;
  }

  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

function FieldTable({ fields }) {
  const entries = Object.entries(fields ?? {});

  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500">No extracted fields.</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <tbody>
        {entries.map(([key, value]) => (
          <tr
            key={key}
            className="border-t border-zinc-200 align-top first:border-t-0 dark:border-zinc-800"
          >
            <th className="w-[34%] py-2.5 pr-4 font-medium text-zinc-500 dark:text-zinc-400">
              {formatLabel(key)}
            </th>
            <td className="py-2.5 text-zinc-900 dark:text-zinc-100">
              <FieldValue value={value} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * @param {{ data?: Record<string, unknown>[] }} props
 */
export default function ExtractionTable({ data = [] }) {
  const rows = Array.isArray(data) ? data : [];

  if (rows.length === 0) {
    return (
      <section className="w-full rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-50">
          Extracted permit data
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          No extracted JSON fields yet. Upload a regulatory PDF to see results
          from Supabase here.
        </p>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Extracted permit data
      </h2>
      <div className="flex flex-col gap-4">
        {rows.map((row, index) => {
          const fields = getExtractedFields(row);
          const title =
            row?.file_name ||
            row?.fileName ||
            fields.facility_name ||
            fields.facilityName ||
            `Record ${index + 1}`;
          const createdAt = row?.created_at || row?.createdAt;

          return (
            <article
              key={row?.id ?? `${title}-${index}`}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
            >
              <header className="flex flex-col gap-1 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between dark:border-zinc-800">
                <h3 className="truncate text-base font-medium text-zinc-900 dark:text-zinc-50">
                  {title}
                </h3>
                {createdAt ? (
                  <time
                    className="text-xs text-zinc-500 dark:text-zinc-400"
                    dateTime={String(createdAt)}
                  >
                    {formatDate(createdAt)}
                  </time>
                ) : null}
              </header>
              <div className="overflow-x-auto px-5 py-2">
                <FieldTable fields={fields} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
