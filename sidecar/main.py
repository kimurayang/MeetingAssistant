import sys
import os
import gc
import time
import uuid
import threading
import multiprocessing
import tempfile
import argparse
import traceback
import json
from typing import Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
import uvicorn

# 1. 核心環境變數
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_WAIT_POLICY"] = "PASSIVE"
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

# 2. 暴力路徑與 DLL 修補
try:
    _sidecar_dir = os.path.dirname(os.path.abspath(__file__))
    _base_dir = os.path.dirname(_sidecar_dir)
    _venv_site = os.path.join(_base_dir, "venv", "Lib", "site-packages")
    _venv_scripts = os.path.join(_base_dir, "venv", "Scripts")
    if os.path.exists(_venv_scripts) and _venv_scripts not in os.environ["PATH"]:
        os.environ["PATH"] = _venv_scripts + os.pathsep + os.environ["PATH"]
    if os.path.exists(_venv_site) and _venv_site not in sys.path:
        sys.path.insert(0, _venv_site)
    if hasattr(os, 'add_dll_directory'):
        for d in [_venv_scripts, os.path.join(_venv_site, "ctranslate2")]:
            if os.path.exists(d):
                try: os.add_dll_directory(d)
                except: pass
except Exception: pass

app = FastAPI()

if __name__ == "__main__":
    multiprocessing.freeze_support()
    manager = multiprocessing.Manager()
    shared_jobs = manager.dict()
else:
    shared_jobs = {}

class ProcessRequest(BaseModel):
    audio_path: str
    language: str = "zh"
    model_size: str = "base"
    device: str = "cpu"
    run_stt: bool = True
    run_diarization: bool = False
    hf_token: str = ""
    run_llm: bool = True
    llm_path: str = ""
    logic_model_path: str = ""
    polish_model_path: str = ""
    summary_mode: str = "auto"
    text_content: str = ""
    initial_prompt: str = ""

class ExtractRequest(BaseModel):
    file_path: str

