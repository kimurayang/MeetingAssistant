import os
import datetime

def find_audio():
    # 定義所有可能的路徑
    search_paths = [
        os.path.expandvars(r'%APPDATA%\TRON-MeetingAI\recordings'),
        r'D:\Python\VoxNote',
        r'D:\Python\workshop4\recordings',
        r'D:\Python\VoxNote\recordings'
    ]
    
    extensions = ('.wav', '.mp3', '.m4a', '.webm', '.ogg', '.mov')
    
    print("=== 全系統錄音檔案搜尋結果 ===")
    found_any = False
    
    for path in search_paths:
        if not os.path.exists(path):
            continue
            
        print(f"\n[資料夾]: {path}")
        files = [f for f in os.listdir(path) if f.lower().endswith(extensions)]
        
        if not files:
            print("  (此路徑下目前無錄音檔案)")
            continue
            
        for f in files:
            found_any = True
            f_path = os.path.join(path, f)
            mtime = os.path.getmtime(f_path)
            dt = datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
            size_mb = os.path.getsize(f_path) / (1024 * 1024)
            print(f"  - {f}")
            print(f"    產生日: {dt}")
            print(f"    檔案大小: {size_mb:.2f} MB")
            print(f"    完整路徑: {f_path}")
    
    if not found_any:
        print("\n很抱歉，在所有已知路徑中都找不到錄音檔案。")

if __name__ == "__main__":
    find_audio()
