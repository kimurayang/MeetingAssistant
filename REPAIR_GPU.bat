@echo off
TITLE VoxNote GPU Repair Tool
echo [1/3] Checking environment...
cd /d "%~dp0"
set PYTHON_EXE=venv\Scripts\python.exe

if not exist %PYTHON_EXE% (
    echo ERROR: venv not found in %cd%
    pause
    exit /b
)

echo [2/3] Uninstalling existing llama-cpp-python...
%PYTHON_EXE% -m pip uninstall llama-cpp-python -y

echo [3/3] Installing DirectML GPU Accelerated version...
echo (This version uses DirectX 12 for NVIDIA GPU acceleration)

%PYTHON_EXE% -m pip install llama-cpp-python-dml --upgrade --force-reinstall --no-cache-dir

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [! ] DirectML failed. Installing Standard CPU version as final fallback...
    %PYTHON_EXE% -m pip install llama-cpp-python --upgrade --force-reinstall
)


echo.
echo ==================================================
echo REPAIR COMPLETE! 
echo Please run 'diagnose_llm.py' again to verify GPU status.
echo ==================================================
pause
