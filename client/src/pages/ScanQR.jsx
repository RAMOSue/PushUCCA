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

  const html5QrcodeRef = useRef(null);
  const scannerRunningRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const scannedCodesRef = useRef(new Map());
  const lastGlobalScanRef = useRef(0);
  const cartRef = useRef([]);
  const userRef = useRef(null);

  const { cart, addToCart } = useContext(BorrowingContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const computeQrbox = useCallback(() => {
    const el = document.getElementById("qr-root");
    if (!el) return 250;
    const w = el.offsetWidth;
    const h = el.offsetHeight || w;
    const size = Math.min(w, h) * 0.8;
    return Math.max(200, Math.min(size, 400));
  }, []);

  const normalizeScanPayload = (raw) => {
    const type = raw?.type || (raw?.unit_id || raw?.inventory_unit_id ? "unit" : "item");
    const data = raw?.data || raw || {};

    const unitId = data.unit_id || data.inventory_unit_id || data.id || null;
    const itemName = type === "unit" ? (data.item_name || data.name) : (data.name || data.item_name);

    return {
      type,
      data: {
        unit_id: unitId,
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
          res = await axios.get(`/api/inventory/scan/text/${encodeURIComponent(cleanQR)}`);
        } catch (e) {
          if (e?.response?.status === 404) {
            // Try flexible route next
            try {
              res = await axios.get(`/api/inventory/scan/flexible/${encodeURIComponent(cleanQR)}`);
            } catch (flexErr) {
              if (flexErr?.response?.status === 404) {
                throw new Error("Item not found");
              }
              throw flexErr;
            }
          } else {
            throw e;
          }
        }

        const normalized = normalizeScanPayload(res.data);
        const { type, data } = normalized;
        const uniqueId = data.unit_id || data.id;
        const alreadyInCart = cartRef.current.some((c) => c.id === uniqueId);

        if (!alreadyInCart) {
          await addToCart({ id: uniqueId, ...data });
          toast.success(`✅ "${data.name}" added to cart`);
        } else {
          toast(`+1 "${data.name}" (duplicate scan)`);
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
    [addToCart]
  );

  const onScanFailure = useCallback(() => {}, []);

  const stopScanner = useCallback(async () => {
    const inst = html5QrcodeRef.current;
    if (!inst) return;
    if (scannerRunningRef.current) {
      try {
        await inst.stop();
      } catch (e) {
        console.warn("Scanner stop error:", e);
      }
    }
    try {
      await inst.clear();
    } catch {}
    html5QrcodeRef.current = null;
    scannerRunningRef.current = false;
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
        fps: 10,
        qrbox: computeQrbox(),
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        aspectRatio: 1.7778,
      };

      try {
        await new Promise((r) => setTimeout(r, 300));
        await inst.start(
          cameraId ? { deviceId: { exact: cameraId } } : { facingMode: "environment" },
          config,
          onScanSuccess,
          onScanFailure
        );
        scannerRunningRef.current = true;
      } catch (err) {
        console.error("Failed to start scanner:", err);
        setError(
          err.name === "NotAllowedError"
            ? "❌ Camera permission denied."
            : err.name === "AbortError"
            ? "❌ Camera startup timed out."
            : "❌ Unable to access camera."
        );
        scannerRunningRef.current = false;
      } finally {
        if (!isUnmountedRef.current) setIsStarting(false);
      }
    },
    [computeQrbox, onScanSuccess, onScanFailure, stopScanner]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const devices = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!devices.length) throw new Error("No cameras found.");
        setCameraDevices(devices);
        let preferred = devices.find((d) => /back|rear|environment/i.test(d.label));
        if (!preferred && devices.length) preferred = devices[0];
        setActiveCameraId(preferred ? preferred.id : null);
      } catch (err) {
        console.error("Camera enumeration failed:", err);
        setError("❌ Cannot access camera.");
        setActiveCameraId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeCameraId !== null) startScanner(activeCameraId);
  }, [activeCameraId, startScanner]);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      stopScanner();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [location.pathname, stopScanner]);

  const handleRetry = () => startScanner(activeCameraId);
  const handleSwitchCamera = () => {
    if (!cameraDevices.length) return;
    const idx = cameraDevices.findIndex((d) => d.id === activeCameraId);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % cameraDevices.length;
    setActiveCameraId(cameraDevices[nextIdx].id);
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-white shadow rounded">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-blue-600">Scan Items</h2>
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

      {isStarting && (
        <div className="text-center text-gray-500 mb-4">Starting camera…</div>
      )}

      <div
        id="qr-root"
        className="mx-auto w-full aspect-video max-h-[60vh] bg-black/5 rounded overflow-hidden"
      ></div>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded space-y-2">
          <div>{error}</div>
          <div className="flex gap-2 justify-center">
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

      {lastScannedItem && (
        <div className="mt-4 p-4 bg-green-100 rounded">
          <h3 className="font-bold text-green-700">Last Scanned:</h3>
          <p><strong>Type:</strong> {lastScannedItem.type}</p>
          <p><strong>Name:</strong> {lastScannedItem.name}</p>
          <p><strong>Category:</strong> {lastScannedItem.category}</p>
          <p><strong>Size:</strong> {lastScannedItem.size}</p>
          <p><strong>Status:</strong> {lastScannedItem.status}</p>
        </div>
      )}
    </div>
  );
}