def worker_process(job_id, request_dict, shared_dict):
    """【穩定加固版】防止 Windows GPU 緩衝區溢出"""
    # 🔴 [Fix] 強制初始化 CUDA 狀態，避免後續載入時崩潰
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.init()
            torch.cuda.empty_cache()
    except: pass

    log_file_path = os.path.join(tempfile.gettempdir(), f"voxnote_worker_{job_id}.log")
    
    with open(log_file_path, "a", encoding="utf-8", buffering=1) as log_f:
        original_stdout = sys.stdout
        original_stderr = sys.stderr
        sys.stdout = log_f
        sys.stderr = log_f

        print(f"\n--- [JOB {job_id}] Started at {time.ctime()} ---")
        
        try:
            from services.stt import STTService
            from services.llm import LLMService
            from utils.audio_processor import enhance_audio
            import torch

            # 0% → 啟動引擎（Init engine）
            shared_dict[job_id] = {"status": "processing", "progress": 0, "message": "啟動引擎 (Init engine)", "result": None}

            def check_cancel():
                # 檢查任務是否已被標記為取消
                job_info = shared_dict.get(job_id, {})
                if job_info.get("status") == "cancelling":
                    print(f"--- [JOB {job_id}] Cancelled by user ---")
                    return True
                return False

            # 預先初始化
            input_segments = []
            final_segments = []
            summary_result = {"highlights": []}
            audio_target = request_dict['audio_path']

            # 1. STT 階段
            if request_dict['run_stt'] and audio_target:
                if check_cancel(): return
                
                # 0. 降噪
                if not audio_target.startswith("http"):
                     shared_dict[job_id] = {"status": "processing", "progress": 5, "message": "正在清理音訊雜訊...", "result": None}
                     audio_target = enhance_audio(audio_target)
                
                if check_cancel(): return
                
                # 1.1 下載
                if audio_target.startswith(("http://", "https://")):
                    try:
                        shared_dict[job_id] = {"status": "processing", "progress": 8, "message": "正在下載影音檔案...", "result": None}
                        from utils.yt_downloader import download_media_audio
                        download_dir = os.path.join(tempfile.gettempdir(), "voxnote_downloads")
                        os.makedirs(download_dir, exist_ok=True)
                        audio_target = download_media_audio(audio_target, download_dir)
                    except Exception as dl_err:
                        shared_dict[job_id] = {"status": "failed", "progress": 0, "message": f"下載失敗: {str(dl_err)}", "result": None}
                        return

                if check_cancel(): return

                # 10% → 載入模型（Load model）
                shared_dict[job_id] = {"status": "processing", "progress": 10, "message": "載入語音辨識模型 (Load model)", "result": None}
                stt_engine = STTService(model_size=request_dict['model_size'], device=request_dict['device'])
                
                if check_cancel(): return
                
                # 25% → 語音轉文字（STT）
                shared_dict[job_id] = {"status": "processing", "progress": 25, "message": "語音轉錄中 (STT)", "result": None}
                input_segments = stt_engine.transcribe(
                    audio_target, language=request_dict['language'],
                    initial_prompt=request_dict.get('initial_prompt')
                )
                del stt_engine
                gc.collect()

            # 2. LLM 合併處理階段 (校對 + 摘要)
            if check_cancel(): return

            logic_p = request_dict.get('logic_model_path')
            polish_p = request_dict.get('polish_model_path')
            llm_p = request_dict.get('llm_path')
            
            if request_dict.get('run_llm') and (llm_p or (logic_p and polish_p)):
                initial_p = logic_p if logic_p else llm_p
                
                # 載入模型階段 (由於 LLMService 初始化會載入模型，我們在這裡標記)
                shared_dict[job_id] = {"status": "processing", "progress": 45, "message": "載入 AI 專家模型 (Load LLM)...", "result": None}
                llm_engine = LLMService(model_path=initial_p, device=request_dict.get('device', 'cpu'))

                # 決定分析來源
                source_data = input_segments
                if not source_data and request_dict['text_content']:
                    source_data = [{"speaker": "User", "text": t} for t in request_dict['text_content'].split('\n') if t.strip()]
                
                if source_data:
                    if check_cancel(): 
                        del llm_engine
                        return
                    
                    # 內部進度回報回調函數
                    def llm_progress_callback(stage: str):
                        if stage == "refine":
                            # 60% → 校對逐字稿（Refine）
                            shared_dict[job_id] = {"status": "processing", "progress": 60, "message": "AI 專家校對逐字稿 (Refine)", "result": None}
                        elif stage == "summarize":
                            # 80% → 產生摘要（Summarize）
                            shared_dict[job_id] = {"status": "processing", "progress": 80, "message": "AI 專家產生摘要報告 (Summarize)", "result": None}

                    # 【關鍵優化】：一次呼叫完成兩項任務，並傳入進度回調
                    corrected_results, summary_result = llm_engine.process_comprehensive(
                        source_data, 
                        mode=request_dict['summary_mode'],
                        collaborative_config={
                            "logic_model": logic_p,
                            "polish_model": polish_p
                        } if logic_p and polish_p else None,
                        progress_callback=llm_progress_callback
                    )
                    
                    shared_dict[job_id] = {"status": "processing", "progress": 92, "message": "AI 分析完成，準備寫入...", "result": None}

                    if check_cancel():
                        del llm_engine
                        return

                    # 如果校對結果有產出，則回填。否則保留原始。
                    if corrected_results:
                        final_segments = []
                        # 嘗試將校對後的文字回填至原始時間戳結構
                        for idx, orig in enumerate(source_data):
                            txt = corrected_results[idx]['text'] if idx < len(corrected_results) else orig['text']
                            final_segments.append({**orig, "text": txt})
                    else:
                        final_segments = source_data
                
                del llm_engine
                gc.collect()
            else:
                final_segments = input_segments if input_segments else []

            if check_cancel(): return

            # 95% → 寫入資料庫（Persist）
            shared_dict[job_id] = {"status": "processing", "progress": 95, "message": "正在將結果持久化至資料庫 (Persist)", "result": None}
            
            # 3. Save Final Result
            result_data = {"segments": final_segments, "summary": summary_result}
            result_path = os.path.join(tempfile.gettempdir(), f"voxnote_res_{job_id}.json")
            with open(result_path, "w", encoding="utf-8") as f:
                json.dump(result_data, f, ensure_ascii=False)
            
            # 100% → 完成
            shared_dict[job_id] = {"status": "completed", "progress": 100, "message": "完成 (Completed)", "result_file": result_path}
        except Exception as e:
            traceback.print_exc()
            shared_dict[job_id] = {"status": "failed", "progress": 0, "message": str(e), "result": None, "error": traceback.format_exc()}
        finally:
            # 如果是取消結束的，更新狀態為 stopped
            if shared_dict.get(job_id, {}).get("status") == "cancelling":
                 shared_dict[job_id] = {"status": "stopped", "progress": 0, "message": "任務已取消 (Cancelled)", "result": None}
            
            # 還原輸出並釋放顯存
            sys.stdout = original_stdout
            sys.stderr = original_stderr
            try:
                import torch
                if torch.cuda.is_available(): torch.cuda.empty_cache()
            except: pass
            gc.collect()

