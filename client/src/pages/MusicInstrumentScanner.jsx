// src/pages/MusicInstrumentScanner.jsx
import { useEffect, useRef, useState, useContext, useCallback } from "react";
import axios from "axios";
import { BorrowingContext } from "../../context/borrowingContext";
import { UserContext } from "../../context/userContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Camera,
  Image as ImageIcon,
  ShoppingCart,
  Loader,
  AlertCircle,
  CheckCircle,
  Upload,
  RefreshCw,
} from "lucide-react";

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://127.0.0.1:8000";

export default function MusicInstrumentScanner() {
  // State Management
  const [scanMode, setScanMode] = useState("camera"); // 'camera' or 'upload'
  const [lastScannedItems, setLastScannedItems] = useState([]);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiServiceHealth, setAiServiceHealth] = useState(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const cartRef = useRef([]);
  const userRef = useRef(null);
  const isProcessingRef = useRef(false);
  const detectionTimeoutRef = useRef({}); // Track timeout for each detection

  // State for live predictions
  const [liveDetections, setLiveDetections] = useState([]);
  const [persistentDetections, setPersistentDetections] = useState([]); // Items that persist for a few seconds

  // Context
  const { cart, addToCart, requestId, setRequestId } = useContext(BorrowingContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  // Update refs when context changes
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Initialize borrowing session
  useEffect(() => {
    const initBorrowingSession = async () => {
      if (!requestId && userRef.current?.id) {
        try {
          const res = await axios.post("/api/borrow/start", {
            borrower_id: userRef.current.id,
          });
          setRequestId(res.data.borrowingId || res.data.request_id || null);
          console.log("✅ Borrowing session started:", res.data.borrowingId || res.data.request_id);
        } catch (err) {
          console.error("Borrowing session error:", err);
          toast.error("❌ Cannot start borrowing session.");
        }
      }
    };
    initBorrowingSession();
  }, [requestId, setRequestId]);

  // Check AI service health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await axios.get("/api/image-recognition/health", {
          timeout: 5000,
        });
        setAiServiceHealth({
          status: "healthy",
          url: AI_SERVICE_URL,
          ...response.data.ai_service,
        });
      } catch (err) {
        console.warn("AI service health check failed:", err.message);
        setAiServiceHealth({
          status: "unhealthy",
          url: AI_SERVICE_URL,
          error: "AI service is not responding. Make sure to run: run.bat",
        });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Initialize camera on component mount
  useEffect(() => {
    initializeCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      // Clear all detection timeouts
      Object.values(detectionTimeoutRef.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  // Continuous frame capture on video play
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const startContinuousCapture = () => {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      // Capture every 500ms for continuous detection
      captureIntervalRef.current = setInterval(() => {
        captureFrame();
      }, 500);
    };

    video.addEventListener("play", startContinuousCapture);
    return () => {
      video.removeEventListener("play", startContinuousCapture);
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    };
  }, []);

  const initializeCamera = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");

      if (videoDevices.length === 0) {
        setError("❌ No camera devices found");
        return;
      }

      setCameraDevices(videoDevices);

      // Prefer back/rear camera
      const preferredCamera =
        videoDevices.find((d) => /back|rear|environment/i.test(d.label)) ||
        videoDevices[0];

      if (preferredCamera) {
        setActiveCameraId(preferredCamera.deviceId);
        await startCamera(preferredCamera.deviceId);
      }
    } catch (err) {
      console.error("Camera initialization error:", err);
      setError("❌ Cannot access camera. Check browser permissions.");
    }
  };

  const startCamera = async (deviceId) => {
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn("Play error:", e));
      }

      setError("");
    } catch (err) {
      console.error("Failed to start camera:", err);
      setError("❌ Unable to start camera");
    }
  };

  const switchCamera = async () => {
    if (cameraDevices.length <= 1) return;

    const currentIndex = cameraDevices.findIndex(
      (d) => d.deviceId === activeCameraId
    );
    const nextIndex = (currentIndex + 1) % cameraDevices.length;
    const nextDeviceId = cameraDevices[nextIndex].deviceId;

    setActiveCameraId(nextDeviceId);
    await startCamera(nextDeviceId);
    toast.success(`📷 Switched to: ${cameraDevices[nextIndex].label}`);
  };

  // Capture frame from video (no cooldown - runs continuously)
  const captureFrame = useCallback(async () => {
    if (isProcessingRef.current || !videoRef.current || !canvasRef.current) return;

    try {
      isProcessingRef.current = true;

      const context = canvasRef.current.getContext("2d");
      const { videoWidth, videoHeight } = videoRef.current;

      if (videoWidth === 0 || videoHeight === 0) {
        return;
      }

      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
      context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);

      const blob = await new Promise((resolve) => {
        canvasRef.current.toBlob(resolve, "image/jpeg", 0.8);
      });

      await processFrameImage(blob);
    } catch (err) {
      console.error("Frame capture error:", err);
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  // Legacy function kept for manual scan button (if needed)
  const captureAndScan = useCallback(async () => {
    if (isProcessing || !videoRef.current || !canvasRef.current) return;

    try {
      setIsProcessing(true);
      setError("");

      // Capture frame from video
      const context = canvasRef.current.getContext("2d");
      const { videoWidth, videoHeight } = videoRef.current;

      if (videoWidth === 0 || videoHeight === 0) {
        setError("❌ Camera not ready. Try again...");
        return;
      }

      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
      context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);

      // Convert canvas to blob
      const blob = await new Promise((resolve) => {
        canvasRef.current.toBlob(resolve, "image/jpeg", 0.85);
      });

      await processImage(blob, "camera_capture.jpg");
    } catch (err) {
      console.error("Capture error:", err);
      setError("❌ Failed to capture image");
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  // Process continuous frame from camera (just displays detections)
  const processFrameImage = async (blob) => {
    try {
      if (!blob) return;

      const formData = new FormData();
      formData.append("image", blob, "frame.jpg");

      const response = await axios.post("/api/image-recognition/scan", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 10000,
      });

      const { type, predictions, image_width, image_height } = response.data;

      console.log("🎯 Frame response:", { type, predictions, count: predictions?.length, image_width, image_height });

      if (type === "success" && predictions && predictions.length > 0) {
        // Add image dimensions to each prediction for coordinate scaling
        const predictionsWithDimensions = predictions.map(p => ({
          ...p,
          image_width: image_width || 1280,
          image_height: image_height || 720,
        }));

        // Update live detections for box drawing (current frame only)
        setLiveDetections(predictionsWithDimensions);

        // Add to persistent list with timeout
        predictionsWithDimensions.forEach((prediction) => {
          const key = prediction.matched_item_id || prediction.class_name;
          
          // Clear existing timeout for this item
          if (detectionTimeoutRef.current[key]) {
            clearTimeout(detectionTimeoutRef.current[key]);
          }

          // Add to persistent list if not already there
          setPersistentDetections((prev) => {
            const exists = prev.some((p) => (p.matched_item_id || p.class_name) === key);
            if (exists) {
              return prev;
            }
            return [...prev, prediction];
          });

          // Set timeout to remove after 3 seconds of no detection
          detectionTimeoutRef.current[key] = setTimeout(() => {
            setPersistentDetections((prev) => prev.filter((p) => (p.matched_item_id || p.class_name) !== key));
            delete detectionTimeoutRef.current[key];
          }, 3000);
        });
      } else {
        setLiveDetections([]);
      }
    } catch (err) {
      // Silent fail for continuous capture
      setLiveDetections([]);
    }
  };

  const processImage = async (blob, filename) => {
    try {
      if (!blob) {
        setError("❌ No image data");
        return;
      }

      const formData = new FormData();
      formData.append("image", blob, filename);

      console.log("🚀 Sending image to AI service...");
      setIsProcessing(true);

      const response = await axios.post("/api/image-recognition/scan", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000, // 60 second timeout
      });

      const { type, predictions, message } = response.data;

      console.log(`✅ AI Response: ${message}`, predictions);

      if (type === "no_items") {
        toast.error("❌ No instruments detected in image");
        setError("No instruments detected. Try different angle or lighting.");
        setLastScannedItems([]);
        return;
      }

      if (type === "success" && predictions && predictions.length > 0) {
        const addedItems = [];

        for (const prediction of predictions) {
          const item = {
            itemId: prediction.matched_item_id,
            unitId: prediction.matched_unit_id,
            name: prediction.matched_item_name || prediction.class_name,
            category: "instrument",
            confidence: prediction.confidence,
            bbox: prediction.bbox,
          };

          // Add to cart if matched and available
          if (prediction.matched_item_id && !requestId) {
            toast.error("❌ Please wait, setting up borrowing session...");
            continue;
          }

          if (prediction.matched_item_id && prediction.matched_unit_id && requestId) {
            try {
              await addToCart({
                unitId: prediction.matched_unit_id,
                itemId: prediction.matched_item_id,
                name: item.name,
                category: item.category,
                confidence: item.confidence,
              });
              addedItems.push(item);
              toast.success(
                `✅ "${item.name}" added (${(item.confidence * 100).toFixed(1)}% confidence)`
              );
            } catch (err) {
              console.error("Error adding to cart:", err);
            }
          } else {
            // Item detected but not in inventory
            addedItems.push({
              ...item,
              warning: "Item not found in inventory",
            });
            toast(
              `ℹ️ "${item.name}" detected (${(item.confidence * 100).toFixed(1)}%) but not in system`,
              { icon: "ℹ️" }
            );
          }
        }

        setLastScannedItems(addedItems);
        setError("");
      }
    } catch (err) {
      console.error("Image processing error:", err);

      if (err.response?.status === 503) {
        setError(
          "❌ AI service unavailable. Please run: run.bat in the Musical_Instrument_Model/local_deployment folder"
        );
      } else if (err.code === "ECONNREFUSED") {
        setError(
          "❌ Cannot connect to AI service at " +
            AI_SERVICE_URL +
            ". Is the FastAPI server running?"
        );
      } else {
        setError(
          err.response?.data?.error ||
            "❌ Failed to process image. Try again..."
        );
      }

      setLastScannedItems([]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Cleanup on unmount
    };
  }, []);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("❌ Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("❌ Image must be less than 5MB");
      return;
    }

    await processImage(file, file.name);
    e.target.value = ""; // Reset input
  };

  const startAutoCapture = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
      toast.success("⏹️ Auto-capture stopped");
      return;
    }

    toast.success("▶️ Auto-capture started (every 3 seconds)");
    captureIntervalRef.current = setInterval(() => {
      captureAndScan();
    }, 3000);
  };

  const clearHistory = () => {
    setLastScannedItems([]);
    setError("");
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="flex justify-between items-center p-4 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-blue-600" size={24} />
            <h1 className="text-lg font-bold text-blue-600">
              Musical Instrument Scanner
            </h1>
          </div>
          <button
            onClick={() => {
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
              }
              navigate("/borrow-cart");
            }}
            className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-200 transition"
          >
            <ShoppingCart size={16} />
            Cart ({cart.length})
          </button>
        </div>

        {/* AI Service Health Status */}
        <div className="px-4 pb-3 max-w-4xl mx-auto">
          <div
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
              aiServiceHealth?.status === "healthy"
                ? "bg-green-50 text-green-700"
                : "bg-yellow-50 text-yellow-700"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                aiServiceHealth?.status === "healthy"
                  ? "bg-green-500"
                  : "bg-yellow-500"
              }`}
            />
            {aiServiceHealth?.status === "healthy"
              ? `✅ AI Service: Ready (${aiServiceHealth.url})`
              : `⚠️ AI Service: ${aiServiceHealth?.error || "Checking..."}`}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-4">
        {/* Mode Selection */}
        <div className="flex gap-2 sticky top-24">
          <button
            onClick={() => setScanMode("camera")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition ${
              scanMode === "camera"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Camera size={18} />
            Camera Scan
          </button>
          <button
            onClick={() => setScanMode("upload")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition ${
              scanMode === "upload"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Upload size={18} />
            Upload Image
          </button>
        </div>

        {/* Camera Mode */}
        {scanMode === "camera" && (
          <div className="space-y-4">
            {/* Video Stream with Overlay */}
            <div className="relative bg-black rounded-lg overflow-hidden shadow-lg w-full" style={{ overflow: "hidden" }}>
              <video
                ref={videoRef}
                className="w-full aspect-video object-cover block"
                playsInline
                muted
                style={{ transform: "scaleX(-1)" }}
              />

              {/* CSS-based Bounding Boxes Overlay */}
              <div 
                className="absolute inset-0 w-full h-full pointer-events-none" 
                style={{ 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0,
                  border: liveDetections.length > 0 ? '2px solid lime' : 'none'
                }}
              >
                {liveDetections.map((detection, idx) => {
                  const video = videoRef.current;
                  if (!video) return null;

                  // Display size (CSS size of the video element)
                  const displayWidth = video.clientWidth;
                  const displayHeight = video.clientHeight;

                  // Original image size (what the AI model processed)
                  const imageWidth = detection.image_width || 1280;
                  const imageHeight = detection.image_height || 720;

                  // Calculate scale factors
                  const scaleX = displayWidth / imageWidth;
                  const scaleY = displayHeight / imageHeight;

                  // Handle bbox in multiple formats: object {x1, y1, x2, y2} or array [x1, y1, x2, y2]
                  let x1, y1, x2, y2;
                  
                  if (detection.bbox && typeof detection.bbox === 'object') {
                    if (Array.isArray(detection.bbox)) {
                      // Array format: [x1, y1, x2, y2]
                      [x1, y1, x2, y2] = detection.bbox;
                    } else {
                      // Object format: {x1, y1, x2, y2}
                      ({ x1, y1, x2, y2 } = detection.bbox);
                    }
                  } else {
                    console.warn(`❌ Invalid bbox for detection ${idx}:`, detection.bbox);
                    return null;
                  }

                  // Ensure we have valid coordinates
                  if (typeof x1 !== 'number' || typeof y1 !== 'number' || typeof x2 !== 'number' || typeof y2 !== 'number') {
                    console.warn(`❌ Invalid bbox coordinates for detection ${idx}:`, { x1, y1, x2, y2 });
                    return null;
                  }

                  // Scale coordinates from image space to display space
                  const scaledX1 = x1 * scaleX;
                  const scaledY1 = y1 * scaleY;
                  const scaledX2 = x2 * scaleX;
                  const scaledY2 = y2 * scaleY;

                  // Calculate width and height from corners
                  const boxWidth = scaledX2 - scaledX1;
                  const boxHeight = scaledY2 - scaledY1;

                  if (boxWidth <= 0 || boxHeight <= 0) {
                    console.warn(`❌ Invalid bbox dimensions for detection ${idx}:`, { boxWidth, boxHeight });
                    return null;
                  }

                  // Primary colors rotation: Red, Blue, Yellow
                  const colors = [
                    { border: "#FF0000", bg: "rgba(255, 0, 0, 0.15)", label: "#CC0000" }, // Red
                    { border: "#0066FF", bg: "rgba(0, 102, 255, 0.15)", label: "#0052CC" }, // Blue
                    { border: "#FFD700", bg: "rgba(255, 215, 0, 0.15)", label: "#DAA520" }, // Yellow
                  ];
                  const color = colors[idx % colors.length];

                  const boxStyle = {
                    borderColor: color.border,
                    backgroundColor: color.bg,
                    left: `${(scaledX1 / displayWidth) * 100}%`,
                    top: `${(scaledY1 / displayHeight) * 100}%`,
                    width: `${(boxWidth / displayWidth) * 100}%`,
                    height: `${(boxHeight / displayHeight) * 100}%`,
                  };

                  const percentages = {
                    left: ((scaledX1 / displayWidth) * 100).toFixed(1),
                    top: ((scaledY1 / displayHeight) * 100).toFixed(1),
                    width: ((boxWidth / displayWidth) * 100).toFixed(1),
                    height: ((boxHeight / displayHeight) * 100).toFixed(1),
                  };

                  console.log(`🟥 Rendering box ${idx}:`, { 
                    pixels: { x1, y1, x2, y2, boxWidth, boxHeight, scaledX1, scaledY1, scaledX2: scaledX2, scaledY2 },
                    percentages,
                    scales: { scaleX, scaleY },
                    sizes: { imageWidth, imageHeight, displayWidth, displayHeight },
                    color
                  });

                  return (
                    <div
                      key={idx}
                      className="absolute border-2"
                      style={{
                        ...boxStyle,
                        zIndex: 10 + idx,
                      }}
                    >
                      <div
                        className="absolute left-0 text-white px-2 py-1 text-xs font-bold whitespace-nowrap rounded"
                        style={{ 
                          backgroundColor: color.label,
                          bottom: '100%',
                          marginBottom: '2px'
                        }}
                      >
                        {detection.matched_item_name || detection.class_name} {(detection.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>

              {liveDetections.length > 0 && (
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                  🎯 {liveDetections.length} detected
                </div>
              )}

              {isProcessing && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader className="animate-spin text-white" size={32} />
                    <p className="text-white text-sm font-medium">Processing...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden Canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Camera Controls */}
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 text-center">
                ✅ Continuous detection active - Camera scanning every 500ms
              </div>

              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video) {
                    const isFlipped = video.style.transform === "scaleX(-1)";
                    video.style.transform = isFlipped ? "scaleX(1)" : "scaleX(-1)";
                    const overlay = overlayRef.current;
                    if (overlay) {
                      overlay.style.transform = isFlipped ? "scaleX(1)" : "scaleX(-1)";
                    }
                    toast.success(isFlipped ? "🔄 Camera normal" : "🔄 Camera flipped");
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition text-sm"
              >
                🔄 Flip Camera
              </button>

              {cameraDevices.length > 1 && (
                <button
                  onClick={switchCamera}
                  disabled={isProcessing}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-2 rounded-lg font-medium transition text-sm"
                >
                  📷 Switch Camera
                </button>
              )}
            </div>
          </div>
        )}

        {/* Upload Mode */}
        {scanMode === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="mx-auto mb-3 text-blue-400" size={40} />
              <p className="text-sm font-medium text-gray-700">
                Click to upload or drag & drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG up to 5MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {isProcessing && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader className="animate-spin text-blue-600" size={32} />
                <p className="text-gray-600 font-medium">Processing image...</p>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Live Detections Results - Continuous Display */}
        <div className="bg-white rounded-lg border border-blue-200 overflow-hidden shadow-sm">
          <div className="bg-blue-50 px-4 py-3 border-b border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-blue-600" size={20} />
              <h3 className="font-bold text-blue-700">
                Detected Items ({persistentDetections.length})
              </h3>
              <span className="text-xs text-gray-600">(persists 3 seconds)</span>
            </div>
            <span className={`inline-block w-2 h-2 rounded-full ${persistentDetections.length > 0 ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {persistentDetections.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No instruments detected. Point camera at instruments...
              </div>
            ) : (
              persistentDetections.map((detection, idx) => (
                <div key={idx} className="p-3 hover:bg-blue-50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">
                        {detection.matched_item_name || detection.class_name}
                      </p>
                      <div className="flex gap-2 mt-1 text-xs text-gray-600">
                        <span>📊 {(detection.confidence * 100).toFixed(1)}% confidence</span>
                        {detection.matched_unit_id && (
                          <span className="text-green-600">✓ Available</span>
                        )}
                      </div>
                    </div>
                    {detection.matched_unit_id && (
                      <button
                        onClick={async () => {
                          if (!detection.matched_unit_id) {
                            toast.error("Unit not available");
                            return;
                          }
                          try {
                            await addToCart({
                              unitId: detection.matched_unit_id,
                              itemId: detection.matched_item_id,
                              name: detection.matched_item_name || detection.class_name,
                            });
                            toast.success("Added to cart!");
                          } catch (err) {
                            console.error("Add to cart error:", err);
                            toast.error("Failed to add to cart");
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs whitespace-nowrap flex-shrink-0"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Old Scanned Items Results */}
        {lastScannedItems.length > 0 && (
          <div className="bg-white rounded-lg border border-green-200 overflow-hidden shadow-sm">
            <div className="bg-green-50 px-4 py-3 border-b border-green-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="text-green-600" size={20} />
                <h3 className="font-bold text-green-700">
                  {lastScannedItems.length} Item(s) Detected
                </h3>
              </div>
              <button
                onClick={clearHistory}
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                Clear
              </button>
            </div>
            <div className="divide-y">
              {lastScannedItems.map((item, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <div className="flex gap-3 mt-2 text-sm text-gray-600">
                        <span>📊 {(item.confidence * 100).toFixed(1)}% confidence</span>
                        {item.warning && (
                          <span className="text-orange-600">⚠️ {item.warning}</span>
                        )}
                      </div>
                    </div>
                    {!item.warning && (
                      <div className="ml-3">
                        <div className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                          ✓ In Cart
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="flex justify-around items-center py-3 max-w-4xl mx-auto px-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-blue-600 transition"
          >
            <Camera size={20} />
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => navigate("/borrow-cart")}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-blue-600 transition relative"
          >
            <ShoppingCart size={20} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
            <span className="text-xs">Cart</span>
          </button>
          <button
            onClick={clearHistory}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-blue-600 transition"
          >
            <RefreshCw size={20} />
            <span className="text-xs">Refresh</span>
          </button>
        </div>
      </div>
    </div>
  );
}
