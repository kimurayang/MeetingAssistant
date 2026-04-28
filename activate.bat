@echo off
:: 切換編碼為 UTF-8 以顯示中文
@chcp 65001 >nul

:: 檢查啟動腳本是否存在
if exist ".\venv\Scripts\activate" (
    echo [系統偵測] 虛擬環境已存在，跳過建立步驟...
) else (
    echo [系統偵測] 找不到虛擬環境，正在建立 venv...
    python -m venv venv
    echo [系統偵測] 建立完成！
)

echo 正在啟動虛擬環境...
echo ---------------------------------------------
:: 啟動並保留視窗
cmd /k ".\venv\Scripts\activate"