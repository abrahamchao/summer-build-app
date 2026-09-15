import streamlit as st
import pdfplumber
from anthropic import Anthropic
import os
from dotenv import load_dotenv

load_dotenv()
client = Anthropic()

st.title("Permit & Regulatory PDF Analyzer")

uploaded_file = st.file_uploader("Upload a regulatory PDF", type="pdf")

if uploaded_file is not None:
    with st.spinner("Extracting text and analyzing with Claude..."):
        # 1. Extract text from the uploaded file object
        full_text = ""
        with pdfplumber.open(uploaded_file) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
        
        # 2. Send the extracted text to the Anthropic API
        # (Replace this with your actual prompt and model call from stage2.py)
        response = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"Analyze this regulatory text and provide a JSON summary:\n\n{full_text}"
            }]
        )
        
        # 3. Display the result in the UI
        st.subheader("Analysis Result")
        text_output = next((block.text for block in response.content if block.type == "text"), "No text found.")
st.write(text_output)