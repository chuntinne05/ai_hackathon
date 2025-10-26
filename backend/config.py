import os
import google.generativeai as genai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Tải biến môi trường
load_dotenv()

# ============================================================================
# APP & CORS CONFIGURATION
# ============================================================================
app = FastAPI(title="Insurance Workspace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# GEMINI AI CONFIGURATION
# ============================================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("Lỗi: Không tìm thấy GEMINI_API_KEY. Hãy chắc chắn file .env đã được cấu hình.")
    exit(1)

print(f"API_KEY: ...{GEMINI_API_KEY[-4:]}") # Che bớt key khi log
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')