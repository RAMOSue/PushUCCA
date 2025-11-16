@echo off
REM ============================================================
REM Verify Image Recognition System Status
REM ============================================================

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║   Image Recognition System Status Check               ║
echo ╚════════════════════════════════════════════════════════╝
echo.

REM Check Node.js
echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found
) else (
    for /f "tokens=*" %%i in ('node --version') do echo ✅ Node.js: %%i
)

REM Check Python
echo.
echo Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found
) else (
    for /f "tokens=*" %%i in ('python --version') do echo ✅ %%i
)

REM Check npm packages
echo.
echo Checking Backend Dependencies...
if exist "server\node_modules\form-data" (
    echo ✅ form-data found
) else (
    echo ⚠️ form-data not found (required for image uploads)
)

if exist "server\node_modules\axios" (
    echo ✅ axios found
) else (
    echo ⚠️ axios not found (required for API calls)
)

REM Check Python dependencies
echo.
echo Checking Python Dependencies...
python -c "import fastapi; print('✅ fastapi found')" >nul 2>&1
if errorlevel 1 echo ⚠️ fastapi not found

python -c "import ultralytics; print('✅ ultralytics found')" >nul 2>&1
if errorlevel 1 echo ⚠️ ultralytics not found

python -c "import cv2; print('✅ opencv-python found')" >nul 2>&1
if errorlevel 1 echo ⚠️ opencv-python not found

REM Check database
echo.
echo Checking Database...
netstat -an | findstr :5432 >nul
if errorlevel 1 (
    echo ⚠️ PostgreSQL may not be running on port 5432
) else (
    echo ✅ PostgreSQL port 5432 is listening
)

REM Check file structure
echo.
echo Checking File Structure...
if exist "server\controllers\imageRecognitionController.js" (
    echo ✅ imageRecognitionController.js found
) else (
    echo ❌ imageRecognitionController.js not found
)

if exist "server\routes\imageRecognitionRoutes.js" (
    echo ✅ imageRecognitionRoutes.js found
) else (
    echo ❌ imageRecognitionRoutes.js not found
)

if exist "client\src\pages\MusicInstrumentScanner.jsx" (
    echo ✅ MusicInstrumentScanner.jsx found
) else (
    echo ❌ MusicInstrumentScanner.jsx not found
)

if exist "server\Musical_Instrument_Model\local_deployment\main.py" (
    echo ✅ FastAPI main.py found
) else (
    echo ❌ FastAPI main.py not found
)

if exist "server\Musical_Instrument_Model\local_deployment\run.bat" (
    echo ✅ run.bat found
) else (
    echo ❌ run.bat not found
)

REM Check model file
echo.
echo Checking YOLO Model...
if exist "server\Musical_Instrument_Model\best.pt" (
    for %%A in ("server\Musical_Instrument_Model\best.pt") do (
        set size=%%~zA
        echo ✅ best.pt found ^(Size: !size! bytes^)
    )
) else (
    echo ⚠️ best.pt not found - model training may be needed
)

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║              Status Summary                           ║
echo ╚════════════════════════════════════════════════════════╝
echo.
echo Ready to start? Run in three separate terminals:
echo.
echo Terminal 1:
echo   cd server\Musical_Instrument_Model\local_deployment
echo   run.bat
echo.
echo Terminal 2:
echo   cd server
echo   npm start
echo.
echo Terminal 3:
echo   cd client
echo   npm run dev
echo.

pause
