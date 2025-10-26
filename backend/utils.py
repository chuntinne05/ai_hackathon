import os
import tempfile
from fastapi import UploadFile, HTTPException
from docx import Document

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Trích xuất text từ DOCX"""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.docx') as tmp_file:
            tmp_file.write(file_bytes)
            tmp_path = tmp_file.name
        
        doc = Document(tmp_path)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        
        os.unlink(tmp_path)
        
        return text.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi đọc DOCX: {str(e)}")

def extract_text_from_file(file: UploadFile, file_bytes: bytes) -> str:
    """Trích xuất text từ file dựa trên loại"""
    if file.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return extract_text_from_docx(file_bytes)
    elif file.content_type == "text/plain":
        return file_bytes.decode('utf-8')
    else:
        raise HTTPException(status_code=400, detail="Loại file không được hỗ trợ")