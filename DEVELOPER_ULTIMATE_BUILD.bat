@echo off
TITLE VoxNote HARDCORE GPU BUILDER (Python 3.13 + VS 2026)
cd /d "%~dp0"

echo ==================================================
echo [STEP 1] Injecting CUDA Targets into Visual Studio
echo ==================================================
set CUDA_VS_EXT=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\extras\visual_studio_integration\MSBuildExtensions
set VS_BUILD_CUSTOMS=C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\MSBuild\Microsoft\VC\v180\BuildCustomizations

if not exist "%VS_BUILD_CUSTOMS%" mkdir "%VS_BUILD_CUSTOMS%"
copy /y "%CUDA_VS_EXT%\*" "%VS_BUILD_CUSTOMS%\"

echo ==================================================
echo [STEP 2] Setting Up Developer Environment Flags
echo ==================================================
:: 清理環境
set PYTHON_EXE=venv\Scripts\python.exe
%PYTHON_EXE% -m pip uninstall llama-cpp-python -y

:: 核心編譯旗標
:: 1. -DGGML_CUDA=on: 開啟 CUDA 支援
:: 2. -DCMAKE_CUDA_FLAGS="-allow-unsupported-compiler": 【關鍵】強行讓 nvcc 接受 VS 2026
:: 3. -DCMAKE_C_FLAGS="/utf-8" ...: 解決 C2001 編碼問題
:: 4. -DCMAKE_CUDA_ARCHITECTURES=89: 鎖定 RTX 4070 (Ada) 架構加速
set CMAKE_ARGS=-DGGML_CUDA=on ^
-DCMAKE_CUDA_FLAGS="-allow-unsupported-compiler" ^
-DCMAKE_C_FLAGS="/utf-8" ^
-DCMAKE_CXX_FLAGS="/utf-8" ^
-DCMAKE_CUDA_ARCHITECTURES=89

set PYTHONUTF8=1
set CL=/utf-8

echo ==================================================
echo [STEP 3] Starting BRUTE FORCE Compilation
echo ==================================================
echo (This IS a real compilation. It will show many warnings, just ignore them.)
echo (Wait for about 5-10 minutes...)

:: 安裝必要工具
%PYTHON_EXE% -m pip install scikit-build-core cmake ninja

:: 執行編譯
%PYTHON_EXE% -m pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir --verbose

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ==================================================
    echo [CRITICAL ERROR] Brute force failed. 
    echo ==================================================
) else (
    echo.
    echo [SUCCESS] GPU VERSION FORGED SUCCESSFULLY!
)

pause
