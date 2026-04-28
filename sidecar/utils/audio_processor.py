import os
import numpy as np
import soundfile as sf
import noisereduce as nr
import tempfile
import time

def enhance_audio(audio_path: str, output_path: str = None) -> str:
    """
    專業級 AI 降噪預處理 (TRON Audio Engine v1.0):
    1. 讀取原始音訊。
    2. 使用非定常頻譜降噪 (Stationary/Non-stationary Noise Reduction)。
    3. 輸出乾淨的 WAV 檔供 Whisper 使用。
    """
    if not os.path.exists(audio_path):
        return audio_path

    try:
        print(f"AudioEngine: Loading {audio_path} for enhancement...")
        start_time = time.time()
        
        # 讀取數據 (自動偵測採樣率)
        data, rate = sf.read(audio_path)
        
        # 降噪處理 (stationary=False 適合處理動態雜音，如咖啡廳環境)
        print("AudioEngine: Reducing noise (Spectral Subtraction)...")
        reduced_noise = nr.reduce_noise(y=data, sr=rate, prop_decrease=0.8)
        
        # 生成輸出路徑
        if output_path is None:
            output_path = os.path.join(tempfile.gettempdir(), f"enhanced_{os.path.basename(audio_path)}")
            
        # 儲存降噪後的檔案
        sf.write(output_path, reduced_noise, rate)
        
        duration = time.time() - start_time
        print(f"AudioEngine: [OK] Enhanced in {duration:.2f}s. Saved to: {output_path}")
        return output_path
    except Exception as e:
        print(f"AudioEngine: [ERROR] Enhancement failed: {e}")
        return audio_path # 失敗則回傳原始路徑，不中斷流水線
