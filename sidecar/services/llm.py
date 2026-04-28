from llama_cpp import Llama
import os
import json
import re
import gc

class LLMService:
    """極致穩定、高速且具備五段式商務架構的 AI 服務 (v5.2)"""

    def __init__(self, model_path: str = None, device: str = "cpu"):
        self.llm = None
        self.model_path = model_path
        self.device = device
        self.model_type = "llama"
        if model_path:
            self._load_model(model_path)

    def _load_model(self, model_path: str):
        if not model_path or not os.path.exists(model_path):
            return

        if self.llm:
            print("LLM: Releasing VRAM...")
            del self.llm
            self.llm = None
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.ipc_collect()
            except:
                pass
            gc.collect()

        if self.device == "cuda":
            import sys
            if not hasattr(self, "_dll_added"):
                self._dll_added = set()

            for path in sys.path:
                if "site-packages" in path:
                    nvidia_path = os.path.join(path, "nvidia")
                    if os.path.exists(nvidia_path):
                        for sub in ["cublas/bin", "cudnn/bin", "cuda_runtime/bin"]:
                            full_path = os.path.join(nvidia_path, sub.split("/")[0], "bin")
                            if os.path.exists(full_path) and full_path not in self._dll_added:
                                if full_path not in os.environ.get("PATH", ""):
                                    os.environ["PATH"] = full_path + os.pathsep + os.environ.get("PATH", "")
                                if hasattr(os, "add_dll_directory"):
                                    try:
                                        os.add_dll_directory(full_path)
                                        self._dll_added.add(full_path)
                                    except:
                                        pass

        filename = os.path.basename(model_path).lower()
        self.model_type = "qwen" if "qwen" in filename else "llama"

        try:
            import multiprocessing
            cpu_threads = max(1, multiprocessing.cpu_count() - 2)

            gpu_layers = -1 if self.device.lower() in ["cuda", "mps"] else 0
            print(f"LLM: Attempting to load {filename} with n_gpu_layers={gpu_layers} on {self.device}")

            self.llm = Llama(
                model_path=model_path,
                n_ctx=8192,
                n_threads=cpu_threads,
                n_batch=512,
                n_gpu_layers=gpu_layers,
                verbose=True,
                chat_format="chatml" if self.model_type == "qwen" else "llama-3"
            )
            print(f"LLM: [OK] {self.model_type} loaded. n_gpu_layers={gpu_layers}")
        except Exception as e:
            print(f"LLM GPU Load Error: {e}. Falling back to minimal CPU config.")
            self.llm = Llama(model_path=model_path, n_ctx=2048, n_gpu_layers=0)

    # ---------- Transcript correction (1:1, no loss) ----------

    def _batch_correct_texts(self, items):
        """
        items: [{"i": int, "speaker": str, "text": str}, ...]
        returns: [{"i": int, "text": str}, ...]  (same length, same indices)
        """
        if not items:
            return []

        instruction = """你是資深逐字稿校對員。請只做「文字校正」，不可改變段落數量與順序。
規則：
- 只修正錯字、繁體用字、技術名詞（CUDA/VRAM/API/CLI/NPM/PIP 等），移除明顯口頭贅字可，但不得刪除關鍵資訊。
- 不得合併/拆分句子；不得新增不存在的內容。
- 必須輸出與輸入等長的 JSON，並保留每筆的 i。
- 若某筆內容無需修改，原樣輸出。
輸出 JSON 格式：
{ "items": [ { "i": 0, "text": "..." }, ... ] }
"""

        schema = {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "i": {"type": "integer"},
                            "text": {"type": "string"}
                        },
                        "required": ["i", "text"]
                    }
                }
            },
            "required": ["items"]
        }

        try:
            res = self.llm.create_chat_completion(
                messages=[
                    {"role": "system", "content": instruction},
                    {"role": "user", "content": json.dumps({"items": items}, ensure_ascii=False)}
                ],
                response_format={"type": "json_object", "schema": schema},
                temperature=0.1,
                max_tokens=4000
            )
            raw = res["choices"][0]["message"]["content"]
            raw = re.sub(r"<thought>.*?</thought>", "", raw, flags=re.S | re.I).strip()
            obj = json.loads(raw)

            out = obj.get("items", [])
            # 簡單校驗：若長度不符，直接 fallback
            if len(out) != len(items):
                return [{"i": it["i"], "text": it["text"]} for it in items]

            # 依 i 建 map，保證回傳順序與完整
            m = {x.get("i"): x.get("text", "") for x in out}
            fixed = []
            for it in items:
                t = m.get(it["i"], it["text"])
                if not isinstance(t, str) or not t.strip():
                    t = it["text"]
                fixed.append({"i": it["i"], "text": t})
            return fixed
        except Exception:
            return [{"i": it["i"], "text": it["text"]} for it in items]

    def correct_transcript(self, segments: list):
        """
        segments: [{"speaker": "...", "start": 0.0, "end": 1.0, "text": "..."}, ...]
        returns corrected_results: [{"text": "..."}, ...]  (same length)
        """
        if not segments:
            return []

        # 批次大小：避免 token 爆掉，同時維持效能
        BATCH = 80
        corrected = [None] * len(segments)

        for base in range(0, len(segments), BATCH):
            batch = segments[base:base + BATCH]
            items = []
            for j, seg in enumerate(batch):
                i = base + j
                speaker = seg.get("speaker", "SPEAKER_00")
                text = (seg.get("text") or "").strip()
                items.append({"i": i, "speaker": speaker, "text": text})

            out = self._batch_correct_texts(items)
            for row in out:
                i = row["i"]
                corrected[i] = {"text": row.get("text", "")}

        # 最終保底：任何 None 都回原文
        for i, seg in enumerate(segments):
            if not corrected[i] or not isinstance(corrected[i].get("text"), str) or not corrected[i]["text"].strip():
                corrected[i] = {"text": seg.get("text", "")}

        return corrected

    # ---------- Summary generation ----------

    def process_comprehensive(self, segments: list, mode: str = "auto", collaborative_config: dict = None, progress_callback=None):
        if not segments:
            return [], {"highlights": []}

        # 1) 載入邏輯模型
        if collaborative_config and collaborative_config.get('logic_model'):
            self._load_model(collaborative_config['logic_model'])

        # 2) 逐字稿校對（1:1）
        if progress_callback: progress_callback("refine")
        corrected_segments = self.correct_transcript(segments)

        # 3) 產生摘要
        if progress_callback: progress_callback("summarize")
        full_text = ""
        for seg in segments:
            sp = seg.get("speaker", "SPEAKER_00")
            st = seg.get("start", 0)
            et = seg.get("end", 0)
            tx = seg.get("text", "")
            full_text += f"[{sp} {st:.1f}-{et:.1f}]: {tx}\n"

        raw_facts = []
        logic_key_points = []
        CHUNK_SIZE = 4000
        start = 0
        while start < len(full_text):
            end = min(len(full_text), start + CHUNK_SIZE)
            chunk = full_text[start:end]

            instruction = """您是資深技術紀錄官。請對內容執行以下任務：
1. 提取事實：【核心要求】保留高資訊密度，盡量保留技術參數、數值、工具名稱、決議、爭議點。
2. 提煉重點：【新增】請以敘述句總結本段中最具技術價值的 2-3 個核心重點。
3. 列出「候選決策」與「候選待辦」。

【語言要求與限制】：
- ⚠️ 絕對禁止使用英文撰寫摘要與描述。
- ⚠️ 必須完全使用「繁體中文」(Traditional Chinese) 進行產出。
- 除了「專有名詞」(如 CUDA, API, Python) 之外，所有敘述文字必須是中文。
- 若違反此規則，報告將被視為無效。

輸出格式：
[FACTS]
...
[KEY_POINTS]
...
[CANDIDATE_DECISIONS]
...
[CANDIDATE_ACTIONS]
...
"""
            try:
                res = self.llm.create_chat_completion(
                    messages=[{"role": "system", "content": instruction}, {"role": "user", "content": chunk}],
                    temperature=0.1,
                    max_tokens=2500
                )
                content = res["choices"][0]["message"]["content"]
                raw_facts.append(content)
                
                # 從邏輯模型產出中提取 [KEY_POINTS] 區塊
                kp_match = re.search(r"\[KEY_POINTS\](.*?)(?=\[|$)", content, re.S | re.I)
                if kp_match:
                    points = [p.strip("- ").strip() for p in kp_match.group(1).strip().split("\n") if p.strip()]
                    logic_key_points.extend(points)

            except Exception:
                raw_facts.append(chunk[:1500])

            if end >= len(full_text):
                break
            start += 3600

        # 4) 載入潤色模型
        if collaborative_config and collaborative_config.get('polish_model'):
            self._load_model(collaborative_config['polish_model'])

        all_facts_text = "\n\n".join(raw_facts)
        final_report = self._final_structuring(all_facts_text, mode)

        # 🛡️ [Final Boss Fix] 模型聯動注入：若潤色模型漏寫了 key_content，直接將邏輯模型的重點補進去
        if not final_report.get("key_content") or len(final_report["key_content"]) == 0:
            print("Polish model missed key_content. Injecting results from Logic model...")
            final_report["key_content"] = logic_key_points[:8] # 最多補 8 條，避免過長

        return corrected_segments, final_report

    def _final_structuring(self, facts: str, mode: str):
        instruction = """您是頂級商務顧問與技術專家。請根據提供的事實點，撰寫一份「極詳盡、專業」的全方位會議報告。
【語言要求】：必須使用「繁體中文」(Traditional Chinese)。
【結構要求】：報告必須包含以下六個部分，並嚴格按順序產出：
1. 會議核心討論 (key_content)：【重要！開場必填，最少 200 字】詳盡記錄技術討論脈絡、技術參數、各方立場、邏輯推論。
2. 基本資料 (basic_info)
3. 會議議程 (agenda)
4. 決議紀錄 (decisions)
5. 待辦事項 (action_items)
6. 討論摘要 (discussion)

【重要目標】：這不是簡短摘要，而是一份供專業團隊執行使用的詳盡紀要。
- 請擴充內容深度，詳細描述技術參數、風險評估。
- 尤其是在 key_content 區塊，請保留完整的討論邏輯。

【硬性要求】：
- 不可輸出空的 sections；若沒有明確內容，請輸出「未明確形成」並補上「最接近的共識/方向」與「TBD 待確認點」。
- 請務必輸出「純 JSON」，不得包含任何解釋文字。

【產出範例】：
"key_content": [
  "針對 A 技術路徑，工程師 John 提出質疑，認為 VRAM 佔用過高會導致 OOM，建議改用 Map-Reduce 方案。",
  "團隊針對 B 問題進行激辯，最終共識為暫緩更新，直到 CUDA 驅動穩定為止。"
]
"""

        schema = {
            "type": "object",
            "properties": {
                "basic_info": {
                    "type": "object",
                    "properties": {
                        "subject": {"type": "string"},
                        "participants": {"type": "string"},
                        "time": {"type": "string"}
                    },
                    "required": ["subject", "participants", "time"]
                },
                "agenda": {"type": "array", "items": {"type": "string"}},
                "key_content": {"type": "array", "items": {"type": "string"}},
                "decisions": {"type": "array", "items": {"type": "string"}},
                "action_items": {
                    "type": "array", 
                    "items": {
                        "type": "object",
                        "properties": {
                            "task": {"type": "string"},
                            "owner": {"type": "string"},
                            "due_date": {"type": "string"}
                        },
                        "required": ["task", "owner", "due_date"]
                    }
                },
                "discussion": {
                    "type": "object",
                    "properties": {
                        "tracking": {"type": "array", "items": {"type": "string"}},
                        "interesting": {"type": "array", "items": {"type": "string"}},
                        "retrospective": {"type": "array", "items": {"type": "string"}}
                    },
                    "required": ["tracking", "interesting", "retrospective"]
                }
            },
            # ✅ key_content 不要 required，避免模型漏欄位就整體失敗
            "required": ["basic_info", "agenda", "decisions", "action_items", "discussion"]
        }

        def _normalize(obj: dict) -> dict:
            if not isinstance(obj, dict):
                obj = {}

            obj.setdefault("basic_info", {})
            if not isinstance(obj["basic_info"], dict):
                obj["basic_info"] = {}
            obj["basic_info"].setdefault("subject", "")
            obj["basic_info"].setdefault("participants", "")
            obj["basic_info"].setdefault("time", "")

            obj.setdefault("agenda", [])
            obj.setdefault("decisions", [])
            obj.setdefault("key_content", [])

            # 🛡️ 將結構化 action_items 格式化為易讀字串
            raw_actions = obj.get("action_items", [])
            formatted_actions = []
            if isinstance(raw_actions, list):
                for act in raw_actions:
                    if isinstance(act, dict):
                        task = act.get("task", "未命名任務")
                        owner = act.get("owner", "未指定")
                        due = act.get("due_date", "TBD")
                        formatted_actions.append(f"[{owner}] {task} (截止: {due})")
                    else:
                        formatted_actions.append(str(act))
            obj["action_items"] = formatted_actions

            obj.setdefault("discussion", {})
            if not isinstance(obj["discussion"], dict):
                obj["discussion"] = {}
            obj["discussion"].setdefault("tracking", [])
            obj["discussion"].setdefault("interesting", [])
            obj["discussion"].setdefault("retrospective", [])

            return obj

        try:
            res = self.llm.create_chat_completion(
                messages=[{"role": "system", "content": instruction}, {"role": "user", "content": facts}],
                response_format={"type": "json_object", "schema": schema},
                temperature=0.1,
                max_tokens=4000
            )
            raw = res["choices"][0]["message"]["content"]
            raw = re.sub(r"<thought>.*?</thought>", "", raw, flags=re.S | re.I).strip()

            # 有些模型仍可能包多餘文字，做一次 JSON 物件擷取
            m = re.search(r"(\{.*\})", raw, re.S)
            obj = json.loads(m.group(1) if m else raw)
            return _normalize(obj)

        except Exception as e:
            print(f"LLM JSON Parse Error: {e}")

            # ✅ 降級重試：不帶 schema，再嘗試一次只輸出 JSON
            try:
                retry_instruction = instruction + "\n再次強調：只輸出 JSON 物件，不得輸出任何其他文字。"
                res2 = self.llm.create_chat_completion(
                    messages=[{"role": "system", "content": retry_instruction}, {"role": "user", "content": facts}],
                    temperature=0.1,
                    max_tokens=4000
                )
                raw2 = res2["choices"][0]["message"]["content"]
                raw2 = re.sub(r"<thought>.*?</thought>", "", raw2, flags=re.S | re.I).strip()
                m2 = re.search(r"(\{.*\})", raw2, re.S)
                obj2 = json.loads(m2.group(1) if m2 else raw2)
                return _normalize(obj2)
            except Exception as e2:
                print(f"LLM downgrade retry failed: {e2}")

            # ✅ 最終 fallback：也要包含 key_content，避免前端 undefined
            return _normalize({
                "basic_info": {"subject": "分析解析失敗", "participants": "N/A", "time": "N/A"},
                "agenda": [],
                "key_content": [],
                "decisions": ["（未能解析決策，請重新分析）"],
                "action_items": ["[TBD]（未能解析待辦，請重新分析）"],
                "discussion": {
                    "tracking": ["（未能解析）"],
                    "interesting": ["（未能解析）"],
                    "retrospective": ["（未能解析）"]
                }
            })

    def generate_summary(self, *args, **kwargs):
        pass

    def polish_summary(self, raw_summary: dict):
        return raw_summary
