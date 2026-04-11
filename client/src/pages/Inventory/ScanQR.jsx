// src/pages/Inventory/ScanQR.jsx
import { useEffect, useRef, useState, useContext, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import { BorrowingContext } from "../../../context/borrowingContext";
import { UserContext } from "../../../context/userContext";
import { SidebarContext } from "../../../context/SidebarContext";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Camera, RotateCw, RefreshCw, AlertCircle, Trash2 } from "lucide-react";
import AddToCartModal from "../../components/modals/AddToCartModal";
import BorrowPhotoCaptureModal from "../../components/modals/BorrowPhotoCaptureModal";

const GLOBAL_SCAN_COOLDOWN_MS = 750;
const PER_CODE_COOLDOWN_MS = 3000;

export default function ScanQR() {
  const [lastScannedItem, setLastScannedItem] = useState(null);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(true);
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const [addedItemName, setAddedItemName] = useState("");
  const [scanHistory, setScanHistory] = useState([]);
  const [scanFlash, setScanFlash] = useState(false); // ✅ STEP 6.2: Scan flash effect

  const html5QrcodeRef = useRef(null);
  const scannerRunningRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const scannedCodesRef = useRef(new Map());
  const lastGlobalScanRef = useRef(0);
  const cartRef = useRef([]);
  const userRef = useRef(null);
  const videoTrackRef = useRef(null);
  const overlayRef = useRef(null);
  const scrollRef = useRef(null); // ✅ STEP 6.3: Auto-scroll receipt

  const [aiAssistEnabled, setAiAssistEnabled] = useState(true);
  const analyzeIntervalRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);

  const { cart, addToCart, removeFromCart, requestId, setRequestId, submitBorrowRequest, refreshAvailableItemsFromServer } = useContext(BorrowingContext);
  const { user } = useContext(UserContext);
  const { setSidebarOpen } = useContext(SidebarContext);
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Cashier beep sound function
  const playBeepSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Beep parameters: high pitch, short duration
      oscillator.frequency.value = 800; // 800 Hz
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (err) {
      console.warn('Beep sound not supported:', err.message);
    }
  }, []);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // ✅ Initialize borrowing session
  useEffect(() => {
    const initBorrowingSession = async () => {
      if (!requestId) {
        try {
          const res = await axios.post("/api/borrow/start");
          setRequestId(res.data.borrowingId || res.data.request_id || null);
          console.log("✅ Borrowing session started:", res.data.borrowingId || res.data.request_id);
        } catch (err) {
          console.error("❌ Borrowing session error:", err.response?.data || err.message);
          toast.error("❌ Cannot start borrowing session.");
        }
      }
    };
    initBorrowingSession();
  }, [requestId, setRequestId]);

  const computeQrbox = useCallback(() => {
    const el = document.getElementById("qr-root");
    if (!el) return 250;
    // Calculate qrbox based on container - use smaller of width/height
    // For a 2/3 width container (left panel), with 16:9 aspect ratio
    const width = el.offsetWidth || 500;
    const height = el.offsetHeight || 500;
    const size = Math.min(width, height) * 0.6; // Use 60% of smallest dimension
    return Math.max(180, Math.min(size, 350));
  }, []);

  const normalizeScanPayload = (raw) => {
    const type =
      raw?.type ||
      (raw?.unit_id || raw?.inventory_unit_id ? "unit" : "item");
    const data = raw?.data || raw || {};
    const unitId = data.unit_id || data.inventory_unit_id || data.id || null;
    const itemId = data.item_id || data.id || unitId;
    const itemName =
      type === "unit" ? data.item_name || data.name : data.name || data.item_name;
    return {
      type,
      data: {
        unit_id: unitId,
        item_id: itemId,
        name: itemName,
        category: data.category ?? null,
        size: data.size ?? null,
        status: data.status ?? null,
        garment_type: data.garment_type ?? null,
        qr_code_text: data.qr_code_text ?? null,
        qr_code_url: data.qr_code_url ?? null,
      },
    };
  };

  // Capture a processed frame from the video element applying the same
  // brightness/contrast adjustments we made (so the server gets the enhanced image).
  const captureProcessedFrameAsBlob = useCallback(async (videoEl) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext("2d");

    // Apply current CSS filter (if supported) so the server receives the enhanced frame
    const styleFilter = window.getComputedStyle(videoEl).filter || "";
    try {
      ctx.filter = styleFilter;
    } catch (e) {
      // ignore unsupported filter strings
    }

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    return await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
  }, []);

  // Compute luminance multiplier for auto-brightness adjustments
  const computeLuminanceMultiplier = useCallback((videoEl, sampleSize = 200) => {
    try {
      const canvas = document.createElement("canvas");
      const w = Math.min(videoEl.videoWidth || 640, sampleSize);
      const h = Math.min(videoEl.videoHeight || 480, Math.round(sampleSize * (videoEl.videoHeight / (videoEl.videoWidth || 1))));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoEl, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        sum += lum;
        count++;
      }
      const avg = sum / Math.max(1, count);
      const target = 120;
      let mult = target / (avg + 1e-6);
      mult = Math.max(0.6, Math.min(1.6, mult));
      return mult;
    } catch (e) {
      return 1;
    }
  }, []);

  // Attempt to enable continuous focus/exposure/zoom if supported by the camera
  const tryEnableCameraAssists = useCallback(async () => {
    try {
      const track = videoTrackRef.current;
      if (!track) return;
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      const advanced = [];
      if (caps.focusMode && caps.focusMode.includes("continuous")) {
        advanced.push({ focusMode: "continuous" });
      }
      if (caps.exposureMode && caps.exposureMode.includes("continuous")) {
        advanced.push({ exposureMode: "continuous" });
      }
      if (caps.zoom) {
        const min = caps.zoom.min || 1;
        const max = caps.zoom.max || 1;
        const targetZoom = Math.min(max, Math.max(min, (min + max) / 2));
        advanced.push({ zoom: targetZoom });
      }
      if (advanced.length) {
        try {
          await track.applyConstraints({ advanced });
        } catch (e) {
          console.warn("Camera assist constraints failed:", e.message);
        }
      }
    } catch (e) {
      console.warn("tryEnableCameraAssists error:", e.message);
    }
  }, []);

  // Start/stop analysis loop for auto brightness and camera assists
  const startAnalysisLoop = useCallback(() => {
    if (analyzeIntervalRef.current) return;
    analyzeIntervalRef.current = setInterval(() => {
      try {
        const videoEl = document.querySelector("#qr-root video");
        if (!videoEl) return;
        if (!aiAssistEnabled) return;
        const mult = computeLuminanceMultiplier(videoEl);
        videoEl.style.transition = "filter 250ms linear";
        videoEl.style.filter = `brightness(${mult}) contrast(1.05)`;
        tryEnableCameraAssists();
      } catch (e) {
        console.warn("analysis loop error:", e.message);
      }
    }, 900);
  }, [aiAssistEnabled, computeLuminanceMultiplier, tryEnableCameraAssists]);

  const stopAnalysisLoop = useCallback(() => {
    if (analyzeIntervalRef.current) {
      clearInterval(analyzeIntervalRef.current);
      analyzeIntervalRef.current = null;
    }
  }, []);

  // ✅ AI fallback function
  const handleImageScanFallback = useCallback(async () => {
    try {
      const videoEl = document.querySelector("#qr-root video");
      if (!videoEl) return;
      // Capture a processed frame (applies CSS filter via canvas) so the model receives
      // the brightness/contrast-enhanced image.
      const blob = await captureProcessedFrameAsBlob(videoEl);
      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");

      const res = await axios.post("/api/inventory/scan/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const normalized = normalizeScanPayload(res.data);
      const { data } = normalized;
      const uniqueUnitId = data.unit_id || data.item_id;

      if (!cartRef.current.some((c) => c.unitId === uniqueUnitId)) {
        if (!requestId) {
          toast.error("Please wait, setting up borrowing session...");
          return;
        }
        await addToCart({
          unitId: data.unit_id,
          itemId: data.item_id,
          name: data.name,
          size: data.size,
          image_url: data.qr_code_url,
          category: data.category,
          garment_type: data.garment_type,
        });
        
        // Show success modal
        setAddedItemName(data.name);
        setShowAddToCartModal(true);
        
        // Auto-close modal after 2 seconds
        setTimeout(() => {
          setShowAddToCartModal(false);
        }, 2000);
      }

      setLastScannedItem({
        type: data.type || "item",
        name: data.name,
        category: data.category || "—",
        size: data.size || "N/A",
        status: data.status || "Unknown",
      });
      setError("");
    } catch (err) {
      console.error("AI scan fallback failed:", err);
      toast.error("❌ Unable to detect QR via AI model.");
    }
  }, [addToCart, requestId]);

  const stopScanner = useCallback(async () => {
    const inst = html5QrcodeRef.current;
    if (inst && scannerRunningRef.current) {
      try {
        await inst.stop();
      } catch (e) {
        console.warn("Stop warning:", e.message);
      }
      try {
        await inst.clear();
      } catch (e) {
        console.warn("Clear warning:", e.message);
      }
    }
    scannerRunningRef.current = false;
    html5QrcodeRef.current = null;

    if (videoTrackRef.current) {
      try {
        videoTrackRef.current.stop();
      } catch (e) {
        console.warn("Video track stop warning:", e.message);
      }
      videoTrackRef.current = null;
    }
    
    // Give the browser time to release the camera resource
    await new Promise(resolve => setTimeout(resolve, 500));
  }, []);

  const onScanSuccess = useCallback(
    async (decodedText) => {
      const now = Date.now();
      if (now - lastGlobalScanRef.current < GLOBAL_SCAN_COOLDOWN_MS) return;
      lastGlobalScanRef.current = now;

      const cleanQR = decodeURIComponent(decodedText).trim();
      const prevTime = scannedCodesRef.current.get(cleanQR);
      if (prevTime && now - prevTime < PER_CODE_COOLDOWN_MS) return;
      scannedCodesRef.current.set(cleanQR, now);

      try {
        let res;
        try {
          res = await axios.get(
            `/api/inventory/scan/text/${encodeURIComponent(cleanQR)}`
          );
        } catch (e) {
          if (e?.response?.status === 404) {
            try {
              res = await axios.get(
                `/api/inventory/scan/flexible/${encodeURIComponent(cleanQR)}`
              );
            } catch (err) {
              // If both fail, trigger AI fallback
              await handleImageScanFallback();
              return;
            }
          } else throw e;
        }

        const normalized = normalizeScanPayload(res.data);
        const { type, data } = normalized;
        const uniqueUnitId = data.unit_id || data.item_id;

        if (!cartRef.current.some((c) => c.unitId === uniqueUnitId)) {
          if (!requestId) {
            toast.error("Please wait, setting up borrowing session...");
            return;
          }
          if (data.status && data.status.toLowerCase() !== "available") {
            toast.error(`❌ "${data.name}" is not available.`);
            return;
          }
          await addToCart({
            unitId: data.unit_id,
            itemId: data.item_id,
            name: data.name,
            size: data.size,
            image_url: data.qr_code_url,
            category: data.category,
            garment_type: data.garment_type,
          });
          
          // Show success modal
          setAddedItemName(data.name);
          setShowAddToCartModal(true);
          
          // Auto-close modal after 2 seconds
          setTimeout(() => {
            setShowAddToCartModal(false);
          }, 2000);
        }

        setLastScannedItem({
          type,
          name: data.name,
          category: data.category || "—",
          size: data.size || "N/A",
          status: data.status || "Unknown",
        });
        // ✅ STEP 6.2: Add scan flash effect
        setScanFlash(true);
        setTimeout(() => setScanFlash(false), 300);
        // ✅ STEP 6.1: Play cashier beep sound
        playBeepSound();
        // ✅ STEP 6.3: Auto-scroll receipt to bottom
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 0);
        // ✅ NEW: Add to scan history
        setScanHistory(prev => [data.name, ...prev.slice(0, 4)]);
        setError("");
      } catch (err) {
        console.error("Scan error:", err?.response?.data || err.message);
        setError("❌ Item not found or server error.");
        setLastScannedItem(null);
        // Optional: trigger fallback here as well
        // await handleImageScanFallback();
      }
    },
    [addToCart, requestId, handleImageScanFallback, playBeepSound]
  );

  const startScanner = useCallback(
    async (cameraId) => {
      if (scannerRunningRef.current || isUnmountedRef.current) return;

      await stopScanner();

      setIsStarting(true);
      setError("");
      const container = document.getElementById("qr-root");
      if (container) container.innerHTML = "";

      const inst = new Html5Qrcode("qr-root", { verbose: false });
      html5QrcodeRef.current = inst;

      const config = {
        fps: 15,
        qrbox: computeQrbox(),
        // ✅ FIXED: Correct aspect ratio calculation (width/height not height/width)
        // For a 16:9 landscape video feed
        aspectRatio: 16 / 9,
        disableFlip: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      };

      try {
        // Add a small delay before starting to ensure camera is fully released
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // ✅ FIXED: Use flexible camera constraints that don't force zoom
        const constraints = cameraId 
          ? { deviceId: { exact: cameraId } } 
          : { 
              facingMode: "environment",
              // Prefer wide-angle (not zoomed)
              width: { ideal: 1280 },
              height: { ideal: 720 }
            };
        
        await inst.start(
          constraints,
          config,
          onScanSuccess
        );
        scannerRunningRef.current = true;

        const videoEl = container.querySelector("video");
        if (videoEl) {
          videoTrackRef.current = videoEl.srcObject?.getVideoTracks?.()[0] || null;
          // ✅ FIXED: Use 'contain' instead of 'cover' to prevent zoom/cropping
          videoEl.style.width = "100%";
          videoEl.style.height = "100%";
          videoEl.style.objectFit = "contain";  // ✅ Changed from 'cover' to 'contain'
          videoEl.style.borderRadius = "0.75rem";
          videoEl.style.backgroundColor = "#000";
          // Start AI assist analysis loop
          startAnalysisLoop();
        }
      } catch (err) {
        console.error("Failed to start scanner:", err);
        setError("❌ Unable to access camera. Check permissions or try another camera.");
        scannerRunningRef.current = false;
        html5QrcodeRef.current = null;
      } finally {
        setIsStarting(false);
      }
    },
    [computeQrbox, onScanSuccess, stopScanner, startAnalysisLoop]
  );

  useEffect(() => {
    if (location.pathname !== "/scan") return;
    isUnmountedRef.current = false;

    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await Html5Qrcode.getCameras();
        if (!devices.length) throw new Error("No cameras found.");
        setCameraDevices(devices);

        let preferred =
          devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[0];
        if (preferred) {
          setActiveCameraId(preferred.id);
          // Auto-detect if preferred camera is front-facing
          const isFront = /front|user|facing|internal/i.test(preferred.label);
          setIsFrontCamera(isFront);
          setIsFlipped(isFront); // Auto-flip if front camera
          await startScanner(preferred.id);
        }
      } catch (err) {
        console.error("Camera enumeration failed:", err);
        setError("❌ Cannot access camera. Check permissions.");
      }
    })();

    return () => {
      isUnmountedRef.current = true;
      stopScanner();
      stopAnalysisLoop();
    };
  }, [location.pathname, startScanner, stopScanner]);

  const handleRetry = async () => {
    setError("");
    await stopScanner();
    // Wait a bit before restarting
    await new Promise(resolve => setTimeout(resolve, 300));
    await startScanner(activeCameraId);
  };

  const handleSwitchCamera = async () => {
    if (!cameraDevices.length) return;
    const idx = cameraDevices.findIndex((d) => d.id === activeCameraId);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % cameraDevices.length;
    const nextDevice = cameraDevices[nextIdx];
    const nextId = nextDevice.id;
    setActiveCameraId(nextId);
    // Auto-detect if next camera is front-facing
    const isFront = /front|user|facing|internal/i.test(nextDevice.label);
    setIsFrontCamera(isFront);
    setIsFlipped(isFront); // Auto-flip if front camera
    setError("");
    await stopScanner();
    // Wait before starting new camera
    await new Promise(resolve => setTimeout(resolve, 300));
    await startScanner(nextId);
  };

  // ✅ Submit borrow request directly from scanner
  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setSubmitting(true);
    try {
      // ✅ Use same submitBorrowRequest as BorrowCart with skipNavigation
      const result = await submitBorrowRequest({ skipNavigation: true });
      if (result?.request_id) {
        setCurrentRequestId(result.request_id);
      } else if (requestId) {
        setCurrentRequestId(requestId);
      }
      // Refresh available items after successful submission
      await refreshAvailableItemsFromServer();
      // Open camera modal after successful submission
      setPhotoCaptureOpen(true);
      setSubmitting(false);
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Failed to submit request. Please try again.");
      setSubmitting(false);
    }
  };

  const handlePhotosCaptured = (photos) => {
    toast.success(`✅ ${photos.length} photo(s) captured successfully!`);
    // Navigate back to previous page and re-enable sidebar
    setSidebarOpen(true);
    navigate(-1);
  };

  const handlePhotosSkipped = () => {
    // Allow user to skip photos and go back to previous page
    setSidebarOpen(true);
    navigate(-1);
  };

  return (
    <>
      {/* ✅ STEP 6: Global CSS for scan animation */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(280px); }
        }
      `}</style>

      {/* ✅ STEP 1: 70/30 Split Layout */}
      <div className="h-screen flex bg-gray-100 gap-4 p-4">
        
        {/* LEFT (70%): SCANNER - Cashier Device Feel */}
        <div className="w-[70%] flex flex-col gap-4">
          
          {/* ✅ STEP 2.1: Scanner Container with Hardware Feel */}
          <div className="bg-black rounded-xl h-full relative overflow-hidden shadow-2xl border-4 border-gray-800">
            
            {/* Scan Field Container */}
            <div
              id="qr-root"
              ref={overlayRef}
              className="w-full h-full"
              style={{
                transform: isFlipped ? "scaleX(-1)" : "scaleX(1)",
              }}
            />

            {/* ✅ STEP 2.2: Green Scan Frame */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-72 border-4 border-green-400 rounded-lg relative">
                {/* ✅ STEP 2.3: Animated Scan Line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-green-400 animate-[scan_2s_linear_infinite]" style={{
                  animation: 'scan 2s linear infinite'
                }} />
                {/* Pulsing inner border */}
                <div className="absolute inset-0 border border-green-300 rounded-lg animate-pulse" />
              </div>
            </div>

            {/* ✅ STEP 2.4: Live Scanner Status */}
            <div className="absolute top-3 left-3 bg-black/70 text-green-400 px-3 py-1 rounded text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              SCANNING ACTIVE
            </div>

            {/* ✅ STEP 6.2: Scan Flash Effect */}
            {scanFlash && (
              <div className="absolute inset-0 bg-green-400/30 animate-pulse pointer-events-none rounded-xl" />
            )}

            {/* Starting Overlay */}
            {isStarting && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded-xl">
                <div className="flex flex-col items-center gap-3">
                  <RotateCw className="animate-spin text-green-400" size={40} />
                  <p className="text-white font-medium">Starting camera...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT (30%): RECEIPT PANEL - POS Style */}
        <div className="w-[30%] flex flex-col gap-3 bg-white rounded-xl shadow-lg overflow-hidden">
          
          {/* ✅ STEP 3.1: Receipt Header with Date */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 font-bold text-center">
            <p className="text-lg">🧾 BORROW RECEIPT</p>
            <p className="text-xs mt-1 opacity-90">{new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>

          {/* Scrollable Receipt Content */}
          <div className="flex-1 overflow-y-auto px-4" ref={scrollRef}>
            
            {/* ✅ STEP 3.2: Last Scanned Highlight */}
            {lastScannedItem && (
              <div className="bg-green-50 border-2 border-green-400 p-3 rounded mb-3">
                <p className="text-xs text-green-700 font-bold">✓ LAST SCANNED</p>
                <p className="font-bold text-green-900 text-sm">{lastScannedItem.name}</p>
                {lastScannedItem.size !== "N/A" && (
                  <p className="text-xs text-green-700">Size: {lastScannedItem.size}</p>
                )}
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border-2 border-red-400 p-3 rounded mb-3">
                <p className="text-xs text-red-700 font-bold">⚠ ERROR</p>
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            )}

            {/* ✅ STEP 3.3: Receipt Line Items */}
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm font-medium">No items yet</p>
                <p className="text-xs mt-1">Start scanning...</p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Header */}
                <div className="flex justify-between border-b border-gray-300 pb-2 text-xs font-bold text-gray-700 sticky top-0 bg-white">
                  <span>ITEM</span>
                  <span>SIZE</span>
                </div>
                {/* Items */}
                {cart.map((item, idx) => (
                  <div key={item.unitId} className="flex justify-between items-center text-xs border-b border-gray-200 py-1 hover:bg-gray-50 group">
                    <span className="truncate flex-1 font-medium text-gray-900">{idx + 1}. {item.name}</span>
                    <div className="flex items-center gap-1 ml-2">
                      <span className="text-gray-500">{item.size || "—"}</span>
                      <button
                        onClick={() => {
                          removeFromCart(item.unitId);
                          toast.success(`Removed ${item.name}`);
                        }}
                        className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ✅ STEP 3.4: Total Items Footer */}
          <div className="border-t-2 border-gray-300 px-4 py-3">
            <div className="flex justify-between font-bold text-lg text-gray-900">
              <span>TOTAL ITEMS</span>
              <span className="text-blue-600">{cart.length}</span>
            </div>
          </div>

          {/* ✅ STEP 4: Compact Status Bar */}
          <div className="bg-gray-800 text-white text-xs px-4 py-2 flex justify-between font-semibold">
            <span>🟢 Camera</span>
            <span>{aiAssistEnabled ? "⚡ AI" : "○ AI Off"}</span>
            <span>📦 {cart.length}</span>
          </div>

          {/* ✅ STEP 5: Controls Grid at Bottom */}
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            <button
              onClick={handleRetry}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold text-sm transition shadow-lg"
              title="Retry scan"
            >
              🔄 Scan
            </button>
            <button
              onClick={handleSwitchCamera}
              disabled={cameraDevices.length <= 1}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white py-2 rounded font-bold text-sm transition shadow-lg"
              title="Switch camera"
            >
              📷 Switch
            </button>
            <button
              onClick={() => setAiAssistEnabled(!aiAssistEnabled)}
              className={`text-white py-2 rounded font-bold text-sm transition shadow-lg ${
                aiAssistEnabled
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-gray-600 hover:bg-gray-700"
              }`}
              title="Toggle AI assist"
            >
              {aiAssistEnabled ? "⚡ AI On" : "AI Off"}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
              className="col-span-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 rounded font-bold text-sm transition shadow-lg"
              title="Submit borrow request"
            >
              {submitting ? "⏳ Submitting..." : `✓ Submit Request (${cart.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* Error Modal (Keep for critical errors) */}
      {error && error.includes("Unable to access camera") && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-sm w-full">
            <div className="p-6 text-center">
              <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Camera Error</h2>
              <p className="text-gray-600 text-sm mb-6">{error}</p>
              <button
                onClick={handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal - Shows after successful submission */}
      <BorrowPhotoCaptureModal
        isOpen={photoCaptureOpen}
        requestId={currentRequestId || requestId}
        onClose={() => {
          setPhotoCaptureOpen(false);
          handlePhotosSkipped();
        }}
        onPhotosCaptured={handlePhotosCaptured}
        itemCount={cart.length}
        addToCart={addToCart}
        borrowerId={user?.id}
      />

      {/* Add to Cart Success Modal */}
      <AddToCartModal
        isOpen={showAddToCartModal}
        onClose={() => setShowAddToCartModal(false)}
        itemName={addedItemName}
      />
    </>
  );
}