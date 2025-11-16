@echo off
cls
echo ========================================
echo Model File Diagnostic
echo ========================================
echo.

echo Current directory:
cd
echo.

echo Parent directory contents:
cd ..
echo Current location:
cd
echo.

echo Looking for model files:
if exist "yolo11n.pt" (
    echo ✓ FOUND: yolo11n.pt
    dir yolo11n.pt
) else (
    echo ✗ NOT FOUND: yolo11n.pt
)

if exist "yolov8s.pt" (
    echo ✓ FOUND: yolov8s.pt  
    dir yolov8s.pt
) else (
    echo ✗ NOT FOUND: yolov8s.pt
)

if exist "best.pt" (
    echo ✓ FOUND: best.pt
    dir best.pt
) else (
    echo ✗ NOT FOUND: best.pt
)

echo.
echo ========================================
echo Testing Python and Ultralytics
echo ========================================

python -c "import sys; print(f'Python: {sys.version}')"
python -c "try: import ultralytics; print('✓ Ultralytics installed'); from ultralytics import YOLO; print('✓ YOLO import works'); except Exception as e: print(f'✗ Error: {e}')"

echo.
echo ========================================
echo Testing Model Loading
echo ========================================

python -c "from ultralytics import YOLO; import os; parent = os.getcwd(); print(f'Current dir: {parent}'); models = ['yolo11n.pt', 'yolov8s.pt']; [print(f'Trying {m}...') or YOLO(m) and print(f'✓ {m} loaded successfully!') for m in models if os.path.exists(m)]"

echo.
echo ========================================
cd local_deployment
pause