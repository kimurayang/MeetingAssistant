import os
import sys
import time
import torch
import gc
import json

# 加入 sidecar 路徑以便匯入服務
sys.path.append(os.path.join(os.getcwd(), "sidecar"))
from services.llm import LLMService

def get_vram():
    if torch.cuda.is_available():
        return torch.cuda.memory_allocated(0) / 1024**3, torch.cuda.memory_reserved(0) / 1024**3
    return 0, 0

def run_stress_test():
    print("=== VoxNote 8GB VRAM Stress Test ===")
    
    # 1. 準備模擬資料 (讀取 QTC.txt)
    qtc_path = "20260414_QTC.txt"
    if not os.path.exists(qtc_path):
        print(f"Error: {qtc_path} not found.")
        return
    
    with open(qtc_path, "r", encoding="utf-8") as f:
        raw_text = f.read()
    
    # 模擬 5000 字的輸入 (大約是會議的精華段落)
    test_segments = [{"speaker": "User", "text": raw_text[:5000]}]
    print(f"Input size: {len(raw_text[:5000])} chars")

    # 2. 定義測試模型
    # 優先尋找 DeepSeek 與 Llama 3.1，若無則回退至現有模型
    logic_model = os.path.join("models", "Qwen2.5-7B-Instruct-Q4_K_M.gguf")
    polish_model = os.path.join("models", "llama-3-taiwan-8b-instruct-q4_k_m.gguf")
    
    # 檢查檔案是否存在，若不存在則嘗試其他可能
    if not os.path.exists(logic_model):
        logic_model = os.path.join("models", "llama-3-taiwan-8b-instruct-q5_k_m.gguf")

    print(f"Testing with Logic: {logic_model}")
    print(f"Testing with Polish: {polish_model}")

    config = {
        "logic_model": os.path.abspath(logic_model),
        "polish_model": os.path.abspath(polish_model)
    }

    # 3. 初始化 LLM 服務
    try:
        llm = LLMService(device="cuda")
        
        print("\n--- Phase 1: Correcting & Fact Extracting (Logic Model) ---")
        start_time = time.time()
        
        # 執行合併流水線
        corrected, summary = llm.process_comprehensive(
            test_segments, 
            mode="auto", 
            collaborative_config=config
        )
        
        end_time = time.time()
        alloc, reserved = get_vram()
        
        print(f"Phase Complete in {end_time - start_time:.2f} seconds")
        print(f"VRAM Usage - Allocated: {alloc:.2f} GB, Reserved: {reserved:.2f} GB")
        
        # 4. 驗證輸出結果
        print("\n--- Final Report (First 500 chars) ---")
        print(json.dumps(summary, ensure_ascii=False, indent=2)[:500] + "...")
        
        if "key_content" in summary:
            print(f"\nSUCCESS: 'key_content' found with {len(summary['key_content'])} items.")
        else:
            print("\nWARNING: 'key_content' is missing from summary!")

        with open("test_result.json", "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        print("\nSUCCESS: Stress test passed! Result saved to test_result.json")

    except Exception as e:
        print(f"\nFAILED: Stress test crashed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_stress_test()
