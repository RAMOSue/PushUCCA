# PowerShell script to install dependencies with fallback mirrors
Write-Host "Installing dependencies with fallback mirrors..." -ForegroundColor Green
Write-Host ""

$packages = @(
    "fastapi==0.109.0",
    "uvicorn[standard]==0.27.0",
    "python-multipart==0.0.6",
    "pillow==11.0.0",
    "opencv-python==4.9.0.80",
    "ultralytics==8.3.0",
    "numpy==2.1.0"
)

$mirrors = @(
    "https://pypi.org/simple/",
    "https://mirrors.aliyun.com/pypi/simple/",
    "https://pypi.tuna.tsinghua.edu.cn/simple"
)

foreach ($package in $packages) {
    Write-Host "Installing: $package" -ForegroundColor Cyan
    $installed = $false
    
    foreach ($mirror in $mirrors) {
        if (-not $installed) {
            Write-Host "  Trying mirror: $mirror"
            try {
                pip install -i $mirror $package --timeout 100 --retries 3 2>&1 | Select-String -Pattern "Successfully installed|already satisfied" | ForEach-Object { Write-Host "  ✓ $_" }
                $installed = $true
            }
            catch {
                Write-Host "  ✗ Failed with this mirror, trying next..."
            }
        }
    }
    
    if ($installed) {
        Write-Host "  ✓ Package installed successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to install $package with all mirrors" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "Installation complete!" -ForegroundColor Green
