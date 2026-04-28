import os
from faster_whisper import WhisperModel

class STTService:
    """極致穩定的 Whisper 轉錄服務"""

    def __init__(self, model_size: str = "base", device: str = "cpu"):
        self.model_size = model_size
        self.device = device
        self.model = self._load_model(device)
        # 初始化 OpenCC 轉換器 (簡體轉繁體 - s2t)
        try:
            from opencc import OpenCC
            self.converter = OpenCC('s2t')
            print("STT: [OK] OpenCC Traditional Chinese converter initialized.")
        except ImportError:
            self.converter = None
            print("STT: [WARN] opencc-python-reimplemented is not installed. Skipping auto-conversion.")

    def _load_model(self, device):
        # 針對 Windows 環境下的 ctranslate2 進行最佳化：尋找並注入 NVIDIA DLL 路徑
        if device == "cuda":
            import os
            import sys
            import glob
            print("STT: Initializing CUDA environment...")
            
            found_any = False
            for path in sys.path:
                if 'site-packages' in path:
                    nvidia_path = os.path.join(path, 'nvidia')
                    if os.path.exists(nvidia_path):
                        for sub in ['cublas/bin', 'cudnn/bin', 'cuda_runtime/bin']:
                            full_path = os.path.join(nvidia_path, sub.split('/')[0], 'bin')
                            if os.path.exists(full_path):
                                if full_path not in os.environ["PATH"]:
                                    os.environ["PATH"] = full_path + os.pathsep + os.environ["PATH"]
                                    print(f"STT: [OK] Injected venv DLL path: {full_path}")
                                if hasattr(os, 'add_dll_directory'):
                                    try: os.add_dll_directory(full_path)
                                    except: pass
                                found_any = True
            
            if not found_any:
                print("STT: No NVIDIA wheels found in venv. Searching system CUDA toolkit...")
                cuda_root = r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA"
                if os.path.exists(cuda_root):
                    versions = glob.glob(os.path.join(cuda_root, "v*"))
                    if versions:
                        latest_v = sorted(versions)[-1]
                        bin_path = os.path.join(latest_v, "bin")
                        if os.path.exists(bin_path):
                            if bin_path not in os.environ["PATH"]:
                                os.environ["PATH"] = bin_path + os.pathsep + os.environ["PATH"]
                                print(f"STT: [OK] Injected System CUDA path: {bin_path}")
                            if hasattr(os, 'add_dll_directory'):
                                try: os.add_dll_directory(bin_path)
                                except: pass
                            found_any = True

        try:
            compute_type = "float16" if device == "cuda" else "int8"
            print(f"STT: Attempting to load model '{self.model_size}' on {device} ({compute_type})...")
            
            return WhisperModel(
                self.model_size, 
                device=device, 
                compute_type=compute_type,
                local_files_only=False,
                download_root=os.path.join(os.getcwd(), "models", "whisper")
            )
        except Exception as e:
            print(f"STT: Primary Load Error ({device}): {e}")
            if device == "cuda":
                print("STT: CRITICAL - GPU initialization failed. Falling back to CPU.")
                self.device = "cpu"
                return WhisperModel(self.model_size, device="cpu", compute_type="int8")
            raise e

    def transcribe(self, audio_path: str, language: str = "zh", initial_prompt: str = None):
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # 方案一：強化版「雙語語境」引導 (Prompt Engineering)
        prompts = {
            "zh": "這是一場專業的台灣科技公司會議，與會者習慣中英文夾雜溝通（Code-switching）。例如：『我們剛才在 Sprint 討論的 API 規格，關於 Deployment 的部分需要再 Refactor。』請精確保留這些英文專業術語，並使用繁體中文撰寫其餘內容。關鍵字：K8s, PRD, CI/CD, Roadmap, Bug fix, UI/UX。",
            "en": "This is a professional business meeting in English. Key terms include AI, UI, UX, Project Plan, and Teams. Let's discuss the progress.",
            "ja": "これは日本語のビジネス会議の記録です。AI、UI、UX、プロジェクト計画、Teamsなどの専門用語が含まれています。",
        }

        try:
            prompt = initial_prompt if initial_prompt else prompts.get(language, prompts["zh"])
            print(f"STT: [TRON Engine] Using Initial Prompt: {prompt[:100]}...")
            
            # 深度解碼參數優化
            segments_gen, info = self.model.transcribe(
                audio_path, 
                beam_size=2,
                best_of=2,
                language=language,
                initial_prompt=prompt,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=1000,
                    speech_pad_ms=500
                ),
                temperature=[0.0, 0.2, 0.4, 0.6], 
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
                no_speech_threshold=0.6,
                repetition_penalty=1.2,
                condition_on_previous_text=False
            )
            
            segments = list(segments_gen)
            print(f"STT: Initial transcription produced {len(segments)} segments")

            # 關鍵回退邏輯
            if len(segments) == 0:
                print("STT: [WARN] VAD filtered all segments. Retrying without VAD filter...")
                segments_gen, _ = self.model.transcribe(
                    audio_path,
                    beam_size=2,
                    language=language,
                    initial_prompt=prompt,
                    vad_filter=False,
                    temperature=[0.0, 0.2, 0.4],
                    condition_on_previous_text=True
                )
                segments = list(segments_gen)

            results = []
            current_seg = None
            
            for s in segments:
                text = s.text.strip()
                if not text: continue
                if self.converter:
                    text = self.converter.convert(text)
                
                if current_seg and (s.start - current_seg["end"] < 1.5):
                    current_seg["text"] += " " + text
                    current_seg["end"] = s.end
                else:
                    if current_seg:
                        results.append(current_seg)
                    current_seg = {"start": s.start, "end": s.end, "text": text}
            
            if current_seg:
                results.append(current_seg)
                
            return results
        except Exception as e:
            if self.device != "cpu":
                self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
                self.device = "cpu"
                return self.transcribe(audio_path, language, initial_prompt)
            raise e
