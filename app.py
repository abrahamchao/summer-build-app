import os
import streamlit as st
from supabase import create_client, Client
from anthropic import Anthropic
import pdfplumber
import tempfile
from dotenv import load_dotenv

load_dotenv()

# Safely get API key from environment or secrets without crashing
api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    try:
        api_key = st.secrets.get("ANTHROPIC_API_KEY")
    except Exception:
        pass

client = Anthropic(api_key=api_key)

# Safely initialize Supabase
@st.cache_resource
def init_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        try:
            url = url or st.secrets.get("SUPABASE_URL")
            key = key or st.secrets.get("SUPABASE_KEY")
        except Exception:
            pass
            
    return create_client(url, key)

supabase = init_supabase()

# Safely load API key from Streamlit secrets or local .env
api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    try:
        api_key = st.secrets.get("ANTHROPIC_API_KEY")
    except Exception:
        pass
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
            model="claude-sonnet-5",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": f"Analyze this regulatory text and provide a JSON summary:\n\n{full_text}"
            }]
        )
        
        text_output = next((block.text for block in response.content if block.type == "text"), "No text found.")
        st.subheader("Analysis Result")
        st.write(text_output)

        try:
            data = {
                "file_name": uploaded_file.name,
                "extracted_data": text_output
            }
            supabase.table("permit summaries").insert(data).execute()
            st.success("Saved to Supabase database successfully!")
        except Exception as e:
            st.error(f"Failed to save to database: {e}")