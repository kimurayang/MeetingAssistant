# VoxNote 任務清單 (2026-04-24)

## 1. 環境配置修正
- [x] 更新 `.env` 中的 `DATABASE_URL` 為 `file:D:/Python/VoxNote/prisma/dev.db`
- [ ] 檢查是否需要設定 `HF_TOKEN` (提示使用者或尋找現有 Key)

## 2. 資料庫與依賴驗證
- [x] 執行 `npx prisma generate` 確保 Client 最新
- [x] 驗證資料庫結構是否與代碼一致 (dev.db 已確認)
- [ ] 執行 `python -m pip install -r sidecar/requirements.txt` (僅提示使用者或檢查)

## 3. 模型與推理驗證
- [x] 執行 `python diagnose_llm.py` 驗證 Llama 3 載入 (PASS: Qwen 2.5 7B & Llama 3 Taiwan 8B)
- [x] 執行 `python diagnose_stt.py` 驗證 Whisper 加速是否正常 (PASS: large-v3 @ CUDA)

## 4. 最終冒煙測試
- [x] 啟動 Electron App (`npm run dev`) 進行全流程測試 (PASS)
- [x] 確認摘要報告產出與 Action Items 自動提取 (PASS: 成功提取並結構化)
