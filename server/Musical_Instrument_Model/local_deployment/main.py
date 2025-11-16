from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import cv2
import numpy as np
from ultralytics import YOLO
import io
from PIL import Image
import os
import sys

# Add the parent directory to the path to access the model files
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = FastAPI(title="Musical Instrument Detection API", description="Local deployment for YOLO musical instrument detection")

# Add CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for serving HTML (use absolute path)
current_dir = os.path.dirname(os.path.abspath(__file__))
testing_dir = os.path.join(current_dir, "testing")
print(f"Static files directory: {testing_dir}")
app.mount("/static", StaticFiles(directory=testing_dir), name="static")

# Load the YOLO model
model = None
try:
    # Get the parent directory (main dataset folder)
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print(f"Looking for model files in: {parent_dir}")
    
    # Try different model paths (prioritize updated trained model in root)
    model_files = [
        "best.pt",  # Updated trained model in root directory (PRIORITY)
        "last.pt",  # Last checkpoint in root directory
        os.path.join("runs", "detect", "musical_instrument_10x_aug", "weights", "best.pt"),  # Old trained model
        os.path.join("runs", "detect", "musical_instrument_10x_aug", "weights", "last.pt"),  # Old checkpoint
        "yolov8s.pt",  # Base model (fallback)
        "yolo11n.pt"   # Newer base model
    ]
    model_path = None
    
    for model_file in model_files:
        potential_path = os.path.join(parent_dir, model_file)
        print(f"Checking: {potential_path}")
        if os.path.exists(potential_path):
            model_path = potential_path
            print(f"✓ Found model: {model_path}")
            break
    
    if model_path and os.path.exists(model_path):
        print(f"Loading model from: {model_path}")
        model = YOLO(model_path)
        print(f"✓ Model loaded successfully!")
        print(f"Model classes: {list(model.names.values()) if hasattr(model, 'names') else 'Unknown'}")
    else:
        print("✗ No model file found. Checked for: yolo11n.pt, yolov8s.pt, best.pt")
        print(f"Please ensure one of these files exists in: {parent_dir}")
        
except Exception as e:
    print(f"✗ Error loading model: {e}")
    import traceback
    traceback.print_exc()
    model = None

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Serve the main testing page"""
    try:
        # Get the current directory and construct the path to index.html
        current_dir = os.path.dirname(os.path.abspath(__file__))
        html_path = os.path.join(current_dir, "testing", "index.html")
        print(f"Loading HTML from: {html_path}")
        
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError as e:
        print(f"HTML file not found: {e}")
        return HTMLResponse(content="<h1>Welcome to Musical Instrument Detection API</h1><p>Testing page not found. Please check /docs for API documentation.</p>")
    except Exception as e:
        print(f"Error loading HTML: {e}")
        import traceback
        traceback.print_exc()
        return HTMLResponse(content=f"<h1>Error loading page</h1><p>{str(e)}</p>", status_code=500)

@app.get("/favicon.ico")
async def favicon():
    """Serve a simple favicon to prevent 404 errors"""
    return JSONResponse(content={}, status_code=204)

@app.get("/troubleshoot.html", response_class=HTMLResponse)
async def troubleshoot():
    """Serve the troubleshooting page"""
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        html_path = os.path.join(current_dir, "testing", "troubleshoot.html")
        with open(html_path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Troubleshoot page not found</h1>", status_code=404)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    response = {
        "status": "healthy",
        "model_loaded": model is not None
    }
    
    if model is not None:
        try:
            response["model_classes"] = list(model.names.values()) if hasattr(model, 'names') else []
            response["num_classes"] = len(model.names) if hasattr(model, 'names') else 0
        except:
            pass
    else:
        response["error"] = "Model not loaded. Check server logs for details."
    
    return response

@app.post("/predict")
async def predict_image(file: UploadFile = File(...)):
    """
    Predict musical instruments in an uploaded image
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image file
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Convert PIL image to numpy array
        image_np = np.array(image)
        
        # Run inference with 40% confidence threshold
        results = model(image_np, conf=0.50)
        
        # Process results
        predictions = []
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    confidence = box.conf[0].item()
                    class_id = int(box.cls[0].item())
                    class_name = model.names[class_id]
                    
                    predictions.append({
                        "class_name": class_name,
                        "confidence": round(confidence, 3),
                        "bbox": {
                            "x1": round(x1, 2),
                            "y1": round(y1, 2),
                            "x2": round(x2, 2),
                            "y2": round(y2, 2)
                        }
                    })
        
        return {
            "filename": file.filename,
            "predictions": predictions,
            "count": len(predictions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@app.post("/predict_batch")
async def predict_batch(files: list[UploadFile] = File(...)):
    """
    Predict musical instruments in multiple uploaded images
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    results = []
    
    for file in files:
        if not file.content_type.startswith("image/"):
            results.append({
                "filename": file.filename,
                "error": "File must be an image"
            })
            continue
        
        try:
            # Read image file
            contents = await file.read()
            image = Image.open(io.BytesIO(contents))
            
            # Convert PIL image to numpy array
            image_np = np.array(image)
            
            # Run inference with 40% confidence threshold
            model_results = model(image_np, conf=0.40)
            
            # Process results
            predictions = []
            for result in model_results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        confidence = box.conf[0].item()
                        class_id = int(box.cls[0].item())
                        class_name = model.names[class_id]
                        
                        predictions.append({
                            "class_name": class_name,
                            "confidence": round(confidence, 3),
                            "bbox": {
                                "x1": round(x1, 2),
                                "y1": round(y1, 2),
                                "x2": round(x2, 2),
                                "y2": round(y2, 2)
                            }
                        })
            
            results.append({
                "filename": file.filename,
                "predictions": predictions,
                "count": len(predictions)
            })
            
        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": f"Error processing image: {str(e)}"
            })
    
    return {"results": results, "total_files": len(files)}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
