# 離線 AI 模型下載指南

本應用程式依賴本地 AI 模型運行，請依照以下步驟下載所需檔案。

## 1. 語音轉文字 (Whisper)
- **下載方式**：應用程式首次運行時會自動下載。
- **儲存位置**：預設儲存於 HuggingFace cache (`~/.cache/huggingface/hub`).
- **設定**：可在「設定」頁面選擇模型大小 (Tiny, Base, Small, Medium, Large)。

## 2. 發言人辨識 (Pyannote)
- **必要條件**：需申請 HuggingFace Token。
- **步驟**：
  1. 前往 [HuggingFace pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
  2. 接受使用者協議。
  3. 在設定頁面輸入您的 Access Token。

## 3. 會議摘要 (本地 LLM)
- **必要條件**：需手動下載 GGUF 格式模型。
- **推薦模型**：
  - **Llama-3-Taiwan-8B-Instruct** (繁體中文優化)
    - 下載連結：[HuggingFace Link](https://huggingface.co/yentinglin/Llama-3-Taiwan-8B-Instruct-GGUF)
    - 建議版本：`Llama-3-Taiwan-8B-Instruct.Q4_K_M.gguf` (約 4-5GB)
  - **Llama-3-8B-Instruct** (原版)
    - 下載連結：[HuggingFace Link](https://huggingface.co/lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF)
- **設定步驟**：
  1. 下載 `.gguf` 檔案至您的電腦（建議放在 `models/` 資料夾）。
  2. 啟動應用程式，進入「設定」。
  3. 在「會議摘要 (LLM)」區塊點擊「選擇檔案」，選取該 `.gguf` 檔案。
  4. 點擊「儲存設定」。
