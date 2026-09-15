import streamlit as st
import pdfplumber
from anthropic import Anthropic
import os
from dotenv import load_dotenv
import tempfile

load_dotenv()

# Safely load API key from Streamlit secrets or local .env
api_key = st.secrets.get("ANTHROPIC_API_KEY") if "ANTHROPIC_API_KEY" in st.secrets else os.getenv("ANTHROPIC_API_KEY")
client = Anthropic(api_key=api_key)

st.title("Permit & Regulatory PDF Analyzer")

uploaded_file = st.file_uploader("Upload a regulatory PDF", type="pdf")

if uploaded_file is not None:
    with st.spinner("Extracting text and analyzing with Claude..."):
        # Save uploaded file to a temporary file path
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            tmp_file.write(uploaded_file.getvalue())
            tmp_path = tmp_file.name

        full_text = ""
        try:
            with pdfplumber.open(tmp_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        full_text += text + "\n"
        finally:
            # Clean up temp file when done
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        
        # Send extracted text to Anthropic API
        response = client.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"Analyze this regulatory text and provide a JSON summary:\n\n{full_text}"
            }]
        )
        
        text_output = next((block.text for block in response.content if block.type == "text"), "No text found.")
        st.subheader("Analysis Result")
        st.write(text_output)