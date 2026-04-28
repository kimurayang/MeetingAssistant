# VoxNote (TRON-MeetingAI)
> **100% 離線運行的 AI 專業會議助手**

VoxNote 是一個為商務與技術開發人員打造的離線 AI 工具，它能錄製、轉錄、並自動校對與摘要您的會議。所有運算皆在您的本地顯卡上完成，確保隱私安全。

---

## 🛠️ 系統環境要求 (重要)
在使用前，請確保您的開發環境符合以下規格，以獲得最佳性能：
- **作業系統**: Windows 11 (64-bit)
- **顯示卡**: NVIDIA GPU (建議 8GB+ VRAM，如 RTX 30/40 系列)
- **驅動程式**: **CUDA 12.4** (必需)
- **編譯工具**: Visual Studio 2026 (或 Build Tools) + C++ 開發組件
- **開發路徑**: 建議將專案放在非中文、無空格的路徑 (如 `D:\Python\VoxNote`)

---

## 🚀 極速啟動五步驟

### 1. 建立 Python 環境
```cmd
python -m venv venv
venv\Scripts\activate
pip install -r sidecar/requirements.txt
```

### 2. 初始化前端與資料庫
```cmd
npm install
# [關鍵] 同步資料庫結構
npx prisma db push
```

### 3. 下載 AI 模型 (核心步驟)
請下載以下模型並依照建議路徑存放，詳見下方 [AI 模型下載與配置](#-ai-模型下載與配置) 區塊。

### 4. 設定環境變數
複製 `.env.example` 為 `.env` 並填入您的設定。

### 5. 啟動應用程式
```cmd
npm run dev
```

---

## 🛠️ 開發者工具箱 (Developer Toolbox)
專案根目錄提供了一系列自動化腳本，用於解決 Windows 環境下的硬體相容性與編譯難題：

| 腳本名稱 | 執行時機 | 核心功能 |
| :--- | :--- | :--- |
| **`REPAIR_GPU.bat`** | GPU 報錯、顯存未釋放時 | 一鍵清理殘留進程、重設 CUDA 環境變數並驗證顯存狀態。 |
| **`DEVELOPER_SHORT_PATH_BUILD.bat`** | 打包時噴出「路徑過長」錯誤時 | 自動建立 `D:\vnb` 短路徑作為臨時編譯目錄，繞過 Windows 260 字元限制。 |
| **`DEVELOPER_GPU_BUILD.bat`** | 需要重新封裝 Sidecar 引擎時 | 自動配置 `-allow-unsupported-compiler` 旗標，強制 CUDA 12.4 與 VS 2026 協作。 |
| **`DEVELOPER_ULTIMATE_BUILD.bat`** | 準備發布正式安裝版本時 | **全自動流程**：Prisma 生成 -> Sidecar GPU 打包 -> Electron 封裝。 |

---

## 🧠 AI 模型下載與配置

### 1. 語音轉文字 (STT) - Faster Whisper
推薦使用 `large-v3-turbo`，平衡了速度與精確度。
- **下載連結**: [HuggingFace - Systran/faster-whisper-large-v3-turbo](https://huggingface.co/Systran/faster-whisper-large-v3-turbo)
- **存放路徑**: `models/whisper/`

### 2. 會議分析與潤飾 (LLM) - GGUF 格式
我們採用 **「雙引擎聯動」** 策略，建議下載以下兩個模型：
- **邏輯引擎 (事實提取)**: [Qwen2.5-7B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF) (建議 `Q4_K_M` 版本)。
- **潤飾引擎 (繁中商務)**: [Llama-3-Taiwan-8B-Instruct-v1-GGUF](https://huggingface.co/yentinglin/Llama-3-Taiwan-8B-Instruct-GGUF) (建議 `Q4_K_M` 版本)。

### 3. 發言人辨識 (Speaker Diarization)
- **授權申請**: 前往 [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1) 接受協議。
- **Token 配置**: 在應用程式「設定」頁面填入您的 HuggingFace Access Token。

---

## 🏆 驗證過最佳性能組合 (Golden Setup)
針對 **RTX 4070 (8GB VRAM)** 環境，我們建議以下配置以達成 100% GPU 加速且不崩潰：

| 組件 | 推薦模型/版本 | 設定參數 | 預期效能 |
| :--- | :--- | :--- | :--- |
| **STT (轉錄)** | `large-v3-turbo` | `device="cuda"`, `compute_type="float16"` | 1小時會議約 2-3 分鐘完成 |
| **邏輯引擎** | `Qwen-2.5-7B` | `n_gpu_layers=-1` (完全載入 VRAM) | 事實提取極快，不失真 |
| **潤飾引擎** | `Llama-3-Taiwan-8B`| `n_gpu_layers=-1` (完全載入 VRAM) | 完美繁體中文商務語氣 |
| **發言人識別**| `pyannote-3.1` | `HF_TOKEN` (必需) | 準確率 > 95% |

---

## 🛡️ 安全與穩性加固
- **短路徑編譯**: 使用 `D:\vnb` 作為 `TMP` 目錄，繞過 Windows 260 字元路徑限制。
- **依賴加固**: 使用 `pyannote-audio==3.1.1` 配合 `Torch 2.6.0+cu124` 確保 CUDA 穩定性。
- **進程監控**: Sidecar 自動偵測 OOM (顯存溢出) 並嘗試優雅重啟，不影響 Electron 主進程。

---

## 🛡️ 隱私承諾
- **無網路連接**: AI 核心與資料庫完全離線運作。
- **憑證加密**: HuggingFace Token 使用 `safeStorage` 進行系統級加密。
- **資料儲存**: 所有會議記錄儲存於您自定義的 `Storage Path`，預設為 `AppData`。
