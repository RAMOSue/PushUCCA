# Quick Start - Musical Instrument Image Scanner

## ⚡ Start Services (30 seconds)

Open **3 PowerShell terminals** and run these commands in parallel:

### Terminal 1️⃣ - AI Service
```powershell
cd 'server\Musical_Instrument_Model\local_deployment'
.\run.bat
```
✅ Wait for: `Uvicorn running on http://127.0.0.1:8000`

### Terminal 2️⃣ - Backend Server
```powershell
cd server
npm start
```
✅ Wait for: `🚀 Server running at http://localhost:8000`

### Terminal 3️⃣ - Frontend App
```powershell
cd client
npm run dev
```
✅ Opens: http://localhost:5173

## 🎯 Use the Scanner

1. **Login** as a borrower
2. Navigate to `/scanner` (or find Scanner button)
3. Choose mode:
   - 📷 **Camera**: Click "Scan Now" or enable "Auto Scan"
   - 📤 **Upload**: Drag-drop or click to select image

## 🎵 What It Does

1. Captures/uploads image
2. AI analyzes it (YOLO model)
3. Shows detected instruments + confidence %
4. Automatically adds to borrowing cart
5. Saves to database

## ✅ Verify It's Working

Green indicator = ✅ Ready  
Yellow indicator = ⚠️ AI service down (check Terminal 1)

## 📊 Check Detection Results

Visit: `http://localhost:8000/api/image-recognition/docs`  
(API documentation)

## 🐛 Quick Fixes

| Problem | Solution |
|---------|----------|
| Yellow indicator | Start run.bat in Terminal 1 |
| "Camera access denied" | Chrome → Settings → Privacy → Allow camera |
| Port 8000 in use | `taskkill /PID <pid> /F` (from netstat output) |
| No items detected | Better lighting, try different angle |
| Database error | Check PostgreSQL is running |

## 📁 Important Files

```
server/
  ├── controllers/imageRecognitionController.js    ← New
  ├── routes/imageRecognitionRoutes.js             ← New
  ├── Musical_Instrument_Model/
  │   ├── local_deployment/
  │   │   ├── main.py                             ← FastAPI service
  │   │   ├── run.bat                             ← Start AI service
  │   │   └── requirements.txt
  │   └── best.pt                                 ← YOLO model
  └── .env                                         ← Add AI_SERVICE_URL

client/
  └── src/pages/MusicInstrumentScanner.jsx         ← New scanner page
```

## 🔗 Useful URLs

| URL | Purpose |
|-----|---------|
| http://localhost:5173/scanner | Image scanner page |
| http://localhost:5173/borrow-cart | View cart with scanned items |
| http://localhost:8000/api/image-recognition/health | Check AI service status |
| http://localhost:8000/api/image-recognition/docs | API documentation |
| http://127.0.0.1:8000/docs | FastAPI/YOLO documentation |

## 📚 Full Documentation

- Setup guide: `IMAGE_RECOGNITION_SETUP.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Database schema: See `image_recognition_data` table

## 🎓 How It Works

```
User captures image
        ↓
Express receives image
        ↓
Sends to FastAPI YOLO service
        ↓
YOLO detects instruments (95% confident)
        ↓
Express matches with inventory database
        ↓
Saves detection to image_recognition_data table
        ↓
Frontend shows results + adds to cart
```

## 💡 Tips

- **Auto-capture**: Enable to scan every 3 seconds (good for quick scanning)
- **Multiple cameras**: Use "Switch Camera" button if you have multiple cameras
- **Confidence**: Items shown only if >50% confidence threshold
- **Unmatched items**: Green items in cart, orange items not in database
- **History**: All scans saved and visible in the page

## ✨ Key Features

✅ Real-time camera capture  
✅ File upload support  
✅ AI-powered detection  
✅ Inventory matching  
✅ Auto-add to cart  
✅ Confidence scoring  
✅ Detection history  
✅ Multi-camera support  
✅ Mobile responsive  
✅ Database logging  

---

**Ready?** Run the 3 commands in Terminal 1, 2, 3 and start scanning! 🎉
