import os
import sys
from sidecar.services.llm import LLMService

def test_llm():
    print("DEBUG: Starting LLM CUDA test...")
    # 這裡選擇一個模型 (我從檔案清單挑一個最小的來測試是否能初始化 GPU)
    model_path = "Qwen2.5-7B-Instruct-Q4_K_M.gguf"
    if not os.path.exists(model_path):
        print(f"WARN: Model {model_path} not found. Trying another...")
        model_path = "Meta-Llama-3-8B-Instruct-Q4_K_M.gguf"
    
    if not os.path.exists(model_path):
        print("ERROR: No suitable model found for test.")
        return

    try:
        print(f"DEBUG: Initializing LLMService with {model_path} on cuda...")
        llm = LLMService(model_path=model_path, device="cuda")
        print("SUCCESS: LLM initialized on GPU!")
        
        # 測試簡單生成
        print("DEBUG: Running simple generation test...")
        segments = [{"speaker": "A", "text": "你好，今天會議的主題是什麼？"}]
        result = llm.generate_summary(segments)
        print(f"SUCCESS: LLM Generated: {result}")
        
    except Exception as e:
        print(f"FAILED: LLM CUDA test failed: {e}")

if __name__ == "__main__":
    sys.path.append(os.path.join(os.getcwd(), "sidecar"))
    test_llm()
