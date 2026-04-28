import sys
try:
    from llama_cpp import Llama
    import torch

    print("="*50)
    print(f"Python Version: {sys.version}")
    print(f"Torch CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU Device: {torch.cuda.get_device_name(0)}")
    
    print("-"*50)
    print("Attempting to initialize Llama with GPU (n_gpu_layers=1)...")
    
    # 初始化一個極小的測試（即便沒模型路徑，只要能讀到函式庫就算成功）
    # 我們只測試能否建立物件並載入 CUDA 相關 DLL
    llm = Llama(model_path="", n_gpu_layers=1, verbose=True)
    
except Exception as e:
    # 預期會因為 model_path="" 報錯，但我們要看的是前面的日誌是否包含 "CUDA" 或 "cuBLAS"
    error_msg = str(e)
    if "ggml_cuda_init" in error_msg or "CUDA" in error_msg:
        print("\n[SUCCESS] CUDA library loaded successfully!")
    else:
        print(f"\n[INFO] Build result check: {error_msg}")

print("="*50)
