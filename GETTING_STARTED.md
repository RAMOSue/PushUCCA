# 🎬 Getting Started - Visual Guide

## 🎯 5-Minute Setup

### 1. Open PowerShell (or Command Prompt)
```
Windows Key + R → Type "powershell" → Press Enter
```

### 2. Navigate to Project
```powershell
cd "C:\Users\Runard Ramos\Desktop\LOGINAUTH"
```

### 3. Run Setup Script
```powershell
.\SETUP_IMAGE_RECOGNITION.bat
```
⏱️ **Wait 2-3 minutes** while dependencies install

### 4. Open 3 New PowerShell Windows

#### Window 1️⃣ - AI Service
```powershell
cd "server\Musical_Instrument_Model\local_deployment"
.\run.bat
```

**Expected:**
```
✓ Model loaded successfully!
INFO: Uvicorn running on http://127.0.0.1:8000
```

#### Window 2️⃣ - Backend Server
```powershell
cd "server"
npm start
```

**Expected:**
```
✅ Database connected successfully
🚀 Server running at http://localhost:8000
```

#### Window 3️⃣ - Frontend App
```powershell
cd "client"
npm run dev
```

**Expected:**
```
➜  Local:   http://localhost:5173/
```

---

## ✅ Verification

### Check Status
```powershell
.\CHECK_STATUS.bat
```

Should show:
- ✅ Node.js: v14.0.0+
- ✅ Python: 3.8.0+
- ✅ form-data found
- ✅ axios found
- ✅ fastapi found
- ✅ PostgreSQL port 5432 listening

---

## 🎵 Use the Scanner

### Step 1: Login
```
1. Open http://localhost:5173
2. Login with borrower credentials
```

### Step 2: Navigate to Scanner
```
Option A: Click "Scanner" button in navigation
Option B: Go to http://localhost:5173/scanner
```

### Step 3: Verify AI Service
```
Green indicator ✅ = Ready to scan
Yellow indicator ⚠️ = Check Terminal 1
```

### Step 4: Choose Mode

#### 📷 Camera Mode
```
1. Click "Camera Scan" tab
2. Grant camera permission (browser will ask)
3. Click "Scan Now" to capture frame
   OR
   Click "Auto Scan" for every 3 seconds
4. Wait for processing (spinner shows)
5. View results!
```

#### 📤 Upload Mode
```
1. Click "Upload Image" tab
2. Drag-drop image or click to select
3. File must be: JPG, PNG, < 5MB
4. Wait for processing
5. View results!
```

### Step 5: Results
```
Green box = Item matched ✓ In Cart
Orange box = Item detected but not in database
```

### Step 6: Review & Borrow
```
1. Check detected items in results
2. Click "Cart" button
3. Review borrowed items
4. Complete borrow request
```

---

## 📊 What Happens Behind the Scenes

```
Your Image
    ↓ (Upload)
Express Server
    ↓ (Forward)
FastAPI AI Service
    ↓ (YOLO Detection)
Results with Confidence %
    ↓ (Match with DB)
Inventory Item Found or Not Found
    ↓ (Save)
image_recognition_data Table
    ↓ (Display)
Your Scanner Results
```

---

## 🎯 Example Flow

### Scenario: Scanning a Violin

1. **You**: Capture camera frame showing violin
2. **AI Service**: Detects "violin" with 95% confidence
3. **Express Server**: Searches database for violin
4. **Database**: Finds "Violin - Classical" (ID 42)
5. **Database**: Saves detection record
6. **Frontend**: Shows:
   ```
   ✓ Violin - Classical
   📊 95% confidence
   ✓ In Cart
   ```
7. **Borrowing Cart**: Auto-added with confidence score
8. **You**: Review and complete borrow

### Scenario: Unmatched Item

1. **You**: Capture rare instrument
2. **AI Service**: Detects "exotic_instrument" with 87% confidence
3. **Express Server**: Searches database
4. **Database**: No match found
5. **Frontend**: Shows:
   ```
   ⚠️ exotic_instrument
   📊 87% confidence
   ⚠️ Item not found in inventory
   ```
6. **Your System**: Doesn't add to cart (prevents false borrowing)

---

## 🎬 Walkthrough Video (Text)

```
START
  ↓
[Login Screen]
  ↓
[Dashboard]
     ↓ (Click Scanner)
[Scanner Page]
  ├─→ [Check Health] = Green ✓
  ├─→ [Choose Mode] Camera or Upload
  ├─→ [Capture/Upload] Image
  ├─→ [Processing] (spinner shows)
  ├─→ [Results] Displayed with confidence
  ├─→ [Auto-Add] To cart if matched
  ├─→ [Review] Click Cart button
  ├─→ [Confirm] Complete borrow request
  └─→ [Success] Item borrowed!
END
```

---

## ⚡ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Developer Console | F12 |
| Refresh Page | Ctrl + R |
| Hard Refresh (clear cache) | Ctrl + Shift + R |
| Stop Auto-Capture | Click "Auto Scan" again |
| Switch Camera | Click "Switch Camera" button |

---

## 📱 Mobile Tips

- Rotate phone to landscape for larger preview
- Tap camera area to trigger capture
- Swipe to view results
- Tap item to see details

---

## 🎨 UI Components

### Health Indicator
```
🟢 Green  = AI Service Running
🟡 Yellow = AI Service Down (check Terminal 1)
```

