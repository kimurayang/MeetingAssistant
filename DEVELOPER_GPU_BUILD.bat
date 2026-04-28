@echo off
TITLE VoxNote Developer GPU Build Tool
cd /d "%~dp0"

echo ==================================================
echo [STEP 1] Fixing Visual Studio ^<--^> CUDA Integration
echo ==================================================

:: 定義 CUDA 整合路徑 (根據 12.4 版本)
set CUDA_VS_EXT=C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\extras\visual_studio_integration\MSBuildExtensions
:: 定義 VS 2026 (v180) 的路徑
set VS_BUILD_CUSTOMS=C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\MSBuild\Microsoft\VC\v180\BuildCustomizations

if not exist "%CUDA_VS_EXT%" (
    echo [ERROR] CUDA Integration files not found at %CUDA_VS_EXT%
    pause
    exit /b
)

echo Found CUDA extensions. Copying to Visual Studio...
if not exist "%VS_BUILD_CUSTOMS%" mkdir "%VS_BUILD_CUSTOMS%"
copy /y "%CUDA_VS_EXT%\*" "%VS_BUILD_CUSTOMS%\"

echo ==================================================
echo [STEP 2] Sanitizing Environment
echo ==================================================
set PYTHON_EXE=venv\Scripts\python.exe
%PYTHON_EXE% -m pip uninstall llama-cpp-python -y

:: 強制開啟編譯優化與編碼修正
set PYTHONUTF8=1
set CL=/utf-8
set CMAKE_ARGS=-DGGML_CUDA=on -DCMAKE_CUDA_ARCHITECTURES=all -DCMAKE_CUDA_COMPILER="C:/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.4/bin/nvcc.exe"

echo ==================================================
echo [STEP 3] Starting Custom GPU Compilation
echo ==================================================
echo (This will take about 5-10 minutes. Please do not close...)

:: 嘗試使用 Ninja (如果有的話會更穩定)
%PYTHON_EXE% -m pip install ninja
%PYTHON_EXE% -m pip install llama-cpp-python --upgrade --force-reinstall --no-cache-dir --verbose

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!!!] Compilation still failed. 
    echo Suggestion: Since Python 3.13 is extremely new, 
    echo we might need to create a Python 3.12 venv just for the Sidecar.
) else (
    echo.
    echo [SUCCESS] GPU VERSION COMPILED AND INSTALLED!
)

pause
