@echo off
REM ============================================================
REM Musical Instrument Image Recognition System - Setup Script
REM ============================================================
REM This script sets up the complete image recognition system
REM ============================================================

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║   Musical Instrument Scanner - Complete Setup          ║
echo ╚════════════════════════════════════════════════════════╝
echo.

REM Check if running from correct directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the project root directory
    echo    (Where package.json exists)
    pause
    exit /b 1
)

echo ✅ Found project root
echo.

REM Step 1: Install Backend Dependencies
echo Step 1: Installing Backend Dependencies...
echo ───────────────────────────────────────────
if exist "server\package.json" (
    cd server
    echo Installing npm packages for server...
    call npm install
    if errorlevel 1 (
        echo ❌ Backend installation failed
        pause
        exit /b 1
    )
    cd ..
    echo ✅ Backend dependencies installed
) else (
    echo ⚠️ server\package.json not found
)

echo.

REM Step 2: Install Frontend Dependencies
echo Step 2: Installing Frontend Dependencies...
echo ───────────────────────────────────────────
if exist "client\package.json" (
    cd client
    echo Installing npm packages for client...
    call npm install
    if errorlevel 1 (
        echo ❌ Frontend installation failed
        pause
        exit /b 1
    )
    cd ..
    echo ✅ Frontend dependencies installed
) else (
    echo ⚠️ client\package.json not found
)

echo.

REM Step 3: Check Python Installation
echo Step 3: Checking Python Installation...
echo ───────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo    Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

python --version
echo ✅ Python is installed

echo.

REM Step 4: Create Python Virtual Environment (optional)
echo Step 4: AI Service Setup...
echo ────────────────────────────
echo.
echo The AI Image Recognition Service requires Python dependencies.
echo These will be installed automatically when you run run.bat
echo.
if exist "server\Musical_Instrument_Model\local_deployment\requirements.txt" (
    echo ✅ Found requirements.txt
    echo    Dependencies: fastapi, uvicorn, ultralytics (YOLO), pillow, opencv-python
) else (
    echo ⚠️ requirements.txt not found
    echo    Make sure: server\Musical_Instrument_Model\local_deployment\requirements.txt exists
)

echo.

REM Step 5: Display Configuration Summary
echo Step 5: Configuration Summary...
echo ───────────────────────────────────
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║              SYSTEM CONFIGURATION                      ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo Backend Server:
echo   Location: server/
echo   Port: 8000
echo   Status: Ready ✓
echo.
echo Frontend Application:
echo   Location: client/
echo   Port: 5173
echo   Status: Ready ✓
echo.
echo AI Recognition Service:
echo   Location: server/Musical_Instrument_Model/local_deployment/
echo   Port: 8000 (same host, different process)
echo   Status: Not started (Start with run.bat)
echo.
echo Database:
echo   Should be running on: localhost:5432
echo   Database: ucca
echo   Check .env file for credentials
echo.

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║              QUICK START GUIDE                         ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo 1. START AI SERVICE (in new terminal):
echo    cd server\Musical_Instrument_Model\local_deployment
echo    run.bat
echo    ^(Wait for: "Uvicorn running on http://127.0.0.1:8000"^)
echo.
echo 2. START BACKEND SERVER (in new terminal):
echo    cd server
echo    npm start
echo    ^(Wait for: "🚀 Server running at http://localhost:8000"^)
echo.
echo 3. START FRONTEND (in new terminal):
echo    cd client
echo    npm run dev
echo    ^(Open: http://localhost:5173^)
echo.
echo 4. NAVIGATE TO SCANNER:
echo    Click "Scanner" or go to: /scanner
echo.
echo 5. VERIFY AI SERVICE:
echo    - Green indicator = Ready to scan
echo    - Yellow indicator = Service down, check terminal
echo.

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║              TROUBLESHOOTING                           ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo Issue: "AI service unavailable"
echo Solution:
echo   1. Check if run.bat is running in another terminal
echo   2. Port 8000 might be in use: netstat -ano ^| findstr :8000
echo   3. Restart: taskkill /PID ^<process_id^> /F
echo.
echo Issue: "No camera access"
echo Solution:
echo   1. Check browser permissions (Chrome: Settings ^> Privacy)
echo   2. Allow camera access to localhost
echo   3. Use HTTPS for production (camera requires secure context)
echo.
echo Issue: "Model loading error"
echo Solution:
echo   1. Check: server\Musical_Instrument_Model\best.pt exists
echo   2. If missing, training is needed or download from source
echo   3. Check disk space (model is ~200-300MB)
echo.
echo Issue: "Database connection error"
echo Solution:
echo   1. Verify PostgreSQL is running
echo   2. Check credentials in server\.env
echo   3. Verify database "ucca" exists
echo   4. Run migrations if needed
echo.

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║              DOCUMENTATION                            ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo Full setup guide: IMAGE_RECOGNITION_SETUP.md
echo API documentation: /api/image-recognition/docs (when backend running)
echo.

echo.
echo ✅ Setup Complete!
echo.
pause
