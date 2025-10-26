import uvicorn
from dotenv import load_dotenv

# Tải .env TRƯỚC khi import config
load_dotenv() 

# Import app đã được cấu hình từ config
from config import app 
# Import các routes từ routers
from routers import router 

# ============================================================================
# ROOT ENDPOINT (Để ở main cho đơn giản)
# ============================================================================
@app.get("/")
async def root():
    return {"message": "Insurance Workspace API", "status": "running"}

# ============================================================================
# INCLUDE ROUTERS
# ============================================================================
# Gắn tất cả các routes từ file routers.py vào app
# Thêm prefix="/api" để tất cả các route đều bắt đầu bằng /api/...
app.include_router(router, prefix="/api")

# ============================================================================
# MAIN
# ============================================================================
if __name__ == "__main__":
    print("Khởi chạy Insurance Workspace API tại http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)