import os
import streamlit as st
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

# Safely pull the API key from Streamlit secrets or local .env
api_key = st.secrets.get("ANTHROPIC_API_KEY") if "ANTHROPIC_API_KEY" in st.secrets else os.getenv("ANTHROPIC_API_KEY")

client = Anthropic(api_key=api_key)

st.title("Permit & Regulatory PDF Analyzer")

uploaded_file = st.file_uploader("Upload a regulatory PDF", type="pdf")

if uploaded_file is not None:
    with st.spinner("Extracting text and analyzing with Claude..."):
        full_text = ""
        with pdfplumber.open(uploaded_file) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
        
        response = client.messages.create(
            model="claude-3-5-sonnet-latest",  # Use a valid model name here
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"Analyze this regulatory text and provide a JSON summary:\n\n{full_text}"
            }]
        )
        
        text_output = next((block.text for block in response.content if block.type == "text"), "No text found.")
        st.subheader("Analysis Result")
        st.write(text_output)