import os
import sys
from faster_whisper import WhisperModel

# 自動注入路徑 (這是我剛才加到 stt.py 的邏輯)
venv_path = os.path.join(os.getcwd(), 'venv', 'Lib', 'site-packages', 'nvidia')
if os.path.exists(venv_path):
    for sub in ['cublas/bin', 'cudnn/bin', 'cuda_runtime/bin']:
        full_path = os.path.join(venv_path, sub.split('/')[0], 'bin')
        if os.path.exists(full_path):
            os.environ["PATH"] = full_path + os.pathsep + os.environ["PATH"]
            print(f"DEBUG: Injected {full_path}")

try:
    print("Testing Faster-Whisper on CUDA (Small model)...")
    # 如果這裡沒報錯，就代表 CUDA 啟動成功了
    model = WhisperModel("tiny", device="cuda", compute_type="float16")
    print("SUCCESS: Faster-Whisper is now running on GPU!")
except Exception as e:
    print(f"FAILED: Faster-Whisper could not initialize GPU: {e}")