job_processes: Dict[str, multiprocessing.Process] = {}

@app.post("/process_meeting")
async def process_meeting(request: ProcessRequest):
    # 🔴 [Blocking]：資源併發保護 (8GB 顯存防禦)
    active_jobs = [jid for jid, info in shared_jobs.items() if info.get("status") in ["processing", "cancelling"]]
    if active_jobs:
        raise HTTPException(
            status_code=429, 
            detail="目前已有 AI 任務正在執行中。為避免顯存溢出，請等待目前任務完成。"
        )

    job_id = str(uuid.uuid4())
    shared_jobs[job_id] = {"status": "pending", "progress": 0, "message": "等待佇列 (Queued)", "result": None}
    p = multiprocessing.Process(target=worker_process, args=(job_id, request.model_dump(), shared_jobs))
    p.start()
    job_processes[job_id] = p
    return {"status": "processing", "job_id": job_id}

@app.post("/cancel_job/{job_id}")
async def cancel_job(job_id: str):
    if job_id in shared_jobs:
        info = shared_jobs[job_id]
        if info["status"] in ["processing", "pending"]:
            # 標記為正在取消中
            info["status"] = "cancelling"
            shared_jobs[job_id] = info
            return {"status": "cancelling", "message": "Cancellation request sent."}
    return {"status": "error", "message": "Job not found or not cancellable."}

@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    status_info = shared_jobs.get(job_id)
    if not status_info: return {"status": "not_found"}
    
    # 檢查進程是否還活著，若死掉但狀態仍是處理中，標記為失敗
    if status_info["status"] in ["processing", "cancelling"]:
        p = job_processes.get(job_id)
        if p and not p.is_alive():
            status_info["status"] = "failed"
            status_info["message"] = f"AI Process crashed (Exit Code: {p.exitcode})"
            shared_jobs[job_id] = status_info
            if job_id in job_processes: del job_processes[job_id]
            
    if status_info["status"] == "completed" and "result_file" in status_info:
        result_path = status_info["result_file"]
        if os.path.exists(result_path):
            with open(result_path, "r", encoding="utf-8") as f:
                status_info["result"] = json.load(f)
            try: os.remove(result_path)
            except: pass
            del status_info["result_file"]
            shared_jobs[job_id] = status_info
            if job_id in job_processes: del job_processes[job_id]
            
    return status_info

@app.post("/extract_text")
async def extract_text(request: ExtractRequest):
    try:
        from utils.text_extractor import extract_text as do_extract
        return {"content": do_extract(request.file_path)}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health(): return {"status": "healthy"}

if __name__ == "__main__":
    multiprocessing.freeze_support()
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    try: multiprocessing.set_start_method('spawn', force=True)
    except RuntimeError: pass
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info", use_colors=False, workers=1, access_log=False)
