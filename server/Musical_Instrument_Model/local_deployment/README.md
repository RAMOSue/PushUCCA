# Musical Instrument Detection API - Local Deployment

This folder contains the local deployment version of the Musical Instrument Detection API using FastAPI.

## Features

- 🎵 Musical instrument detection using YOLO
- 🖥️ Local development and testing
- 🌐 Built-in HTML testing interface
- 📊 Single and batch image processing
- 🔄 Health check endpoints
- 📋 Static file serving for testing

## Structure

```
local_deployment/
├── main.py              # FastAPI application
├── testing/
│   └── index.html       # Web testing interface
└── README.md           # This file
```

## Installation

1. Install required packages:
```bash
pip install fastapi uvicorn python-multipart pillow opencv-python ultralytics numpy
```

2. Make sure you have the YOLO model files in the parent directory:
   - `yolo11n.pt` or `yolov8s.pt`

## Running the API

1. Navigate to the local_deployment folder:
```bash
cd local_deployment
```

2. Start the FastAPI server:
```bash
python main.py
```

The API will be available at:
- **API Base**: http://127.0.0.1:8000
- **Testing Interface**: http://127.0.0.1:8000/ 
- **API Documentation**: http://127.0.0.1:8000/docs
- **Alternative Docs**: http://127.0.0.1:8000/redoc

## API Endpoints

- `GET /` - Serves the HTML testing interface
- `GET /health` - Health check endpoint
- `POST /predict` - Single image prediction
- `POST /predict_batch` - Batch image prediction
- `GET /docs` - Interactive API documentation

## Testing Interface

The included HTML testing interface (`testing/index.html`) provides:

### Features:
- 📤 **Single Image Upload**: Upload and test individual images
- 📦 **Batch Upload**: Upload multiple images at once
- 👁️ **Image Preview**: See uploaded images before processing
- 📊 **Detailed Results**: View detection results with confidence scores and bounding boxes
- ❤️ **Health Check**: Monitor API status and model loading
- 📱 **Responsive Design**: Works on desktop and mobile devices

### How to Use:
1. Open http://127.0.0.1:8000 in your browser
2. Choose between "Single Image" or "Batch Upload" tabs
3. Select image files (JPEG, PNG, etc.)
4. Click "Detect Instruments" to process
5. View results with detected instruments, confidence scores, and bounding boxes

## Usage Examples

### Python Requests

```python
import requests

# Single image prediction
url = "http://127.0.0.1:8000/predict"
files = {"file": open("image.jpg", "rb")}
response = requests.post(url, files=files)
result = response.json()

print(f"Found {result['count']} instruments:")
for pred in result['predictions']:
    print(f"- {pred['class_name']}: {pred['confidence']:.2%}")
```

### cURL

```bash
# Single image
curl -X POST "http://127.0.0.1:8000/predict" \
     -H "accept: application/json" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@image.jpg"

# Health check
curl http://127.0.0.1:8000/health
```

### JavaScript/Fetch

```javascript
const formData = new FormData();
formData.append('file', imageFile);

fetch('http://127.0.0.1:8000/predict', {
    method: 'POST',
    body: formData
})
.then(response => response.json())
.then(data => {
    console.log(`Found ${data.count} instruments`);
    data.predictions.forEach(pred => {
        console.log(`${pred.class_name}: ${(pred.confidence * 100).toFixed(1)}%`);
    });
});
```

## Response Format

### Single Prediction Response

```json
{
  "filename": "guitar.jpg",
  "predictions": [
    {
      "class_name": "acoustic guitar",
      "confidence": 0.892,
      "bbox": {
        "x1": 145.23,
        "y1": 67.89,
        "x2": 445.67,
        "y2": 378.12
      }
    }
  ],
  "count": 1
}
```

### Batch Prediction Response

```json
{
  "results": [
    {
      "filename": "image1.jpg",
      "predictions": [...],
      "count": 2
    },
    {
      "filename": "image2.jpg", 
      "predictions": [...],
      "count": 1
    }
  ],
  "total_files": 2
}
```

## Model Configuration

The API automatically looks for YOLO model files in the parent directory:
1. `yolo11n.pt` (preferred)
2. `yolov8s.pt` (fallback)

Make sure at least one of these files exists in the main dataset folder.

## Development

### Hot Reload
The server runs with `reload=True` by default, so changes to `main.py` will automatically restart the server.

### Adding New Endpoints
Add new routes to `main.py`:

```python
@app.get("/custom_endpoint")
async def custom_function():
    return {"message": "Custom response"}
```

### Modifying the Testing Interface
Edit `testing/index.html` to customize the web interface. The file includes:
- CSS styling for responsive design
- JavaScript for API interactions
- Image preview functionality
- Results display formatting

## Troubleshooting

### Common Issues:

1. **Model not found**:
   - Ensure `yolo11n.pt` or `yolov8s.pt` exists in the parent directory
   - Check the file paths in the console output

2. **Port already in use**:
   - Change the port in `main.py`: `uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)`

3. **Import errors**:
   - Install missing packages: `pip install fastapi uvicorn python-multipart pillow opencv-python ultralytics`

4. **Image upload fails**:
   - Check file format (JPEG, PNG supported)
   - Ensure file size is reasonable
   - Check browser console for JavaScript errors

### Debug Mode:
Add debug output to `main.py`:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Production Notes

For production deployment:
- Use a proper WSGI server like Gunicorn
- Add authentication and rate limiting
- Configure proper CORS settings
- Use environment variables for configuration
- Add logging and monitoring

This local deployment is optimized for development and testing. For production use, consider the cloud deployment version.