# Musical Instrument Image Recognition Scanner

This document explains how to set up and use the new Musical Instrument Image Scanner that replaces the QR code scanner.

## Overview

The scanner now uses **YOLO-based image recognition** via a FastAPI backend service to detect musical instruments from images captured via camera or uploaded files. Detected instruments are automatically matched with inventory items and saved to the `image_recognition_data` database table.

## Architecture

```
┌─────────────────────────┐
│  React Frontend         │
│  (MusicInstrumentScanner.jsx)
│  - Camera capture       │
│  - Image upload         │◄──────────────┐
│  - AI health check      │               │
│  - Auto-capture         │               │
└─────────────────────────┘               │
           │                              │
           │ POST /api/image-recognition/scan
           │ (multipart/form-data)        │
           ▼                              │
┌─────────────────────────┐              │
│  Express Backend        │              │
│  (Port 8000)            │              │
│  imageRecognitionController.js         │
│  - Receive image        │              │
│  - Forward to AI service│              │
│  - Match with inventory │              │
│  - Save to DB           │              │
└─────────────────────────┘              │
           │                              │
           │ POST /predict (image file)   │
           ▼                              │
┌─────────────────────────┐              │
│  FastAPI AI Service     │              │
│  (Port 8000)            │◄─────────────┘
│  main.py                │
│  - YOLO model inference │
│  - Detect instruments   │
│  - Return predictions   │
└─────────────────────────┘

        Database
    ┌─────────────────────┐
    │  image_recognition_data
    │  - id (PK)
    │  - user_id (FK)
    │  - image_url
    │  - predicted_item
    │  - confidence
    │  - quantity_suggested
    │  - matched_item_id (FK)
    │  - matched_item_uuid
    │  - created_at
    └─────────────────────┘
```

## Setup Instructions

### Step 1: Install Dependencies (Backend)

Ensure the Express server has the required packages:

```bash
npm install form-data
# form-data is used to send multipart requests to FastAPI
```

### Step 2: Start the FastAPI AI Service

The FastAPI server runs on **port 8000** and must be started BEFORE the scanner is used.

**On Windows:**
```bash
cd server/Musical_Instrument_Model/local_deployment
run.bat
```

This will:
- Install Python dependencies from `requirements.txt`
- Start the FastAPI server on `http://127.0.0.1:8000`
- Load the YOLO model (`best.pt` or fallback models)

**Expected Output:**
```
✓ Found model: .../best.pt
✓ Model loaded successfully!
Model classes: ['violin', 'guitar', 'drums', ...]

INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 3: Start the Express Backend Server

```bash
cd server
npm install
npm start
```

The server will automatically register the new routes:
- `GET /api/image-recognition/health` - Check AI service status
- `POST /api/image-recognition/scan` - Scan single image
- `POST /api/image-recognition/scan/batch` - Batch scan multiple images
- `GET /api/image-recognition/history` - Get user's recognition history

### Step 4: Start the React Frontend

```bash
cd client
npm install
npm run dev
```

## Frontend Components

### MusicInstrumentScanner.jsx

The new scanner page at `/scanner` supports two modes:

#### Camera Mode
- **Scan Now**: Captures a single frame and sends to AI service
- **Auto Scan**: Automatically captures every 3 seconds
- **Switch Camera**: Toggle between available cameras

Features:
- Real-time camera preview
- Processing indicator with spinner
- Automatic inventory matching
- Add to borrowing cart with confidence scores

#### Upload Mode
- Drag & drop image upload
- File input dialog
- Maximum file size: 5MB
- Supported formats: JPG, PNG

### Detection Flow

1. **Capture/Upload Image** → Sent to `/api/image-recognition/scan`
2. **Express Server**:
   - Receives image via multer
   - Stores temporary file
   - Forwards to FastAPI service
3. **FastAPI YOLO Service**:
   - Runs inference with 50% confidence threshold
   - Returns bounding boxes and predictions
4. **Express Server** (continued):
   - Matches predictions with inventory items
   - Saves to `image_recognition_data` table
   - Returns results to frontend
5. **Frontend**:
   - Displays detected items with confidence
   - Shows warnings for items not in inventory
   - Auto-adds to cart if matched

## Database Schema

The `image_recognition_data` table stores all scan attempts:

```sql
CREATE TABLE image_recognition_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    image_url TEXT NOT NULL,
    predicted_item TEXT,
    confidence DOUBLE PRECISION CHECK (confidence >= 0 AND confidence <= 1),
    quantity_suggested INTEGER,
    matched_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
    matched_item_uuid UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Sample Data

After scanning:
```
id | user_id | image_url                    | predicted_item | confidence | matched_item_id | created_at
1  | 5       | /uploads/image_recognition/... | violin         | 0.95       | 42              | 2025-10-25 10:30:00
2  | 5       | /uploads/image_recognition/... | guitar         | 0.87       | 38              | 2025-10-25 10:31:00
```

