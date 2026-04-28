import os
import json
import pathlib

def check_readiness():
    print("=== VoxNote AI 整備度檢查工具 ===")
    
    # 1. 檢查目錄結構
    models_dir = pathlib.Path("models")
    if not models_dir.exists():
        os.makedirs(models_dir)
        print("[-] 已建立 models/ 資料夾")
    
    # 2. 檢查 LLM 模型 (GGUF)
    gguf_files = list(models_dir.glob("*.gguf"))
    if gguf_files:
        print(f"[✅] 找到 {len(gguf_files)} 個 LLM 模型檔案:")
        for f in gguf_files:
            size_gb = f.stat().st_size / (1024**3)
            print(f"    - {f.name} ({size_gb:.2f} GB)")
    else:
        print("[❌] 找不到 LLM 模型 (*.gguf)。")
        print("    請至 MODELS.md 提供的連結下載，並放入 models/ 資料夾。")

    # 3. 檢查設定檔 (config.json)
    # Windows 預設路徑: %APPDATA%/VoxNote/config.json
    appdata = os.getenv('APPDATA')
    config_path = pathlib.Path(appdata) / "VoxNote" / "config.json"
    
    if config_path.exists():
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            hf_token = config.get("hfToken", "")
            if hf_token:
                print("[✅] 已設定 HuggingFace Token (已加密或已填寫)")
            else:
                print("[⚠️] 尚未設定 HuggingFace Token (將無法使用發言人辨識)")
            
            llm_path = config.get("logicModelPath", "") or config.get("llmPath", "")
            if llm_path and os.path.exists(llm_path):
                print(f"[✅] 已正確連結模型路徑: {llm_path}")
            else:
                print("[⚠️] App 設定中尚未選取模型檔案。")
                
        except Exception as e:
            print(f"[!] 讀取設定檔失敗: {e}")
    else:
        print("[⚠️] 找不到設定檔 (config.json)，請先啟動一次 App 並進入設定儲存。")

    print("\n=== 檢查結束 ===")

if __name__ == "__main__":
    check_readiness()
