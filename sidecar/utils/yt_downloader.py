import os
import subprocess
import uuid

def download_media_audio(url: str, output_dir: str) -> str:
    """
    通用影音下載器 (Media Downloader v1.0):
    支援 YouTube, Bilibili 等超過 1000 個平台。
    對於需要認證的平台 (如 SharePoint/Teams)，會給予引導提示。
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # 產生唯一的檔名
    file_id = str(uuid.uuid4().hex)
    output_template = os.path.join(output_dir, f"media_{file_id}.%(ext)s")
    
    # 尋找 yt-dlp 執行檔路徑 (優先使用 venv 內的)
    yt_dlp_path = "yt-dlp"
    _base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    _venv_bin = os.path.join(_base_dir, "venv", "Scripts", "yt-dlp.exe")
    if os.path.exists(_venv_bin):
        yt_dlp_path = _venv_bin

    print(f"AudioEngine: Fetching media from {url}...")
    
    # 🛡️ [Security Fix] 安全校驗：僅允許標準網址協定，防止參數注入 (如 --exec)
    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        raise Exception(f"無效的網址格式：{clean_url}。網址必須以 http:// 或 https:// 開頭。")

    cmd = [
        yt_dlp_path,
        "-x", # 只提取音訊
        "--audio-format", "wav",
        "--audio-quality", "0",
        "-o", output_template,
        "--no-playlist",
        "--no-warnings",
        "--geo-bypass",
        "--ignore-errors",
        "--", # 🛡️ [Security Fix] 明確標記之後的內容皆為位置參數，而非指令旗標
        clean_url
    ]

    try:
        # 執行下載，超時設定 5 分鐘
        result = subprocess.run(cmd, check=True, capture_output=True, timeout=300)
        
        # 搜尋剛下載好的檔案
        for f in os.listdir(output_dir):
            if f.startswith(f"media_{file_id}") and f.endswith(".wav"):
                return os.path.abspath(os.path.join(output_dir, f))
        
        raise Exception("下載完成但找不到轉換後的檔案。")
    except subprocess.TimeoutExpired:
        raise Exception("下載超時 (限時 5 分鐘)，請檢查網路連線或檔案大小。")
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode('utf-8', errors='ignore').lower()
        
        # 針對企業私有雲 (SharePoint/Teams) 的專屬提示
        if "sharepoint" in url.lower() or "session cookies" in error_msg:
            raise Exception("偵測到企業私有連結 (SharePoint/Teams)。\n基於資安保護，AI 無法直接存取您的內部檔案。\n請先【下載該影片至電腦】，再使用【選取本地影音檔案】功能匯入。")
        
        raise Exception(f"下載引擎回報錯誤: {error_msg}")
    except Exception as e:
        raise Exception(f"影音處理發生異常: {str(e)}")
