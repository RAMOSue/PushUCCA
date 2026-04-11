@echo off
REM School ID Verification - Quick Fix Script
REM This script will properly install all dependencies

echo.
echo ===============================================
echo School ID Verification - Setup & Fix
echo ===============================================
echo.

REM Get to server directory
cd /d "C:\Users\Runard Ramos\Desktop\LOGINAUTH\server"

if %errorlevel% neq 0 (
    echo ERROR: Cannot navigate to server directory
    echo Make sure the path is correct
    pause
    exit /b 1
)

echo Current directory: %cd%
echo.

REM Step 1: Remove old node_modules
echo Step 1: Cleaning old dependencies...
if exist node_modules (
    echo   Removing node_modules folder...
    rmdir /s /q node_modules >nul 2>&1
    if %errorlevel% equ 0 (
        echo   ✓ Removed old node_modules
    ) else (
        echo   ! Could not remove node_modules (might be in use)
    )
) else (
    echo   - node_modules not found (already clean)
)
echo.

REM Step 2: Clear npm cache
echo Step 2: Clearing npm cache...
call npm cache clean --force >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Cache cleared
) else (
    echo   ! Cache clear had issues (non-critical)
)
echo.

REM Step 3: Fresh install
echo Step 3: Installing all dependencies (this may take 2-3 minutes)...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ERROR: npm install failed
    echo Please check your internet connection and try again
    pause
    exit /b 1
)
echo.

REM Step 4: Verify installation
echo Step 4: Verifying installation...
call npm list tesseract.js sharp tesseract.js-core >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ All dependencies installed correctly
) else (
    echo   ! Warning: Could not verify packages
)
echo.

echo ===============================================
echo ✓ Setup Complete!
echo ===============================================
echo.
echo Next steps:
echo   1. Run the server: npm start
echo   2. Open browser: http://localhost:3000
echo   3. Go to Personal Information
echo   4. Click Camera icon and capture CSU ID
echo.
echo Server should show:
echo   ✓ Tesseract.js loaded successfully
echo   ✓ Sharp loaded successfully
echo   ✓ Server running on http://localhost:8000
echo.
pause
