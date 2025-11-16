@echo off
cls
echo ========================================
echo Musical Instrument Detection API Setup
echo ========================================
echo.

echo Checking Python installation...
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Please install Python first.
    pause
    exit /b 1
)

echo Checking for YOLO model files...
cd ..
if exist "yolo11n.pt" (
    echo ✓ Found yolo11n.pt
) else if exist "yolov8s.pt" (
    echo ✓ Found yolov8s.pt
) else (
    echo WARNING: No YOLO model file found in parent directory.
    echo Please make sure yolo11n.pt or yolov8s.pt exists in the main folder.
    echo.
)

cd local_deployment

echo.
echo Installing dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Starting FastAPI Server...
echo ========================================
echo.
echo Server will be available at:
echo   🌐 Main Page:     http://127.0.0.1:8000
echo   🧪 Testing Page:  http://127.0.0.1:8000 (HTML interface)
echo   📚 API Docs:      http://127.0.0.1:8000/docs
echo   ❤️  Health Check: http://127.0.0.1:8000/health
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

python main.py