### Confidence Badge
```
95% = Very High Confidence (Trust this result)
75% = High Confidence (Likely correct)
50% = Medium Confidence (Manual review recommended)
```

### Cart Badge
```
✓ Green  = In Cart (Matched & Added)
⚠️ Orange = Warning (Not in inventory, not added)
```

### Processing Indicator
```
⏳ Spinner = Processing image (Wait...)
```

---

## 🔧 Common Actions

### Need to Stop Services?
```
Each Terminal: Press Ctrl + C
```

### Need to Restart AI Service?
```
Terminal 1: Ctrl + C
Then: .\run.bat
Wait for: "Uvicorn running on http://127.0.0.1:8000"
```

### Need to Check Logs?
```
Terminal 1: AI Service logs
Terminal 2: Backend Server logs
Browser F12: Frontend logs
```

### Need to Clear Cache?
```
Browser: Ctrl + Shift + Delete
Select: All time
Click: Clear data
```

---

## ✨ Pro Tips

1. **Better Detections**
   - Use good lighting
   - Show full instrument
   - Get close but not too close
   - Try different angles

2. **Faster Processing**
   - Make sure AI service is running (green indicator)
   - Check internet connection
   - Don't upload huge images (>5MB)

3. **Better Accuracy**
   - Model trained on specific instruments
   - Confidence % shows reliability
   - Unmatched items won't be added to cart
   - Manual review for low confidence items

4. **Troubleshooting**
   - Check all 3 terminals running
   - Check health indicator (green)
   - Check browser console (F12)
   - Check Terminal 1 for AI errors

---

## 📞 Need Help?

### Check Documentation
```
IMAGE_RECOGNITION_SETUP.md     ← Full setup guide
QUICK_START.md                 ← Quick reference
IMPLEMENTATION_SUMMARY.md      ← Technical details
DEPLOYMENT_CHECKLIST.md        ← Testing checklist
```

### Check Logs
```
Terminal 1: AI Service errors
Terminal 2: Backend errors
Browser F12: Frontend errors
```

### Common Issues
```
Issue: "AI service unavailable"
→ Check Terminal 1, run .\run.bat

Issue: "No camera access"
→ Browser settings → Allow camera

Issue: "Port 8000 in use"
→ netstat -ano | findstr :8000
→ taskkill /PID <pid> /F

Issue: "No items detected"
→ Better lighting, clear view of instrument
```

---

## 🎓 Learning Path

### Beginner
1. ✅ Read `QUICK_START.md`
2. ✅ Run the setup script
3. ✅ Start all 3 services
4. ✅ Test camera scanning
5. ✅ Test file upload

### Intermediate
1. ✅ Review `IMPLEMENTATION_SUMMARY.md`
2. ✅ Check database records (PostgreSQL)
3. ✅ Review API endpoints
4. ✅ Monitor logs
5. ✅ Test error scenarios

### Advanced
1. ✅ Read `IMAGE_RECOGNITION_SETUP.md`
2. ✅ Study AI service configuration
3. ✅ Modify confidence threshold
4. ✅ Fine-tune model
5. ✅ Deploy to production

---

## 🎉 Success Indicators

✅ **You're successful when**:
- Green health indicator shows
- Camera captures without errors
- AI processes in 2-5 seconds
- Results display with confidence %
- Items auto-add to cart
- Database records saved
- Can view scan history
- Cart shows borrowed items

---

## 🚀 Next Level

### After Basic Testing

1. **Try Different Instruments**
   - Scan various instruments
   - Notice confidence differences
   - See which work best

2. **Check Database**
   ```sql
   SELECT * FROM image_recognition_data 
   WHERE user_id = <your_id>
   ORDER BY created_at DESC;
   ```

3. **Monitor Performance**
   - Open Task Manager (Ctrl + Shift + Esc)
   - Watch CPU/Memory during scanning
   - Note processing times

4. **Review Logs**
   - Check Terminal 1 for AI insights
   - Check Terminal 2 for matching results
   - Check Browser (F12) for frontend info

### Advanced Configuration

Edit confidence threshold:
```
server/Musical_Instrument_Model/local_deployment/main.py
Change: conf=0.50  (to 0.60 for stricter, 0.30 for looser)
Restart: run.bat
```

---

## 📋 Quick Checklist

Before you start:
- [ ] Node.js installed
- [ ] Python installed  
- [ ] PostgreSQL running
- [ ] All dependencies installed
- [ ] 500MB+ free disk space
- [ ] Camera working
- [ ] 3 terminal windows ready

Ready to go:
- [ ] Terminal 1 running AI service
- [ ] Terminal 2 running backend
- [ ] Terminal 3 running frontend
- [ ] Browser shows login page
- [ ] Can login as borrower
- [ ] Green health indicator

---

## 🎯 Your First Scan

```
1. Login as borrower
2. Navigate to /scanner
3. Check health indicator = Green ✓
4. Click Camera Scan tab
5. Grant camera permission
6. Position instrument in view
7. Click "Scan Now"
8. Wait 3-5 seconds...
9. See results!
10. Check cart for added items
11. Review and borrow!
```

**Estimated time**: 2-3 minutes per scan

---

## 🎊 Congratulations!

You now have a fully functional AI-powered Musical Instrument Scanner! 

🎵 Ready to revolutionize borrowing management! 🎵

---

*For more help, see the documentation files or check the troubleshooting section above.*
