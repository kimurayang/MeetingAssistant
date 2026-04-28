from pyannote.audio import Pipeline
import torch
import os

class DiarizationService:
    """極致穩定版：強制使用 CPU 以避免 Windows CUDA 衝突崩潰"""

    def __init__(self, use_auth_token: str = None):
        self.pipeline = None
        if not use_auth_token:
            print("Diarization: No HF Token provided, skipping.")
            return

        try:
            # 強制鎖定為 CPU 模式
            # 在 Windows + Python 3.13 環境下，GPU Diarization 極易觸發 0xC0000409 閃退
            device = torch.device("cpu")
            
            print(f"Diarization: Loading pipeline 'pyannote/speaker-diarization-3.1' on CPU (Stable Mode)...")
            
            self.pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                token=use_auth_token
            )
            
            if self.pipeline:
                self.pipeline.to(device)
                print(f"Diarization: [OK] Pipeline loaded on CPU.")
        except Exception as e:
            print(f"Diarization: [ERROR] Failed to load Pipeline: {e}")
            self.pipeline = None

    def __del__(self):
        """釋放資源"""
        if hasattr(self, 'pipeline'):
            try:
                del self.pipeline
                gc.collect()
            except Exception:
                pass

    def process(self, audio_path: str):
        if self.pipeline is None:
            return []

        if not os.path.exists(audio_path):
            print(f"Diarization: [ERROR] Audio file not found: {audio_path}")
            return []

        try:
            print(f"Diarization: Processing {audio_path} (Running on CPU)...")
            # 執行推理
            diarization = self.pipeline(audio_path)
            
            results = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                results.append({
                    "start": turn.start,
                    "end": turn.end,
                    "speaker": speaker
                })
            print(f"Diarization: [OK] Processed {len(results)} segments.")
            return results
        except Exception as e:
            print(f"Diarization: [ERROR] Processing Error: {e}")
            return []
