import os
import sys
from sidecar.services.stt import STTService

def test():
    # 模擬環境注入
    print("DEBUG: Starting pipeline test...")
    audio_path = "1773888371714.wav" # 使用根目錄下的音檔
    if not os.path.exists(audio_path):
        print(f"ERROR: Audio file {audio_path} not found.")
        return

    try:
        # 預設使用 base 模型和 cuda (如果可用)
        device = "cuda"
        model_size = "base"
        
        print(f"DEBUG: Initializing STTService with {model_size} on {device}...")
        stt = STTService(model_size=model_size, device=device)
        
        print(f"DEBUG: Starting transcription of {audio_path}...")
        results = stt.transcribe(audio_path, language="zh")
        
        print(f"SUCCESS: Transcription completed. Got {len(results)} segments.")
        for res in results[:3]:
            print(f"  [{res['start']:.2f} - {res['end']:.2f}] {res['text']}")
            
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    # 確保能找到 sidecar 目錄中的 services
    sys.path.append(os.path.join(os.getcwd(), "sidecar"))
    test()
