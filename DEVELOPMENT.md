# VoxNote 開發與維護手冊 (Development & Maintenance)

本文件整合了任務清單、修改歷程以及底層技術修復日誌，是專案維護的唯一事實來源。

---

## 📋 任務清單 (TODO)
> 追蹤目前的開發進度與計畫

### 1. 環境與資料庫 (進行中)
- [x] 修正開發環境下的 `DATABASE_URL` 覆蓋邏輯 (2026-04-28)
- [x] 執行 `npx prisma db push` 同步開發資料庫結構 (2026-04-28)
- [x] 同步 PDF 匯出預設路徑與 Storage 路徑 (2026-04-28)
- [ ] 檢查是否需要設定 `HF_TOKEN` (提示使用者或尋找現有 Key)

### 2. 功能驗證與優化
- [x] 驗證 PDF 匯出是否成功 (PASS: 支援五段式專家報告)
- [ ] 調整報告文字密度（根據使用者反饋）
- [ ] 執行最終封裝測試 (Installer Build)

---

## 📜 修改歷程 (Changelog)
> 記錄重要功能更迭與 Bug 修復

### [2026-04-28] 系統穩定性與路徑解法
- **資料庫路徑鎖定**: 解決了 Electron 在開發環境下強行指回 AppData 導致的「資料表不存在」崩潰問題。
- **自動化測試引入**: 建立了 `src/main/__tests__`，針對資料庫初始化與匯出邏輯進行單元測試。
- **UI/UX 優化**: PDF 匯出現在會自動開啟設定中的 Storage 目錄，提升檔案管理效率。

### [2026-04-27] AI 語義理解與依賴鏈加固
- **結構化提取**: 重構 LLM 摘要引擎，支援「任務-負責人-截止日」三維結構。
- **8GB VRAM 優化**: 完成壓力驗證，解決了 CUDA 釋放死鎖與大數據 IPC 掛起問題。
- **診斷強化**: 引入 `worker.log` 導向機制，子進程日誌現在可完整追蹤。

---

## 📂 專案目錄結構 (Project Structure)

| 資料夾名稱 | 功能與目的 |
| :--- | :--- |
| **`src/`** | **前端與 Electron 原始碼核心**。包含所有 TypeScript/React 代碼。 |
| ├── `main/` | **Electron 主進程**。處理視窗管理、IPC 通訊、資料庫操作及 Sidecar 管理。 |
| ├── `preload/` | **預載腳本**。作為主進程與渲染進程之間的橋樑，安全地暴露 API。 |
| └── `renderer/` | **React 渲染進程**。使用者介面 (UI)、各項功能組件及樣式。 |
| **`sidecar/`** | **Python AI 後端核心**。一個基於 FastAPI 的獨立 AI 推理服務。 |
| ├── `services/` | AI 核心服務：STT (轉錄)、LLM (摘要)、Diarization (發言人識別)。 |
| └── `utils/` | 工具組：音訊強化、YouTube 下載、文字提取等。 |
| **`models/`** | **AI 模型倉庫**。存放 Whisper 權重與 LLM 的 `.gguf` 檔案。 |
| **`prisma/`** | **資料庫管理中心**。定義 Schema 與存放本地 SQLite 資料庫 (`dev.db`)。 |
| **`venv/`** | **Python 虛擬環境**。隔離 AI 運算所需的依賴套件。 |
| **`dist/`** | **打包產物**。存放最終生成的應用程式安裝包。 |

---

## 🛠️ 技術修復與攻堅日誌 (Maintenance Log)
> 記錄棘手的底層硬體與環境修復方案

### 1. GPU 加速 (RTX 4070) 與 CUDA 12.4
- **問題**: Windows 11 下路徑過長及編譯器不相容。
- **解決方案**:
  - 使用 `D:\vnb` 極短路徑作為 `TMP` 目錄，繞過 260 字元限制。
  - 使用 `-allow-unsupported-compiler` 旗標強制支援 Visual Studio 2026。
  - 強制 `n_gpu_layers=-1` 確保模型完全進入 VRAM。

### 2. 依賴衝突 (PyTorch vs Pyannote)
- **問題**: 版本要求不一致導致 CUDA 無法使用。
- **解決方案**: 將 `pyannote-audio` 降級至 `3.1.1`，達成與 `Torch 2.6.0+cu124` 的相容。

### 3. IPC 與子進程通訊
- **大數據傳輸**: 針對長會議，改用本地暫存 JSON 檔案傳輸，取代效能低下的 `multiprocessing.Manager` 序列化。
- **架構設計**: 使用 FastAPI 提供非同步 API，並透過 `multiprocessing` 隔離 AI 推理進程。這不僅解決了 Windows 下的 `spawn` 資源競爭問題，還能有效防止 AI 引擎因 OOM (顯存溢出) 崩潰時連帶導致 Electron 主進程掛掉。

### 4. 長會議處理策略 (Map-Reduce)
- **問題**: 長時間會議（超過 1 小時）會導致 LLM 的 Context Window 溢出或處理效能下降。
- **解決方案**: 
  - **Map 階段**: 將逐字稿以 3000-4000 字為單位進行語義切分，由邏輯引擎進行初步事實提取。
  - **Reduce 階段**: 將多段提取結果彙整，由潤飾引擎生成最終具備台灣商務語氣的結構化報告。

### 5. 驗證過的推薦模型版本 (Detailed)
- **邏輯引擎**: `DeepSeek-R1-Distill-Qwen-7B-Q6_K.gguf` (兼顧推理能力與顯存佔用)。
- **潤飾引擎**: `Llama-3.1-Taiwan-8B-Instruct-v2-Q5_K_M.gguf` (目前繁中語境表現最優)。
- **STT 引擎**: `faster-whisper-large-v3-turbo` (使用 `float16` 計算類型，VRAM 佔用約 2.5GB)。

### 6. 打包注意事項 (PyInstaller)
- **DLL 依賴**: 在 `.spec` 中需特別處理 `torch` 與 `cuda` 相關的 DLL，建議使用 `COLLECT` (One-Dir) 模式。
- **隱藏導入**: 需顯式加入 `uvicorn`, `fastapi`, `llama_cpp`, `ctranslate2` 等模組。
