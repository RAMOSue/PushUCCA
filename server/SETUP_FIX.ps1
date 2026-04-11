#!/usr/bin/env pwsh

# School ID Verification - Quick Fix Script (PowerShell)
# This script will properly install all dependencies

Write-Host ""
Write-Host "==============================================="
Write-Host "School ID Verification - Setup & Fix" -ForegroundColor Cyan
Write-Host "==============================================="
Write-Host ""

# Navigate to server directory
$serverPath = "C:\Users\Runard Ramos\Desktop\LOGINAUTH\server"
if (-Not (Test-Path $serverPath)) {
    Write-Host "ERROR: Cannot find server directory at: $serverPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $serverPath
Write-Host "Current directory: $((Get-Location).Path)"
Write-Host ""

# Step 1: Remove old node_modules
Write-Host "Step 1: Cleaning old dependencies..."
$nodeModulesPath = Join-Path (Get-Location) "node_modules"
if (Test-Path $nodeModulesPath) {
    Write-Host "  Removing node_modules folder..."
    try {
        Remove-Item -Path $nodeModulesPath -Recurse -Force
        Write-Host "  ✓ Removed old node_modules" -ForegroundColor Green
    } catch {
        Write-Host "  ! Could not remove node_modules (might be in use)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  - node_modules not found (already clean)" -ForegroundColor Gray
}
Write-Host ""

# Step 2: Clear npm cache
Write-Host "Step 2: Clearing npm cache..."
try {
    npm cache clean --force | Out-Null
    Write-Host "  ✓ Cache cleared" -ForegroundColor Green
} catch {
    Write-Host "  ! Cache clear had issues (non-critical)" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Fresh install
Write-Host "Step 3: Installing all dependencies (this may take 2-3 minutes)..."
Write-Host "  Please wait..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: npm install failed" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again"
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 4: Verify installation
Write-Host "Step 4: Verifying installation..."
$packages = npm list tesseract.js sharp tesseract.js-core 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ All dependencies installed correctly" -ForegroundColor Green
} else {
    Write-Host "  ! Warning: Could not verify packages" -ForegroundColor Yellow
    Write-Host "  (But installation may still be successful)"
}
Write-Host ""

Write-Host "==============================================="
Write-Host "✓ Setup Complete!" -ForegroundColor Green
Write-Host "==============================================="
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Run the server: npm start"
Write-Host "  2. Open browser: http://localhost:3000"
Write-Host "  3. Go to Personal Information"
Write-Host "  4. Click Camera icon and capture CSU ID"
Write-Host ""
Write-Host "Server should show:"
Write-Host "  ✓ Tesseract.js loaded successfully"
Write-Host "  ✓ Sharp loaded successfully"
Write-Host "  ✓ Server running on http://localhost:8000"
Write-Host ""
Read-Host "Press Enter to continue"
