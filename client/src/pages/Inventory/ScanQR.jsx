// src/pages/Inventory/ScanQR.jsx
import { useEffect, useRef, useState, useContext, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import { BorrowingContext } from "../../../context/borrowingContext";
import { UserContext } from "../../../context/userContext";
import { SidebarContext } from "../../context/SidebarContext";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Camera, RotateCw, RefreshCw, AlertCircle, Trash2, ChevronLeft } from "lucide-react";
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
  const [scanFlash, setScanFlash] = useState(false);

  const html5QrcodeRef = useRef(null);
  const scannerRunningRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const scannedCodesRef = useRef(new Map());
  const lastGlobalScanRef = useRef(0);
  const cartRef = useRef([]);
  const userRef = useRef(null);
  const videoTrackRef = useRef(null);
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);
  const startScannerRef = useRef(null);
  const cameraAssistFailedRef = useRef(false);
  const resizeTimeoutRef = useRef(null);
  const lastResizeDimensionsRef = useRef({ width: 0, height: 0 });
  const borrowingSessionInitializedRef = useRef(false);

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

  const playBeepSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
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

  useEffect(() => {
    const initBorrowingSession = async () => {
      if (requestId) {
        console.log("✅ Using existing borrowing session from context:", requestId);
        borrowingSessionInitializedRef.current = true;
        return;
      }

      try {
        console.log("🔄 Starting new borrowing session...");
        const res = await axios.post("/api/borrow/start");
        const newRequestId = res.data.borrowingId || res.data.request_id || null;
        setRequestId(newRequestId);
        borrowingSessionInitializedRef.current = true;
        console.log("✅ New borrowing session started:", newRequestId);
      } catch (err) {
        console.error("❌ Borrowing session error:", err.response?.data || err.message);
        toast.error("❌ Cannot start borrowing session.");
        borrowingSessionInitializedRef.current = false; // Allow retry on error
      }
    };

    // Only initialize once, even if component re-renders or scanner restarts
    if (!borrowingSessionInitializedRef.current && !requestId) {
      initBorrowingSession();
    }
  }, [requestId]);

  const computeQrbox = useCallback(() => {
    const el = document.getElementById("qr-root");
    if (!el) {
      console.warn("⚠️ qr-root not found in computeQrbox");
      return 280;
    }
    
    const width = el.offsetWidth || 400;
    const height = el.offsetHeight || 400;
    const minDimension = Math.min(width, height);
    
    console.log(`📏 computeQrbox: width=${width}, height=${height}, minDimension=${minDimension}`);
    
    const size = minDimension * 0.7;
    const result = Math.max(200, Math.min(size, 400));
    
    console.log(`📏 QR box calculated: ${result}px (from ${size}px)`);
    return result;
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

  const captureProcessedFrameAsBlob = useCallback(async (videoEl) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext("2d");

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

  const tryEnableCameraAssists = useCallback(async () => {
    try {
      if (cameraAssistFailedRef.current) return;

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
          cameraAssistFailedRef.current = true;
          console.warn("⚠️ Camera assist constraints failed (will not retry):", e.message);
        }
      }
    } catch (e) {
      cameraAssistFailedRef.current = true;
      console.warn("⚠️ Camera assist unavailable (will not retry):", e.message);
    }
  }, []);

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

  const handleImageScanFallback = useCallback(async () => {
    try {
      const videoEl = document.querySelector("#qr-root video");
      if (!videoEl) return;
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
        
        setAddedItemName(data.name);
        setShowAddToCartModal(true);
        
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
    console.log("🛑 Stopping scanner...");
    const inst = html5QrcodeRef.current;
    
    if (inst) {
      try {
        console.log("⏹️ Calling inst.stop()...");
        await inst.stop();
        console.log("✅ inst.stop() completed");
      } catch (e) {
        console.warn("⚠️ inst.stop() warning:", e.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        console.log("🧹 Calling inst.clear()...");
        await inst.clear();
        console.log("✅ inst.clear() completed");
      } catch (e) {
        console.warn("⚠️ inst.clear() warning:", e.message);
      }
    }
    
    scannerRunningRef.current = false;
    html5QrcodeRef.current = null;
    cameraAssistFailedRef.current = false;
    
    scannedCodesRef.current.clear();
    console.log("🧹 Cleared scanned codes cache");

    if (videoTrackRef.current) {
      try {
        console.log("🎬 Stopping video track...");
        videoTrackRef.current.stop();
        console.log("✅ Video track stopped");
      } catch (e) {
        console.warn("⚠️ Video track stop warning:", e.message);
      }
      videoTrackRef.current = null;
    }
    
    console.log("🧹 Clearing qr-root contents...");
    const container = document.getElementById("qr-root");
    if (container) {
      container.innerHTML = "";
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      console.log("✅ qr-root cleared");
    }
    
    console.log("⏳ Waiting 1500ms for browser to fully release camera resource...");
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log("✅ Camera resource released");
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
          
          setAddedItemName(data.name);
          setShowAddToCartModal(true);
          
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
        setScanFlash(true);
        setTimeout(() => setScanFlash(false), 300);
        playBeepSound();
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 0);
        setScanHistory(prev => [data.name, ...prev.slice(0, 4)]);
        setError("");
      } catch (err) {
        console.error("Scan error:", err?.response?.data || err.message);
        setError("❌ Item not found or server error.");
        setLastScannedItem(null);
      }
    },
    [addToCart, requestId, handleImageScanFallback, playBeepSound]
  );

  const startScanner = useCallback(
    async (cameraId, retryCount = 0) => {
      if (isUnmountedRef.current) {
        console.warn("⚠️ Component unmounted, skipping start");
        return;
      }

      const attemptId = Date.now();
      startScannerRef.current = attemptId;
      const maxRetries = 3;
      
      console.log(
        `🚀 startScanner attempt #${attemptId} (retry: ${retryCount}/${maxRetries}) with cameraId:`,
        cameraId
      );

      if (scannerRunningRef.current) {
        console.warn("⚠️ Scanner already running, stopping first...");
        await stopScanner();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const waitAfterStop = 2000 + retryCount * 1000;
      console.log(`⏳ Waiting ${waitAfterStop}ms for html5-qrcode state machine to fully reset...`);
      await new Promise(resolve => setTimeout(resolve, waitAfterStop));

      if (startScannerRef.current !== attemptId) {
        console.warn("⚠️ Another startScanner call came in, abandoning attempt #", attemptId);
        return;
      }

      setIsStarting(true);
      setError("");

      let container = document.getElementById("qr-root");
      if (!container) {
        await new Promise(resolve => setTimeout(resolve, 200));
        container = document.getElementById("qr-root");
      }

      const containerWidth = container?.offsetWidth || 400;
      const containerHeight = container?.offsetHeight || 400;
      
      const computedAspectRatio = containerWidth / containerHeight;
      
      const config = {
        fps: 15,
        qrbox: computeQrbox(),
        aspectRatio: computedAspectRatio,
        disableFlip: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      };

      console.log("📊 Config computed:", {
        qrbox: config.qrbox,
        containerWidth,
        containerHeight,
        computedAspectRatio: computedAspectRatio.toFixed(2),
      });

      try {
        console.log("⏳ Allowing React to fully mount component...");
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!container) {
          console.error("❌ qr-root element not available");
          throw new Error("qr-root element not available. Component may not be fully rendered. Try refreshing the page.");
        }
        
        console.log(`✅ qr-root element ready with dimensions: ${containerWidth}x${containerHeight}`);
        container.innerHTML = "";
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        
        const waitAfterDomClear = 2000 + retryCount * 1000;
        console.log(`⏳ Waiting ${waitAfterDomClear}ms for html5-qrcode state to fully reset...`);
        await new Promise(resolve => setTimeout(resolve, waitAfterDomClear));

        if (startScannerRef.current !== attemptId) {
          console.warn("⚠️ Another startScanner call came in during reset wait, abandoning attempt #", attemptId);
          return;
        }

        const inst = new Html5Qrcode("qr-root", { verbose: false });
        html5QrcodeRef.current = inst;
        console.log("✅ Html5Qrcode instance created");

        const waitBeforeStart = 500 + retryCount * 500;
        console.log(`⏳ Waiting ${waitBeforeStart}ms before calling inst.start()...`);
        await new Promise(resolve => setTimeout(resolve, waitBeforeStart));

        if (startScannerRef.current !== attemptId) {
          console.warn("⚠️ Another startScanner call came in, abandoning attempt #", attemptId);
          try {
            await inst.stop();
          } catch (e) {
            console.warn("⚠️ Could not stop instance:", e.message);
          }
          return;
        }
        
        let cameraConfig;
        if (cameraId) {
          cameraConfig = cameraId;
          console.log("🎬 Calling inst.start() with cameraId string:", cameraConfig);
        } else {
          cameraConfig = { video: true };
          console.log("🎬 Calling inst.start() with basic video");
        }
        
        try {
          await inst.start(cameraConfig, config, onScanSuccess);
          console.log("✅ Scanner started successfully");
          scannerRunningRef.current = true;
        } catch (constraintErr) {
          const errMsg = constraintErr?.message || String(constraintErr) || "";
          
          if (errMsg.includes("transition") || errMsg.includes("already")) {
            console.error("❌ State machine error detected:", errMsg);
            
            if (retryCount < maxRetries) {
              console.warn(`⚠️ State machine corrupt, retrying (${retryCount + 1}/${maxRetries})...`);
              try {
                await inst.stop();
              } catch {
                // Ignore
              }
              html5QrcodeRef.current = null;
              
              const retryWait = 3000 + retryCount * 2000;
              console.log(`⏳ Waiting ${retryWait}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, retryWait));
              
              if (startScannerRef.current !== attemptId) {
                console.warn("⚠️ Another call came in, abandoning retry");
                return;
              }
              
              return await startScanner(cameraId, retryCount + 1);
            } else {
              throw new Error(`Scanner state machine corrupted after ${retryCount + 1} retries: ${errMsg}. Please refresh the page.`);
            }
          }
          
          console.warn("⚠️ Constraints failed, trying basic video...", errMsg);
          
          try {
            console.log("🎬 Retrying with basic video...");
            await inst.start({ video: true }, config, onScanSuccess);
            console.log("✅ Scanner started successfully with basic video");
            scannerRunningRef.current = true;
          } catch (basicErr) {
            const errorMsg = basicErr?.message || String(basicErr).substring(0, 100) || "Unknown error";
            console.error("❌ Failed even with basic video:", errorMsg);
            console.error("🔍 Full error object:", basicErr);
            throw new Error(`Camera initialization failed: ${errorMsg}`);
          }
        }

        const freshContainer = document.getElementById("qr-root");
        if (freshContainer) {
          const videoEl = freshContainer.querySelector("video");
          if (videoEl) {
            console.log("📺 Configuring video element...");
            
            videoTrackRef.current = videoEl.srcObject?.getVideoTracks?.()[0] || null;
            
            videoEl.style.width = "100%";
            videoEl.style.height = "100%";
            videoEl.style.objectFit = "cover";
            videoEl.style.borderRadius = "0.75rem";
            videoEl.style.backgroundColor = "#000";
            videoEl.style.display = "block";
            
            videoEl.addEventListener('loadedmetadata', () => {
              console.log(`📺 Video stream dimensions: ${videoEl.videoWidth}x${videoEl.videoHeight}`);
            }, { once: true });
            
            console.log("✅ Video element configured");
            
            startAnalysisLoop();
          } else {
            console.warn("⚠️ Video element not found in qr-root");
          }
        } else {
          console.warn("⚠️ qr-root element not found after scanner started");
        }

      } catch (err) {
        const errorMsg = err?.message || String(err) || "Unknown error";
        console.error("❌ Failed to start scanner:", errorMsg);
        console.error("Error object:", err);
        console.error("Error stack:", err?.stack);
        
        let errorHint = "❌ Unable to access camera. Check permissions or try another camera.";
        
        if (errorMsg.includes("DOM") || errorMsg.includes("qr-root") || errorMsg.includes("not found")) {
          errorHint = "❌ Camera container not found. Try refreshing the page.";
        } else if (errorMsg.includes("transition") || errorMsg.includes("already") || errorMsg.includes("corrupted")) {
          errorHint = "❌ Camera state corrupted. Please refresh the page and try again.";
        } else if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission") || errorMsg.includes("permission")) {
          errorHint = "❌ Camera permission denied. Enable camera in browser settings.";
        } else if (errorMsg.includes("NotFoundError")) {
          errorHint = "❌ No camera found. Ensure a camera is connected.";
        } else if (errorMsg.includes("NotReadableError") || errorMsg.includes("already in use")) {
          errorHint = "❌ Camera in use by another app. Close other apps and try again.";
        } else if (errorMsg.includes("InsecureContextError")) {
          errorHint = "❌ Camera requires HTTPS connection.";
        } else if (errorMsg.includes("OverconstrainedError")) {
          errorHint = "❌ Camera doesn't support this resolution. Try switching camera.";
        } else if (errorMsg.includes("AbortError")) {
          errorHint = "❌ Camera operation interrupted. Try refreshing the page.";
        } else if (errorMsg.includes("initialization")) {
          errorHint = "❌ Camera initialization failed. Try refreshing and retrying.";
        }
        
        setError(errorHint);
        toast.error(errorHint);
        scannerRunningRef.current = false;
        html5QrcodeRef.current = null;
      } finally {
        setIsStarting(false);
      }
    },
    [computeQrbox, onScanSuccess, startAnalysisLoop]
  );

  useEffect(() => {
    const isScanPage = location.pathname === "/scan" || location.pathname === "/staff/scan";
    if (!isScanPage) return;
    isUnmountedRef.current = false;

    (async () => {
      try {
        console.log("⏳ Waiting for DOM to be fully ready...");
        await new Promise(resolve => {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
          } else {
            requestAnimationFrame(() => {
              setTimeout(resolve, 100);
            });
          }
        });
        console.log("✅ DOM is ready");

        const qrRoot = document.getElementById("qr-root");
        if (!qrRoot) {
          throw new Error("qr-root element still not available after DOM ready. Page structure may be incorrect.");
        }
        console.log("✅ qr-root element is available");

        console.log("📷 Requesting camera access with relaxed constraints...");
        try {
          await navigator.mediaDevices.getUserMedia({ 
            video: {
              facingMode: { ideal: "environment" },
              width: { min: 320, ideal: 640, max: 1280 },
              height: { min: 240, ideal: 480, max: 720 }
            }
          });
        } catch (e) {
          console.warn("⚠️ Relaxed constraints failed, trying basic video...", e.message);
          try {
            await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (e2) {
            console.warn("⚠️ Basic video also failed:", e2.message);
            throw e;
          }
        }

        console.log("✅ Camera access granted");
        
        let devices = await Html5Qrcode.getCameras();
        console.log("📋 Cameras detected:", devices.length, devices);
        
        if (!devices.length) {
          console.warn("⚠️ First enumeration returned no cameras, retrying after delay...");
          await new Promise(resolve => setTimeout(resolve, 1500));
          devices = await Html5Qrcode.getCameras();
          console.log("📋 Cameras after retry:", devices.length, devices);
        }
        
        if (!devices.length) {
          throw new Error("No cameras detected by Html5Qrcode after retries");
        }
        
        setCameraDevices(devices);

        let preferred =
          devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[0];
        if (preferred) {
          console.log("🎯 Preferred camera selected:", preferred);
          setActiveCameraId(preferred.id);
          const isFront = /front|user|facing|internal/i.test(preferred.label);
          setIsFrontCamera(isFront);
          setIsFlipped(isFront);
          
          console.log("⏳ Waiting before starting scanner...");
          await new Promise(resolve => setTimeout(resolve, 500));
          
          await startScanner(preferred.id);
        }
      } catch (err) {
        console.error("❌ Camera initialization failed:", err);
        const errMsg = err?.message || String(err);
        
        let errorHint = "❌ Cannot access camera. Check permissions.";
        if (errMsg.includes("NotAllowedError") || errMsg.includes("Permission")) {
          errorHint = "❌ Camera permission denied. Please enable camera in browser settings.";
        } else if (errMsg.includes("NotFoundError") || errMsg.includes("no devices")) {
          errorHint = "❌ No camera found on this device.";
        } else if (errMsg.includes("NotReadableError") || errMsg.includes("already in use")) {
          errorHint = "❌ Camera is already in use by another application.";
        } else if (errMsg.includes("InsecureContextError")) {
          errorHint = "❌ Camera requires HTTPS (except localhost).";
        } else if (errMsg.includes("qr-root")) {
          errorHint = "❌ Page layout error. Try refreshing the page.";
        }
        
        setError(errorHint);
      }
    })();

    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      resizeTimeoutRef.current = setTimeout(() => {
        console.log("📐 Resize event debounced, checking scanner...");
        const el = document.getElementById("qr-root");
        if (!el || !html5QrcodeRef.current) return;
        
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        const lastWidth = lastResizeDimensionsRef.current.width;
        const lastHeight = lastResizeDimensionsRef.current.height;
        
        console.log(`📐 Current: ${width}x${height}, Last: ${lastWidth}x${lastHeight}`);
        
        const widthChange = Math.abs(width - lastWidth);
        const heightChange = Math.abs(height - lastHeight);
        
        if (widthChange > 50 || heightChange > 50) {
          console.log(`⚠️ Significant resize detected (Δwidth=${widthChange}, Δheight=${heightChange}), restarting scanner...`);
          lastResizeDimensionsRef.current = { width, height };
          
          stopScanner().then(() => {
            setTimeout(() => {
              if (!isUnmountedRef.current) {
                startScanner(activeCameraId);
              }
            }, 1000);
          });
        } else {
          console.log(`✅ Resize too small, no restart needed (Δwidth=${widthChange}, Δheight=${heightChange})`);
          lastResizeDimensionsRef.current = { width, height };
        }
      }, 500);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isUnmountedRef.current = true;
      window.removeEventListener("resize", handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      
      // Reset borrowing session flag when leaving scan page
      if (location.pathname !== "/scan" && location.pathname !== "/staff/scan") {
        borrowingSessionInitializedRef.current = false;
      }
      
      stopScanner().catch(e => {
        console.warn("⚠️ Error during cleanup stopScanner:", e.message);
      });
      stopAnalysisLoop();
    };
  }, [location.pathname]);

  const handleRetry = async () => {
    console.log("🔄 Retrying camera access...");
    setError("");
    await stopScanner();
    await new Promise(resolve => setTimeout(resolve, 1500));
    await startScanner(activeCameraId);
  };

  const handleSwitchCamera = async () => {
    if (!cameraDevices.length) return;
    const idx = cameraDevices.findIndex((d) => d.id === activeCameraId);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % cameraDevices.length;
    const nextDevice = cameraDevices[nextIdx];
    const nextId = nextDevice.id;
    setActiveCameraId(nextId);
    const isFront = /front|user|facing|internal/i.test(nextDevice.label);
    setIsFrontCamera(isFront);
    setIsFlipped(isFront);
    setError("");
    await stopScanner();
    await new Promise(resolve => setTimeout(resolve, 1500));
    await startScanner(nextId);
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitBorrowRequest({ skipNavigation: true });
      if (result?.request_id) {
        setCurrentRequestId(result.request_id);
      } else if (requestId) {
        setCurrentRequestId(requestId);
      }
      await refreshAvailableItemsFromServer();
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
    setSidebarOpen(true);
    navigate(-1);
  };

  const handlePhotosSkipped = () => {
    setSidebarOpen(true);
    navigate(-1);
  };

  return (
    <>
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(256px); }
        }
      `}</style>

      {/* Mobile-First Layout: Vertical Stack on Mobile, Horizontal on Desktop */}
      <div className="min-h-screen flex flex-col lg:flex-row bg-white gap-0 lg:gap-4 p-0 lg:p-4">
        
        {/* SCANNER SECTION - Full width on mobile, 2/3 on desktop */}
        <div className="w-full lg:w-2/3 flex flex-col gap-0 lg:gap-4 h-screen lg:h-auto p-0 lg:p-0" style={{ maxHeight: "100vh" }}>
          
          {/* Mobile Header - Black and White, Compact */}
          <div className="lg:hidden flex items-center justify-between bg-black rounded-none px-3 py-2 flex-shrink-0">
            <button
              onClick={() => {
                setSidebarOpen(true);
                navigate(-1);
              }}
              className="text-white hover:text-gray-300 transition"
              title="Back"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-white font-semibold text-sm">Scan</span>
            <span className="text-xs text-white bg-gray-700 px-2 py-0.5 rounded-full">{cart?.length || 0}</span>
          </div>

          {/* Camera Container - Maintains square aspect ratio */}
          <div className="bg-black rounded-none lg:rounded-lg flex-1 relative overflow-hidden shadow-lg min-h-64 lg:min-h-0" style={{ aspectRatio: "1", minHeight: "min(100vw, 500px)" }}>
            
            {/* QR Scanner */}
            <div
              id="qr-root"
              ref={overlayRef}
              className="w-full h-full"
              style={{
                transform: isFlipped ? "scaleX(-1)" : "scaleX(1)",
              }}
            />

            {/* Scan Guide Frame - Square */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div 
                className="border-2 lg:border-4 border-white/70"
                style={{
                  width: "min(70vw, 280px)",
                  height: "min(70vw, 280px)",
                  aspectRatio: "1",
                }}
              />
            </div>

            {/* Instruction Text */}
            <div className="absolute top-2 lg:top-6 left-0 right-0 text-center text-white font-semibold text-xs lg:text-sm opacity-80">
              <span>Align QR</span>
            </div>

            {/* Camera Controls - Black and White, Minimal Icons */}
            <div className="absolute bottom-2 lg:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 lg:gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-2 lg:px-3 py-1.5 lg:py-2">
              <button
                onClick={() => {
                  setIsFlipped(!isFlipped);
                  toast.success(!isFlipped ? "Flipped" : "Normal");
                }}
                className="bg-black border border-white text-white p-1.5 lg:p-2 rounded transition hover:bg-gray-800"
                title="Flip"
              >
                <RefreshCw size={14} />
              </button>

              {cameraDevices.length > 1 && (
                <button
                  onClick={handleSwitchCamera}
                  className="bg-black border border-white text-white p-1.5 lg:p-2 rounded transition hover:bg-gray-800"
                  title="Switch"
                >
                  <Camera size={14} />
                </button>
              )}

              <button
                onClick={() => setAiAssistEnabled(!aiAssistEnabled)}
                className={`text-white p-1.5 lg:p-2 rounded transition text-xs font-bold border ${
                  aiAssistEnabled
                    ? "bg-black border-white text-white hover:bg-gray-800"
                    : "bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600"
                }`}
                title="AI"
              >
                ⚡
              </button>
            </div>

            {/* Scan Flash Effect */}
            {scanFlash && (
              <div className="absolute inset-0 bg-green-400/20 pointer-events-none" />
            )}

            {/* Loading Overlay */}
            {isStarting && (
              <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-20">
                <div className="flex flex-col items-center gap-2">
                  <RotateCw className="animate-spin text-white" size={28} />
                  <p className="text-white font-medium text-xs">Starting...</p>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Cart Section - Scrollable, Professional, Black & White */}
          <div className="lg:hidden bg-gray-100 border-t border-gray-300 p-2 flex flex-col flex-shrink-0" style={{ maxHeight: "25vh", minHeight: "80px" }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-gray-800 text-xs font-bold uppercase">Cart</p>
              <span className="text-xs font-semibold text-gray-700 bg-white border border-gray-300 px-2 py-0.5 rounded">{cart?.length || 0}</span>
            </div>
            
            {/* Scrollable Cart Items */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 pr-1">
              {cart && cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.unitId} className="bg-white border border-gray-300 rounded px-2 py-1.5 flex justify-between items-center group hover:bg-gray-50 transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-xs font-medium truncate">{item.name}</p>
                      {item.size && <p className="text-gray-500 text-xs truncate">{item.size}</p>}
                    </div>
                    <button
                      onClick={() => {
                        removeFromCart(item.unitId);
                        toast.success("Removed");
                      }}
                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition ml-1 flex-shrink-0"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center text-xs py-2">No items</p>
              )}
            </div>

            {/* Cart Actions */}
            <div className="mt-1.5 pt-1.5 border-t border-gray-300 flex gap-1">
              <button
                onClick={() => {
                  setSidebarOpen(true);
                  navigate("/borrow-cart");
                }}
                className="flex-1 bg-white border border-gray-300 text-gray-900 text-xs font-semibold py-1.5 rounded transition hover:bg-gray-50"
              >
                View
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || cart.length === 0}
                className="flex-1 bg-black text-white text-xs font-semibold py-1.5 rounded transition hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? "..." : "Submit"}
              </button>
            </div>
          </div>
        </div>

        {/* DESKTOP SIDEBAR - Hidden on mobile */}
        <div className="hidden lg:flex lg:w-1/3 flex-col gap-4 overflow-y-auto max-h-screen">
          
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3">
              <p className="text-red-800 text-xs font-medium">{error}</p>
            </div>
          )}

          {/* Last Scanned Item */}
          {lastScannedItem && (
            <div className="bg-white border-l-4 border-green-600 rounded-lg p-3 shadow-sm">
              <p className="text-gray-600 text-xs uppercase tracking-wider mb-1 font-semibold">Last Scanned</p>
              <p className="text-gray-900 font-bold text-sm">{lastScannedItem.name}</p>
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                <p>Category: <span className="text-gray-900 font-medium">{lastScannedItem.category}</span></p>
                {lastScannedItem.size !== "N/A" && (
                  <p>Size: <span className="text-gray-900 font-medium">{lastScannedItem.size}</span></p>
                )}
                <p className="text-green-700 font-semibold">✓ Added</p>
              </div>
            </div>
          )}

          {/* Cart Panel */}
          <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-sm flex-1 flex flex-col">
            <p className="text-gray-800 text-xs uppercase tracking-wider font-bold mb-2">Borrow Cart</p>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {cart && cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.unitId} className="bg-gray-50 border border-gray-200 rounded p-2 text-xs flex justify-between items-center group hover:bg-gray-100 transition">
                    <div className="flex-1">
                      <p className="text-gray-900 font-medium truncate">{item.name}</p>
                      <p className="text-gray-600 text-xs">{item.size || "—"}</p>
                    </div>
                    <button
                      onClick={() => {
                        removeFromCart(item.unitId);
                        toast.success("Removed");
                      }}
                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center text-xs py-4">No items yet</p>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-300 flex gap-2">
              <button
                onClick={() => {
                  setSidebarOpen(true);
                  navigate("/borrow-cart");
                }}
                className="flex-1 bg-black text-white text-xs font-bold py-1.5 rounded transition hover:bg-gray-800"
              >
                View ({cart?.length || 0})
              </button>
              <button
                onClick={() => {
                  setSidebarOpen(true);
                  navigate(-1);
                }}
                className="flex-1 bg-gray-200 text-gray-900 text-xs font-bold py-1.5 rounded transition hover:bg-gray-300"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Modal */}
      {error && error.includes("Unable to access camera") && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-sm w-full shadow-lg">
            <div className="p-4 text-center">
              <AlertCircle className="mx-auto text-red-600 mb-3" size={40} />
              <h2 className="text-lg font-bold text-gray-900 mb-2">Camera Error</h2>
              <p className="text-gray-700 text-xs mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="w-full bg-black text-white px-4 py-2 rounded font-semibold text-sm transition hover:bg-gray-800"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
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

      {/* Add to Cart Modal */}
      <AddToCartModal
        isOpen={showAddToCartModal}
        onClose={() => setShowAddToCartModal(false)}
        itemName={addedItemName}
      />
    </>
  );
}