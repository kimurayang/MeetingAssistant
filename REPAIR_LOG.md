# VoxNote GPU 攻堅維護日誌 - 2026-04-17

## 1. 核心突破：GPU 加速 (RTX 4070)
- **問題**：Windows 11 下 Python 3.13 與 CUDA 12.4 存在編譯路徑過長及編譯器不相容問題。
- **解決方案**：
  - 建立 `D:\vnb` 極短路徑作為 `TMP` 目錄，繞過 260 字元限制。
  - 使用 `-allow-unsupported-compiler` 旗標強制 Visual Studio 2026 與 CUDA 12.4 配合。
  - 設定 `n_gpu_layers=-1` 確保模型完全進入 VRAM。
- **成果**：STT 與 LLM 摘要均已成功運作於 GPU 上。

## 2. 依賴修正：PyTorch 衝突
- **問題**：`pyannote-audio` 最新版要求 Torch 2.8.0，但目前穩定版 CUDA 僅支援到 2.6.0。
- **解決方案**：將 `pyannote-audio` 降級至 `3.1.1` 版，達成與 Torch 2.6.0+cu124 的完美相容。

## 3. 功能修復：Sidecar 與匯出
- **Sidecar**：修復了 `sidecar/main.py` 的語法殘留錯誤，確保穩定啟動。
- **LLM 參數**：將 `llm_device` 正確映射為 `device`，解決摘要時沒用 GPU 的問題。
- **PDF 匯出**：重構 `ipcHandlers.ts` 以支援五段式專家報告樣式，待重啟開發環境驗證。

## 4. 待辦事項 (Next Steps)
- [ ] 執行 `npm run dev` 驗證 PDF 匯出是否成功。
- [ ] 調整報告文字密度（根據使用者反饋）。
- [ ] 最終封裝測試。
