// client/src/pages/ScanQR.jsx
import {
  useEffect,
  useRef,
  useState,
  useContext,
  useCallback,
} from "react";
import { Html5Qrcode } from "html5-qrcode";
import axios from "axios";
import { BorrowingContext } from "../../context/BorrowingContext";
import { UserContext } from "../../context/userContext";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";

const GLOBAL_SCAN_COOLDOWN_MS = 750;
const PER_CODE_COOLDOWN_MS = 3000;

export default function ScanQR() {
  const [lastScannedItem, setLastScannedItem] = useState(null);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [contrastEnabled, setContrastEnabled] = useState(false);

  const html5QrcodeRef = useRef(null);
  const scannerRunningRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const scannedCodesRef = useRef(new Map());
  const lastGlobalScanRef = useRef(0);
  const cartRef = useRef([]);
  const userRef = useRef(null);
  const videoTrackRef = useRef(null);

  const {
    cart,
    addToCart,
    currentBorrowingId,
    setCurrentBorrowingId,
  } = useContext(BorrowingContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // 🔑 Ensure borrowing session is initialized
  useEffect(() => {
    const initBorrowingSession = async () => {
      try {
        if (!currentBorrowingId && userRef.current?.id) {
          const res = await axios.post("/api/borrow/start", {
            borrower_id: userRef.current.id,
          });
          setCurrentBorrowingId(res.data.borrowingId);
          console.log("✅ Borrowing session started:", res.data.borrowingId);
        }
      } catch (err) {
        console.error("Failed to init borrowing session:", err);
        toast.error("❌ Cannot start borrowing session.");
      }
    };
    initBorrowingSession();
  }, [currentBorrowingId, setCurrentBorrowingId]);

  const computeQrbox = useCallback(() => {
    const el = document.getElementById("qr-root");
    if (!el) return 300;
    const w = el.offsetWidth;
    const h = el.offsetHeight || w;
    const size = Math.min(w, h) * 0.9;
    return Math.max(200, Math.min(size, 500));
  }, []);

  const normalizeScanPayload = (raw) => {
    const type =
      raw?.type || (raw?.unit_id || raw?.inventory_unit_id ? "unit" : "item");
    const data = raw?.data || raw || {};
    const unitId = data.unit_id || data.inventory_unit_id || data.id || null;
    const itemId = data.item_id || data.id || unitId;

    const itemName =
      type === "unit"
        ? data.item_name || data.name
        : data.name || data.item_name;

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
            res = await axios.get(
              `/api/inventory/scan/flexible/${encodeURIComponent(cleanQR)}`
            );
          } else throw e;
        }

        const normalized = normalizeScanPayload(res.data);
        const { type, data } = normalized;
        const uniqueUnitId = data.unit_id || data.item_id;

        const alreadyInCart = cartRef.current.some(
          (c) => c.unitId === uniqueUnitId
        );

        if (!alreadyInCart) {
          if (!currentBorrowingId) {
            console.warn("⚠ BorrowingId not ready yet. Retrying shortly...");
            toast.error("Please wait, setting up borrowing session...");
            return;
          }

          if (data.status && data.status.toLowerCase() !== "available") {
            toast.error(`❌ "${data.name}" is not available (status: ${data.status}).`);
            return;
          }

          try {
            await addToCart(
              {
                unitId: data.unit_id,
                itemId: data.item_id,
                name: data.name,
                size: data.size,
                image_url: data.qr_code_url,
                category: data.category,
                garment_type: data.garment_type,
              },
              currentBorrowingId
            );
            toast.success(`✅ "${data.name}" added to cart`);
          } catch (err) {
            console.error("❌ Failed to reserve unit:", err.response?.data || err.message);
            toast.error(
              err.response?.data?.error ||
                `Failed to add "${data.name}" to cart.`
            );
          }
        } else {
          console.log(`🔁 Duplicate scan ignored: ${data.name}`);
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
      }
    },
    [addToCart, currentBorrowingId]
  );

  const onScanFailure = useCallback(() => {}, []);

  const stopScanner = useCallback(async () => {
    const inst = html5QrcodeRef.current;
    if (inst && scannerRunningRef.current) {
      try {
        await inst.stop();
      } catch {}
      try {
        await inst.clear();
      } catch {}
    }
    html5QrcodeRef.current = null;
    scannerRunningRef.current = false;
    videoTrackRef.current = null;
  }, []);

  const startScanner = useCallback(
    async (cameraId) => {
      if (isUnmountedRef.current) return;
      setIsStarting(true);
      setError("");

      await stopScanner();
      if (isUnmountedRef.current) return;

      const container = document.getElementById("qr-root");
      if (container) container.innerHTML = "";

      const inst = new Html5Qrcode("qr-root", { verbose: false });
      html5QrcodeRef.current = inst;

      const config = {
        fps: 30,
        qrbox: computeQrbox(),
        aspectRatio: 1.7778,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      try {
        await inst.start(
          cameraId
            ? { deviceId: { exact: cameraId } }
            : { facingMode: "environment" },
          config,
          onScanSuccess,
          onScanFailure
        );
        scannerRunningRef.current = true;

        const videoEl = container.querySelector("video");
        if (videoEl) {
          const stream = videoEl.srcObject;
          if (stream) {
            const track = stream.getVideoTracks()[0];
            videoTrackRef.current = track;
          }
        }

        if (contrastEnabled && container) {
          const video = container.querySelector("video");
          if (video) video.style.filter = "contrast(1.5) brightness(1.2)";
        }
      } catch (err) {
        console.error("Failed to start scanner:", err);
        if (err.name === "AbortError") {
          setError("❌ Camera took too long to start. Please retry.");
        } else {
          setError("❌ Unable to access camera. Check permissions.");
        }
        scannerRunningRef.current = false;
      } finally {
        if (!isUnmountedRef.current) setIsStarting(false);
      }
    },
    [computeQrbox, onScanSuccess, onScanFailure, stopScanner, contrastEnabled]
  );

  useEffect(() => {
    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await Html5Qrcode.getCameras();
        if (!devices.length) throw new Error("No cameras found.");
        setCameraDevices(devices);

        let preferred = devices.find((d) =>
          /back|rear|environment/i.test(d.label)
        );
        if (!preferred && devices.length) preferred = devices[0];

        if (preferred) {
          setActiveCameraId(preferred.id);
          await startScanner(preferred.id);
        }
      } catch (err) {
        console.error("Camera enumeration failed:", err);
        setError("❌ Cannot access camera. Check permissions.");
        setActiveCameraId(null);
      }
    })();
  }, [startScanner]);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      stopScanner();
    };
  }, [location.pathname, stopScanner]);

  const handleRetry = () => startScanner(activeCameraId);
  const handleSwitchCamera = () => {
    if (!cameraDevices.length) return;
    const idx = cameraDevices.findIndex((d) => d.id === activeCameraId);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % cameraDevices.length;
    setActiveCameraId(cameraDevices[nextIdx].id);
    startScanner(cameraDevices[nextIdx].id);
  };

  const handleTorchToggle = async () => {
    if (!videoTrackRef.current) return;
    try {
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: !torchEnabled }],
      });
      setTorchEnabled((prev) => !prev);
    } catch (err) {
      console.warn("Torch not supported on this device:", err);
      toast.error("Torch not supported on this device");
    }
  };

  const handleContrastToggle = () => {
    const container = document.getElementById("qr-root");
    if (container) {
      const video = container.querySelector("video");
      if (video) {
        if (!contrastEnabled) {
          video.style.filter = "contrast(1.5) brightness(1.2)";
        } else {
          video.style.filter = "";
        }
      }
    }
    setContrastEnabled((prev) => !prev);
  };

  return (
    <div className="w-full min-h-screen bg-white flex flex-col p-4 sm:p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-blue-600">Scan Items</h2>
        <button
          onClick={() => {
            stopScanner();
            navigate("/borrow-cart");
          }}
          className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded"
          type="button"
        >
          🛒 View Cart
        </button>
      </div>

      {/* Scanner */}
      {isStarting && (
        <div className="text-center text-gray-500 mb-4">Starting camera…</div>
      )}
      <div
        id="qr-root"
        className="w-full flex-1 max-h-[70vh] bg-black/5 rounded overflow-hidden"
      ></div>

      {/* Controls */}
      <div className="flex gap-2 mt-3 justify-center">
        <button
          onClick={handleTorchToggle}
          className={`px-3 py-1 text-sm rounded ${
            torchEnabled ? "bg-yellow-500 text-white" : "bg-gray-600 text-white"
          }`}
          type="button"
        >
          {torchEnabled ? "Torch On" : "Torch Off"}
        </button>
        <button
          onClick={handleContrastToggle}
          className={`px-3 py-1 text-sm rounded ${
            contrastEnabled ? "bg-green-600 text-white" : "bg-gray-600 text-white"
          }`}
          type="button"
        >
          {contrastEnabled ? "High Contrast" : "Normal"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-100 text-red-700 rounded text-sm sm:text-base">
          <div>{error}</div>
          <div className="flex gap-2 justify-center mt-2">
            <button
              onClick={handleRetry}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              type="button"
            >
              Retry
            </button>
            {cameraDevices.length > 1 && (
              <button
                onClick={handleSwitchCamera}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                type="button"
              >
                Switch Camera
              </button>
            )}
          </div>
        </div>
      )}

      {/* Last scanned */}
      {lastScannedItem && (
        <div className="mt-4 p-3 sm:p-4 bg-green-100 rounded text-sm sm:text-base">
          <h3 className="font-bold text-green-700">Last Scanned:</h3>
          <p>
            <strong>Type:</strong> {lastScannedItem.type}
          </p>
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
    </div>
  );
}
