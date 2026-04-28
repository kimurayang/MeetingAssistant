@echo off
TITLE VoxNote PATH-LIMIT BREAKER (GPU BUILD)
cd /d "%~dp0"

echo ==================================================
echo [STEP 1] Creating Ultra-Short Build Directory
echo ==================================================
:: 建立極短路徑，避開 260 字元限制
set SHORT_TMP=D:\vnb
if not exist "%SHORT_TMP%" mkdir "%SHORT_TMP%"

:: 強制將系統暫存目錄轉向短路徑
set TMP=%SHORT_TMP%
set TEMP=%SHORT_TMP%

echo [DONE] Build directory redirected to %SHORT_TMP%

echo ==================================================
echo [STEP 2] Injecting CUDA Targets (v12.4)
echo ==================================================
set CUDA_VS_EXT=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\extras\visual_studio_integration\MSBuildExtensions
set VS_BUILD_CUSTOMS=C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\MSBuild\Microsoft\VC\v180\BuildCustomizations

if not exist "%VS_BUILD_CUSTOMS%" mkdir "%VS_BUILD_CUSTOMS%"
copy /y "%CUDA_VS_EXT%\*" "%VS_BUILD_CUSTOMS%\"

echo ==================================================
echo [STEP 3] Setting Developer Flags
echo ==================================================
set PYTHON_EXE=venv\Scripts\python.exe
%PYTHON_EXE% -m pip uninstall llama-cpp-python -y

:: 核心編譯參數
set CMAKE_ARGS=-DGGML_CUDA=on ^
-DCMAKE_CUDA_FLAGS="-allow-unsupported-compiler" ^
-DCMAKE_C_FLAGS="/utf-8" ^
-DCMAKE_CXX_FLAGS="/utf-8" ^
-DCMAKE_CUDA_ARCHITECTURES=89

set PYTHONUTF8=1
set CL=/utf-8

echo ==================================================
echo [STEP 4] Starting SHORT-PATH GPU Compilation
echo ==================================================
echo (Compiling in D:\vnb to prevent path-too-long error...)

:: 安裝並執行編譯
%PYTHON_EXE% -m pip install scikit-build-core cmake ninja
%PYTHON_EXE% -m pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed even with short paths.
) else (
    echo.
    echo [SUCCESS] GPU VERSION FORGED! RTX 4070 IS READY.
    :: 清理臨時資料夾
    rd /s /q "%SHORT_TMP%"
)

pause
