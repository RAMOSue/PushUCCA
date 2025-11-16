@echo off
echo ============================================================
echo Musical Instrument Detection - AI Service
echo ============================================================
echo.

REM Check if fastapi is already installed
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies for Local Deployment...
    echo This may take 2-5 minutes on first run...
    echo.
    pip install -r requirements.txt --retries 5 --default-timeout 100
    if errorlevel 1 (
        echo.
        echo WARNING: Pip installation had issues. Attempting to continue...
        echo If the server fails to start, try installing manually:
        echo   pip install fastapi==0.104.1
        echo   pip install uvicorn[standard]==0.24.0
        echo   pip install ultralytics==8.0.196
        echo.
    )
) else (
    echo ✓ Dependencies already installed
)

echo.
echo ============================================================
echo Starting FastAPI server...
echo ============================================================
echo Server will be available at: http://127.0.0.1:8000
echo Testing interface: http://127.0.0.1:8000/
echo API docs: http://127.0.0.1:8000/docs
echo Swagger UI: http://127.0.0.1:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo ============================================================
echo.

python main.py