# VoxNote (TRON-MeetingAI) 技術規格書 (System Design Document)

## 1. 系統架構 (System Architecture)
VoxNote 採用 **Sidecar 模式** 的混合架構，結合了前端介面與高效能離線 AI 引擎。

- **Frontend (Electron + React)**: 負責 UI 渲染、音訊錄製、資料庫管理 (Prisma/SQLite) 與 PDF 匯出。
- **Sidecar Engine (FastAPI/Python)**: 負責語音轉文字 (STT) 與 大型語言模型 (LLM) 邏輯。
- **Database**: 本地 SQLite，儲存於使用者 AppData 目錄。

## 2. 核心通訊機制 (Communication)
### 2.1 IPC 通道
- `process-meeting`: 啟動分析任務的主通道。
- `processing-progress`: 進度廣播通道（主進程 -> 渲染進程）。
- `cancel-processing`: 優雅終止任務。
- `force-reset-engine`: 強制終止 Sidecar 進程樹並重啟。

### 2.2 進度回報演算法 (Resilient Progress)
為了避免 AI 運算期間的顯示停滯，採用**混合同步機制**：
- **階段式回報**: STT (25%), LLM Refine (60%), Summarize (80%), Persist (95%)。
- **自主推進**: 若 Sidecar 忙碌，主進程每 3 秒自動推進 1%，封頂於 95%。

## 3. 資料庫保護機制 (Commit Shield)
- **事務保護**: 所有寫入操作封裝於 `$transaction` 中。
- **比例檢查**: 若新產出的逐字稿段落數減少超過 30%，系統會攔截寫入，防止資料毀損。
- **動態路徑**: 生產環境下 DATABASE_URL 動態指向 `%APPDATA%/VoxNote/database/`。

## 4. 離線模型配置 (Offline AI Models)
- **STT**: Faster-Whisper (支援 Tiny 到 Large-v3)。
- **LLM (Logic)**: DeepSeek-R1-7B (GGUF)。
- **LLM (Polish)**: Llama-3-Taiwan-8B (GGUF)，針對台灣商務語境優化。

## 5. 打包策略 (Packaging)
- **Python**: PyInstaller One-Dir 模式，包含 CUDA DLL 與隱藏匯入。
- **Electron**: Electron-Builder，將 Sidecar 執行檔放入 `extraResources`。
