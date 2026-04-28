import sqlite3
import os

def fix_paths():
    db_path = "database.db"
    if not os.path.exists(db_path):
        print("Error: database.db not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    old_dir_fragment = "workshop4"
    new_dir_fragment = "VoxNote"

    # 注意：Prisma 的 @map("audio_path") 代表資料庫內欄位是 audio_path
    cursor.execute(f"UPDATE Meeting SET audio_path = REPLACE(audio_path, '{old_dir_fragment}', '{new_dir_fragment}')")
    
    print(f"SUCCESS: Updated {cursor.rowcount} rows in Meeting table.")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    fix_paths()
