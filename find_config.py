import os
import json

def find_config():
    appdata = os.getenv('APPDATA')
    localappdata = os.getenv('LOCALAPPDATA')
    
    # 嘗試多種可能的 userData 名稱
    possible_dirs = [
        os.path.join(appdata, 'VoxNote'),
        os.path.join(appdata, 'voxnote'),
        os.path.join(appdata, 'electron-vite-app'), # 常見的開發預設名
        os.path.join(localappdata, 'VoxNote'),
    ]
    
    for d in possible_dirs:
        config_path = os.path.join(d, 'config.json')
        if os.path.exists(config_path):
            print(f"--- Found config at: {config_path} ---")
            with open(config_path, 'r', encoding='utf-8') as f:
                print(json.dumps(json.load(f), indent=2, ensure_ascii=False))
            return
    print("Config file not found in common locations.")

if __name__ == "__main__":
    find_config()
