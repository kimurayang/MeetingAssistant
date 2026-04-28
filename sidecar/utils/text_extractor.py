import os

def extract_text(file_path: str) -> str:
    """根據副檔名自動提取文字內容"""
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.txt':
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
            
    elif ext == '.pdf':
        try:
            import fitz  # PyMuPDF
            text = ""
            with fitz.open(file_path) as doc:
                for page in doc:
                    text += page.get_text()
            return text
        except ImportError:
            return "錯誤：未安裝 'pymupdf' 套件。請執行 'pip install pymupdf'。"
            
    elif ext in ['.docx', '.doc']:
        try:
            from docx import Document
            doc = Document(file_path)
            return "\n".join([para.text for font, para in enumerate(doc.paragraphs)])
        except ImportError:
            return "錯誤：未安裝 'python-docx' 套件。請執行 'pip install python-docx'。"
            
    return ""