## API Endpoints

### Health Check
```bash
GET /api/image-recognition/health
```

Response:
```json
{
  "status": "healthy",
  "ai_service": {
    "url": "http://127.0.0.1:8000",
    "status": "healthy",
    "model_loaded": true,
    "classes": ["violin", "guitar", "drums", ...]
  }
}
```

### Scan Image
```bash
POST /api/image-recognition/scan
Content-Type: multipart/form-data

image: <binary image data>
```

Response (Success):
```json
{
  "type": "success",
  "message": "Detected 2 instrument(s)",
  "count": 2,
  "predictions": [
    {
      "class_name": "violin",
      "confidence": 0.95,
      "matched_item_id": 42,
      "matched_item_name": "Violin - Classical",
      "bbox": { "x1": 100, "y1": 50, "x2": 300, "y2": 400 }
    },
    {
      "class_name": "guitar",
      "confidence": 0.87,
      "matched_item_id": 38,
      "matched_item_name": "Acoustic Guitar",
      "bbox": { "x1": 320, "y1": 100, "x2": 450, "y2": 350 }
    }
  ]
}
```

Response (No Items):
```json
{
  "type": "no_items",
  "message": "No musical instruments detected in image",
  "predictions": [],
  "count": 0
}
```

### Get Scan History
```bash
GET /api/image-recognition/history
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "count": 15,
  "history": [
    {
      "id": 1,
      "user_id": 5,
      "image_url": "/uploads/image_recognition/...",
      "predicted_item": "violin",
      "confidence": 0.95,
      "matched_item_id": 42,
      "created_at": "2025-10-25T10:30:00"
    }
    ...
  ]
}
```

## Configuration

### Environment Variables

**Server (.env)**
```bash
# AI Service Configuration
AI_SERVICE_URL=http://127.0.0.1:8000
```

**Client (.env)**
```bash
VITE_AI_SERVICE_URL=http://127.0.0.1:8000
```

### AI Service Configuration (FastAPI)

Edit `server/Musical_Instrument_Model/local_deployment/main.py` to adjust:

```python
# Confidence threshold for predictions
results = model(image_np, conf=0.50)  # 50% confidence threshold

# Model selection
model_files = [
    "best.pt",  # Trained model (priority)
    "last.pt",  # Last checkpoint
    "yolov8s.pt",  # Fallback
]
```

## Troubleshooting

### "AI service unavailable" error

**Solution:**
1. Ensure FastAPI server is running:
   ```bash
   cd server/Musical_Instrument_Model/local_deployment
   run.bat
   ```

2. Check if port 8000 is already in use:
   ```powershell
   netstat -ano | findstr :8000
   ```

3. Kill the process if needed:
   ```powershell
   taskkill /PID <process_id> /F
   ```

### "No instruments detected" 

**Solutions:**
- Improve lighting conditions
- Get closer to the instrument
- Ensure the instrument is clearly visible
- Try different angles or camera

### YOLO Model not loading

**Solutions:**
1. Check if `best.pt` exists in:
   ```
   server/Musical_Instrument_Model/best.pt
   ```

2. If missing, check alternative paths in `main.py`

3. Ensure you have sufficient disk space (models are ~100-300MB)

### Database not saving records

**Solutions:**
1. Verify `image_recognition_data` table exists
2. Check user is authenticated (user_id should not be null)
3. Verify image path is writable:
   ```bash
   server/uploads/image_recognition/
   ```

## Performance Optimization

### For Faster Inference

Reduce image size before sending:
```javascript
// In MusicInstrumentScanner.jsx
const canvas = document.createElement("canvas");
canvas.width = 640;  // Reduce from 1280
canvas.height = 480; // Reduce from 720
```

### For Batch Processing

Use the batch endpoint for multiple images:
```bash
POST /api/image-recognition/scan/batch
Content-Type: multipart/form-data

images: <multiple image files>
```

### Caching Frequent Scans

The system automatically saves all scans to `image_recognition_data` for future reference and analytics.

## Security Notes

- Only authenticated users can scan and access history
- Images are stored server-side with user attribution
- Confidence scores help validate predictions
- Batch scanning limited to staff/admin roles

## Future Enhancements

1. **Fine-tuning**: Train model on your specific instruments
2. **Batch Processing**: Queue long image processing jobs
3. **Caching**: Cache frequent predictions
4. **Analytics**: Dashboard showing most frequently detected instruments
5. **Multi-language**: Support for instrument names in different languages
6. **Mobile App**: Native iOS/Android integration

## References

- YOLO Documentation: https://docs.ultralytics.com/
- FastAPI: https://fastapi.tiangolo.com/
- Multer (File Upload): https://github.com/expressjs/multer
