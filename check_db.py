import sqlite3
import json

db_path = "D:/Python/VoxNote/database.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=== Meeting Analysis Data Check ===")
cursor.execute("SELECT id, title, status FROM Meeting")
meetings = cursor.fetchall()
for m in meetings:
    print(f"Meeting: {m[1]} (ID: {m[0]}, Status: {m[2]})")
    cursor.execute("SELECT highlights FROM Summary WHERE meeting_id = ?", (m[0],))
    summary = cursor.fetchone()
    if summary and summary[0]:
        print("  [OK] Summary exists.")
        try:
            data = json.loads(summary[0])
            print(f"  [OK] Data Structure: {list(data.keys())}")
            # 印出部分內容以觀察密度
            print(f"  Sample Content (Agenda): {data.get('agenda', [])[:2]}")
        except:
            print("  [!] Summary is not valid JSON.")
    else:
        print("  [ ] No summary found.")

conn.close()
