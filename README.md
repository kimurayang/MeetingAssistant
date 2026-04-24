# VoxNote (TRON-MeetingAI)
> 100% 離線運行的 AI 會議助手

VoxNote 是一個為商務與技術開發人員打造的離線 AI 工具，它能錄製、轉錄、並自動校對與摘要您的會議。所有運算皆在您的本地顯卡上完成，確保隱私安全。

## ✨ 核心功能
- **混合錄製**: 支援麥克風與系統音效同時擷取。
- **檔案匯入**: 支援本地影音或 YouTube/Bilibili URL (離線下載)。
- **專業級 STT**: 採用 Faster-Whisper，支援台灣專業術語優化。
- **雙引擎 AI 專家**:
  - **邏輯引擎 (DeepSeek)**: 精準提取事實與任務。
  - **潤飾引擎 (Llama-3-Taiwan)**: 生成專業台灣商務格式報告。
- **韌性處理條**: 即使在 100% GPU 佔載下也能看到穩定跳動的進度百分比。
- **工業級匯出**: 支援帶有專業浮水印的 PDF 逐字稿與摘要報告。

## 🛠️ 開發環境設定

### 1. Python Sidecar
```cmd
python -m venv venv
venv\Scripts\activate
pip install -r sidecar/requirements.txt
```

### 2. 前端介面
```cmd
npm install
npx prisma generate
```

### 3. 模型準備
請參考 `MODELS.md` 下載 `.gguf` 檔案並存入 `models/` 資料夾。

## 🚀 啟動與打包

### 開發模式
```cmd
npm run dev
```

### 打包 Sidecar 執行檔
```cmd
cd sidecar
python -m PyInstaller VoxNoteSidecar.spec --noconfirm
```

### 打包 Electron 安裝程式
```cmd
npm run dist
```

## 🛡️ 安全與隱私
- **無網路連接**: AI 核心與資料庫完全離線運作。
- **憑證加密**: HuggingFace Token 使用 `safeStorage` 進行系統級加密。
- **路徑防禦**: 強制執行 Path Traversal 檢查。
