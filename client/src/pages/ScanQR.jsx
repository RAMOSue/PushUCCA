// src/pages/ScanQR.jsx
import { useEffect, useRef, useState, useContext, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import { BorrowingContext } from "../../context/borrowingContext";
import { UserContext } from "../../context/userContext";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { Camera, RotateCw, ShoppingCart, RefreshCcw } from "lucide-react";

const GLOBAL_SCAN_COOLDOWN_MS = 750;
const PER_CODE_COOLDOWN_MS = 3000;

export default function ScanQR() {
  const [lastScannedItem, setLastScannedItem] = useState(null);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState(null);

  const html5QrcodeRef = useRef(null);
  const scannerRunningRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const scannedCodesRef = useRef(new Map());
  const lastGlobalScanRef = useRef(0);
  const cartRef = useRef([]);
  const userRef = useRef(null);
  const videoTrackRef = useRef(null);

  // AI assist: auto-brightness / auto-darken and autofocus attempts
  const [aiAssistEnabled, setAiAssistEnabled] = useState(true);
  const analyzeIntervalRef = useRef(null);

  const { cart, addToCart, requestId, setRequestId } = useContext(BorrowingContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // ✅ Initialize borrowing session
  useEffect(() => {
    const initBorrowingSession = async () => {
      if (!requestId && userRef.current?.id) {
        try {
          const res = await axios.post("/api/borrow/start", {
            borrower_id: userRef.current.id,
          });
          setRequestId(res.data.borrowingId || res.data.request_id || null);
          console.log("✅ Borrowing session started:", res.data.borrowingId || res.data.request_id);
        } catch {
          toast.error("❌ Cannot start borrowing session.");
        }
      }
    };
    initBorrowingSession();
  }, [requestId, setRequestId]);

  const computeQrbox = useCallback(() => {
    const el = document.getElementById("qr-root");
    if (!el) return 250;
    const size = Math.min(el.offsetWidth, el.offsetHeight || el.offsetWidth) * 0.8;
    return Math.max(200, Math.min(size, 400));
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
        toast.success(`✅ "${data.name}" added from AI scan`);
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
      videoTrackRef.current.stop();
      videoTrackRef.current = null;
    }
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
          toast.success(`✅ "${data.name}" added to cart`);
        }

        setLastScannedItem({
          type,
          name: data.name,
          category: data.category || "—",
          size: data.size || "N/A",
          status: data.status || "Unknown",
        });
        setError("");
      } catch (err) {
        console.error("Scan error:", err?.response?.data || err.message);
        setError("❌ Item not found or server error.");
        setLastScannedItem(null);
        // Optional: trigger fallback here as well
        // await handleImageScanFallback();
      }
    },
    [addToCart, requestId, handleImageScanFallback]
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
        aspectRatio: window.innerHeight / window.innerWidth,
        disableFlip: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      };

      try {
        await inst.start(
          cameraId ? { deviceId: { exact: cameraId } } : { facingMode: "environment" },
          config,
          onScanSuccess
        );
        scannerRunningRef.current = true;

        const videoEl = container.querySelector("video");
        if (videoEl) {
          videoTrackRef.current = videoEl.srcObject?.getVideoTracks?.()[0] || null;
          videoEl.style.width = "100%";
          videoEl.style.height = "100%";
          videoEl.style.objectFit = "cover";
          videoEl.style.borderRadius = "0.75rem";
          // Start AI assist analysis loop
          startAnalysisLoop();
        }
      } catch (err) {
        console.error("Failed to start scanner:", err);
        setError("❌ Unable to access camera. Check permissions.");
      } finally {
        setIsStarting(false);
      }
    },
    [computeQrbox, onScanSuccess, stopScanner]
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
    await stopScanner();
    await startScanner(activeCameraId);
    // Optional: trigger fallback immediately on retry if camera fails
    // await handleImageScanFallback();
  };

  const handleSwitchCamera = async () => {
    if (!cameraDevices.length) return;
    const idx = cameraDevices.findIndex((d) => d.id === activeCameraId);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % cameraDevices.length;
    const nextId = cameraDevices[nextIdx].id;
    setActiveCameraId(nextId);
    await stopScanner();
    await startScanner(nextId);
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-white relative pb-24 px-3 sm:px-6">
      <div className="flex justify-between items-center mt-3 mb-2">
        <h2 className="text-base sm:text-lg font-bold text-blue-600">Scan Items</h2>
        <button
          onClick={() => {
            stopScanner();
            navigate("/borrow-cart");
          }}
          className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-md text-sm"
        >
          <ShoppingCart size={16} /> Cart
        </button>
      </div>

      {isStarting && (
        <div className="text-center text-gray-500 my-3 text-sm">Starting camera…</div>
      )}

      <div
        id="qr-root"
        className="w-full h-[60vh] max-h-[420px] bg-gray-100 rounded-lg overflow-hidden flex justify-center items-center"
      ></div>

      {lastScannedItem && (
        <div className="mt-3 p-3 bg-green-100 rounded text-xs sm:text-sm">
          <h3 className="font-bold text-green-700 mb-1">Last Scanned:</h3>
          <p>
            <strong>Name:</strong> {lastScannedItem.name}
          </p>
          <p>
            <strong>Category:</strong> {lastScannedItem.category}
          </p>
          <p>
            <strong>Size:</strong> {lastScannedItem.size}
          </p>
          <p>
            <strong>Status:</strong> {lastScannedItem.status}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 bg-red-100 text-red-700 rounded text-xs sm:text-sm">
          <div>{error}</div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md flex justify-around py-2 sm:py-3">
        <button
          onClick={handleRetry}
          className="flex flex-col items-center text-blue-600 text-xs"
        >
          <RefreshCcw size={20} />
          <span>Retry</span>
        </button>
        <button
          onClick={() => setAiAssistEnabled((v) => !v)}
          className={`flex flex-col items-center text-xs ${aiAssistEnabled ? 'text-green-600' : 'text-gray-600'}`}
          title="Toggle AI assist (auto-brightness / autofocus)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-sliders">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
          </svg>
          <span>{aiAssistEnabled ? 'AI On' : 'AI Off'}</span>
        </button>
        {cameraDevices.length > 1 && (
          <button
            onClick={handleSwitchCamera}
            className="flex flex-col items-center text-gray-600 text-xs"
          >
            <RotateCw size={20} />
            <span>Switch</span>
          </button>
        )}
        <button
          onClick={() => navigate("/borrow-cart")}
          className="flex flex-col items-center text-gray-700 text-xs"
        >
          <ShoppingCart size={20} />
          <span>Cart</span>
        </button>
        <button
          onClick={() => navigate(-1)}
          className="flex flex-col items-center text-gray-600 text-xs"
        >
          <Camera size={20} />
          <span>Exit</span>
        </button>
      </div>
    </div>
  );
}
