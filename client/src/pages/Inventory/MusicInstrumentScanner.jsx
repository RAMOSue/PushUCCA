// src/pages/MusicInstrumentScanner.jsx
import { useEffect, useRef, useState, useContext, useCallback } from "react";
import axios from "axios";
import { BorrowingContext } from "../../../context/borrowingContext";
import { UserContext } from "../../../context/userContext";
import { SidebarContext } from "../../context/SidebarContext";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Camera,
  Image as ImageIcon,
  Loader,
  AlertCircle,
  CheckCircle,
  Upload,
  RefreshCw,
  X,
  ShoppingCart,
  ChevronLeft,
  RotateCw,
  Repeat,
  Maximize2,
} from "lucide-react";
import AddToCartModal from "../../components/modals/AddToCartModal";

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
  const [detectionModal, setDetectionModal] = useState(null); // { name, confidence, status, message }
  const [detectionCount, setDetectionCount] = useState(0);

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
  
  // State for capture mode
  const [capturedImage, setCapturedImage] = useState(null); // Base64 captured image
  const [showCapture, setShowCapture] = useState(false); // Preview captured image before sending
  const [captureHistory, setCaptureHistory] = useState([]); // History of captures
  const [isFlipped, setIsFlipped] = useState(false); // Camera flip state
  const [cameraState, setCameraState] = useState("default"); // "default" | "camera" | "captured" | "uploading"
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const [addedItemName, setAddedItemName] = useState("");

  // State for aggregated detections
  const [aggregatedDetections, setAggregatedDetections] = useState([]); // Grouped by instrument name
  const [scanSummary, setScanSummary] = useState(null); // { totalItems, totalDetections, itemsToAdd }
  const [selectedItemsToAdd, setSelectedItemsToAdd] = useState({}); // { "instrument-name": true/false }

  // Storage keys
  const STORAGE_CAMERA_STATE = "musicScanner_cameraState";
  const STORAGE_IS_FLIPPED = "musicScanner_isFlipped";
  const STORAGE_CAPTURED_IMAGE = "musicScanner_capturedImage";
  const STORAGE_ACTIVE_CAMERA = "musicScanner_activeCameraId";

  // Additional Refs
  const overlayRef = useRef(null);
  const { cart, addToCart, requestId, setRequestId } = useContext(BorrowingContext);
  const { user } = useContext(UserContext);
  const { setSidebarOpen } = useContext(SidebarContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize state from localStorage on mount
  useEffect(() => {
    try {
      const savedCameraState = localStorage.getItem(STORAGE_CAMERA_STATE);
      const savedIsFlipped = localStorage.getItem(STORAGE_IS_FLIPPED);
      const savedCapturedImage = localStorage.getItem(STORAGE_CAPTURED_IMAGE);
      const savedActiveCameraId = localStorage.getItem(STORAGE_ACTIVE_CAMERA);

      if (savedCameraState && savedCameraState !== "default") {
        console.log("📸 Restoring camera state:", savedCameraState);
        setCameraState(savedCameraState);
      }

      if (savedIsFlipped === "true") {
        setIsFlipped(true);
      }

      if (savedCapturedImage) {
        console.log("🖼️ Restoring captured image");
        setCapturedImage(savedCapturedImage);
      }

      if (savedActiveCameraId) {
        setActiveCameraId(savedActiveCameraId);
      }
    } catch (err) {
      console.error("Error restoring camera state from localStorage:", err);
    }
  }, []); // Only on mount

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

  // Check AI service health (with silent initial check)
  useEffect(() => {
    const checkHealth = async (silent = false) => {
      try {
        const response = await axios.get("/api/image-recognition/health", {
          timeout: 5000,
          validateStatus: (status) => status < 500, // Accept any response except server errors
        });
        
        if (response.status === 200) {
          setAiServiceHealth({
            status: "healthy",
            url: AI_SERVICE_URL,
            ...response.data.ai_service,
          });
        } else {
          setAiServiceHealth({
            status: "unhealthy",
            url: AI_SERVICE_URL,
            error: "AI service is unavailable. Please run the AI service first.",
          });
        }
      } catch (err) {
        if (!silent) {
          console.debug("Health check error (expected if AI service not running):", err.message);
        }
        setAiServiceHealth({
          status: "unhealthy",
          url: AI_SERVICE_URL,
          error: "AI service is not responding. Make sure to run: run.bat",
        });
      }
    };

    // Initial silent check
    checkHealth(true);
    // Then check every 30 seconds (non-silent for debugging)
    const interval = setInterval(() => checkHealth(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // Persist camera state to localStorage
  useEffect(() => {
    if (cameraState && cameraState !== "uploading") {
      try {
        localStorage.setItem(STORAGE_CAMERA_STATE, cameraState);
        console.log("💾 Saved camera state:", cameraState);
      } catch (err) {
        console.error("Error saving camera state:", err);
      }
    }
  }, [cameraState]);

  // Persist flip state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_IS_FLIPPED, isFlipped.toString());
    } catch (err) {
      console.error("Error saving flip state:", err);
    }
  }, [isFlipped]);

  // Persist captured image to localStorage
  useEffect(() => {
    try {
      if (capturedImage) {
        localStorage.setItem(STORAGE_CAPTURED_IMAGE, capturedImage);
        console.log("💾 Saved captured image");
      } else {
        localStorage.removeItem(STORAGE_CAPTURED_IMAGE);
      }
    } catch (err) {
      console.error("Error saving captured image:", err);
    }
  }, [capturedImage]);

  // Persist active camera ID to localStorage
  useEffect(() => {
    try {
      if (activeCameraId) {
        localStorage.setItem(STORAGE_ACTIVE_CAMERA, activeCameraId);
      }
    } catch (err) {
      console.error("Error saving active camera:", err);
    }
  }, [activeCameraId]);

  // Initialize camera when entering camera state (NOT on mount)
  useEffect(() => {
    if (cameraState === "camera") {
      console.log("🎥 Camera state entered, initializing camera...");
      initializeCamera();
    }

    return () => {
      // Keep stream when leaving camera state for captured view
      if (cameraState !== "captured" && streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraState]);

  // Cleanup on component unmount
  useEffect(() => {
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

  const initializeCamera = async (retryCount = 0, maxRetries = 3) => {
    try {
      // Request permissions first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      } catch (permErr) {
        if (permErr.name === 'NotAllowedError') {
          const errMsg = "❌ Camera permission denied. Please allow camera access and refresh the page.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");

      console.log("🎥 Available camera devices:", videoDevices);

      if (videoDevices.length === 0) {
        const errMsg = "❌ No camera devices found. Ensure a camera is connected.";
        setError(errMsg);
        toast.error(errMsg);
        return;
      }

      setCameraDevices(videoDevices);

      // Prefer FRONT camera first (for borrower selfie-style capture)
      let preferredCamera = videoDevices.find((d) => /front|user|facing|facetime/i.test(d.label));
      
      // If no front camera, try back camera
      if (!preferredCamera) {
        preferredCamera = videoDevices.find((d) => /back|rear|environment/i.test(d.label));
      }
      
      // If still no match, just use the first available camera
      if (!preferredCamera) {
        preferredCamera = videoDevices[0];
      }

      console.log("📷 Using camera:", preferredCamera);

      if (preferredCamera) {
        setActiveCameraId(preferredCamera.deviceId);
        await startCamera(preferredCamera.deviceId);
        toast.success("✅ Camera ready!");
      }
    } catch (err) {
      console.error("Camera initialization error (attempt " + (retryCount + 1) + "):", err);
      
      // Retry with exponential backoff if it's a temporary error
      if (retryCount < maxRetries && (err.name === 'NotReadableError' || err.name === 'InternalError')) {
        console.log(`⏳ Retrying camera access in ${1000 * (retryCount + 1)}ms...`);
        setTimeout(() => {
          initializeCamera(retryCount + 1, maxRetries);
        }, 1000 * (retryCount + 1));
        return;
      }

      const errMsg = `❌ Camera error: ${err.message || 'Could not access camera'}`;
      setError(errMsg);
      toast.error(errMsg);
    }
  };

  const startCamera = async (deviceId, retryCount = 0, maxRetries = 2) => {
    try {
      console.log("📹 Starting camera with device:", deviceId);
      
      // Stop existing stream
      if (streamRef.current) {
        console.log("⏹️ Stopping previous stream");
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        // Give browser time to release the camera
        await new Promise(resolve => setTimeout(resolve, 500));
        streamRef.current = null;
      }

      // Try with exact deviceId first, then fall back to any camera
      let constraints = {
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // If exact device fails, try without deviceId constraint
        if (deviceId && (err.name === 'NotFoundError' || err.name === 'NotReadableError')) {
          console.log("⚠️ Exact device not available, trying any camera...");
          constraints.video = {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } else {
          throw err;
        }
      }

      console.log("✅ Stream obtained:", stream);
      streamRef.current = stream;

      if (videoRef.current) {
        console.log("🎬 Setting video source");
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log("📺 Video loaded, dimensions:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
        };
        videoRef.current.play().catch((e) => {
          console.warn("⚠️ Play error:", e);
          toast.error("Could not start video playback");
        });
      } else {
        console.error("❌ videoRef.current is null");
      }

      setError("");
    } catch (err) {
      console.error("Failed to start camera (attempt " + (retryCount + 1) + "):", err);
      
      // Retry with exponential backoff
      if (retryCount < maxRetries && (err.name === 'NotReadableError' || err.name === 'InternalError')) {
        console.log(`⏳ Retrying camera start in ${1000 * (retryCount + 1)}ms...`);
        setTimeout(() => {
          startCamera(deviceId, retryCount + 1, maxRetries);
        }, 1000 * (retryCount + 1));
        return;
      }

      const errMsg = `❌ Unable to start camera: ${err.message}`;
      setError(errMsg);
      toast.error(errMsg);
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

  /**
   * Aggregate predictions by instrument name and count occurrences
   * Transforms: [{name: 'Guitar'}, {name: 'Drum'}, {name: 'Guitar'}]
   * Into: [{name: 'Guitar', count: 2, avgConfidence: 0.87}, {name: 'Drum', count: 1, avgConfidence: 0.92}]
   */
  const aggregateDetections = (predictions) => {
    if (!predictions || predictions.length === 0) return [];

    const grouped = {};

    predictions.forEach((pred) => {
      const key = pred.matched_item_name || pred.class_name;
      if (!grouped[key]) {
        grouped[key] = {
          name: pred.matched_item_name || pred.class_name,
          count: 0,
          predictions: [],
          matchedItemId: pred.matched_item_id,
          matchedUnitIds: [],
          confidences: [],
          avgConfidence: 0,
        };
      }
      grouped[key].count++;
      grouped[key].predictions.push(pred);
      grouped[key].confidences.push(pred.confidence);
      
      // ✅ CRITICAL: Only add unit_id if it exists (non-null/non-undefined)
      if (pred.matched_unit_id) {
        grouped[key].matchedUnitIds.push(pred.matched_unit_id);
        console.log(`✅ Added unit ${pred.matched_unit_id} for ${key} (total: ${grouped[key].matchedUnitIds.length})`);
      } else {
        console.warn(`⚠️ No matched_unit_id for ${key} prediction`);
      }
    });

    // Calculate averages and sort by count (descending)
    const aggregated = Object.values(grouped)
      .map((item) => ({
        ...item,
        avgConfidence: item.confidences.length > 0
          ? item.confidences.reduce((a, b) => a + b, 0) / item.confidences.length
          : 0,
        maxConfidence: Math.max(...item.confidences),
      }))
      .sort((a, b) => b.count - a.count);

    console.log("📊 Aggregated detections:", aggregated);
    aggregated.forEach((item) => {
      console.log(`  📦 ${item.name}: count=${item.count}, matchedUnitIds=[${item.matchedUnitIds.join(', ')}], itemId=${item.matchedItemId}`);
    });
    return aggregated;
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

      console.log("🎯 Frame response:", { type, count: predictions?.length });

      if (type === "success" && predictions && predictions.length > 0) {
        // Add image dimensions to each prediction for coordinate scaling
        const predictionsWithDimensions = predictions.map(p => ({
          ...p,
          image_width: image_width || 1280,
          image_height: image_height || 720,
        }));

        // Update live detections for box drawing (current frame only)
        setLiveDetections(predictionsWithDimensions);

        // Aggregate detections for persistent display
        const aggregated = aggregateDetections(predictionsWithDimensions);
        setPersistentDetections(aggregated);

        // Clear previous timeout and set new one for 3 seconds
        if (detectionTimeoutRef.current.persistentClear) {
          clearTimeout(detectionTimeoutRef.current.persistentClear);
        }
        detectionTimeoutRef.current.persistentClear = setTimeout(() => {
          setPersistentDetections([]);
        }, 3000);
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
        toast.error("❌ No instruments detected. Try again.");
        setError("");
        setLastScannedItems([]);
        setCameraState("camera");
        return;
      }

      if (type === "success" && predictions && predictions.length > 0) {
        // ✅ CRITICAL: Wait for requestId to be initialized before processing
        if (!requestId) {
          console.log("⏳ Waiting for borrowing session to initialize...");
          setDetectionModal({
            name: "Initializing...",
            confidence: 0,
            status: "loading",
            message: "Setting up borrowing session. Please wait...",
          });
          // Retry after a delay
          setTimeout(() => {
            processImage({ type, predictions }, filename);
          }, 1000);
          return;
        }

        const addedItems = [];
        let successCount = 0;

        for (const prediction of predictions) {
          const item = {
            itemId: prediction.matched_item_id,
            unitId: prediction.matched_unit_id,
            name: prediction.matched_item_name || prediction.class_name,
            category: "instrument",
            confidence: prediction.confidence,
            bbox: prediction.bbox,
          };

          // ✅ FIXED: Only add if both itemId and unitId exist (matched in inventory)
          if (prediction.matched_item_id && prediction.matched_unit_id) {
            try {
              console.log(`🛒 Adding ${item.name} to cart (unit: ${prediction.matched_unit_id})`);
              const result = await addToCart({
                unitId: prediction.matched_unit_id,
                itemId: prediction.matched_item_id,
                name: item.name,
                category: item.category,
              });
              
              if (result.success) {
                successCount++;
                addedItems.push(item);
                setDetectionCount((prev) => prev + 1);
                console.log(`✅ Added ${item.name} to cart successfully`);
              } else {
                console.error(`❌ Failed to add ${item.name}:`, result.error);
              }
            } catch (err) {
              console.error(`❌ Error adding ${item.name} to cart:`, err);
            }
          } else {
            // Item detected but not in inventory or no available units
            console.warn(`⚠️ ${item.name} detected but not available in inventory`);
            addedItems.push({
              ...item,
              warning: "Item not found in inventory",
            });
          }
        }

        // ✅ NEW: Show result and navigate if items were successfully added
        if (successCount > 0) {
          setDetectionModal({
            name: `${successCount} Item${successCount !== 1 ? "s" : ""} Added`,
            confidence: 100,
            status: "success",
            message: "Successfully added to cart. Redirecting...",
          });
          
          // ✅ NAVIGATE: Go back to previous page after brief delay for UX feedback
          setTimeout(() => {
            setSidebarOpen(true);
            navigate(-1);
          }, 800);
        } else {
          setDetectionModal({
            name: "No Items Added",
            confidence: 0,
            status: "warning",
            message: "Could not add detected items to cart",
          });
        }

        // Aggregate predictions by instrument name
        const aggregated = aggregateDetections(predictions);
        setAggregatedDetections(aggregated);

        // Create summary for display
        const totalItems = aggregated.reduce((sum, item) => sum + item.count, 0);
        const itemsToAdd = aggregated.filter(
          (item) => item.matchedItemId && item.matchedUnitIds.length > 0
        );

        setScanSummary({
          totalItems,
          totalDetections: aggregated.length,
          itemsToAdd,
        });

        // Initialize selection state
        const initialSelection = {};
        aggregated.forEach((item) => {
          initialSelection[item.name] = true;
        });
        setSelectedItemsToAdd(initialSelection);

        setLastScannedItems(aggregated);
        
        // Update persistent detections for modal display
        setPersistentDetections(aggregated);
        
        // Show detection modal with all instruments
        setDetectionCount(totalItems);
        setDetectionModal({
          name: `${aggregated.length} Instrument${aggregated.length !== 1 ? "s" : ""} Detected`,
          confidence: aggregated.length > 0 ? (aggregated[0].avgConfidence * 100).toFixed(1) : 0,
          status: "success",
          message: `Found ${totalItems} instrument${totalItems !== 1 ? "s" : ""}`,
        });
        
        setError("");
        setCameraState("camera");
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

    setCameraState("uploading");
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

  // Capture single frame and transition to captured state
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error("❌ Camera not ready");
      return;
    }

    try {
      const context = canvasRef.current.getContext("2d");
      const { videoWidth, videoHeight } = videoRef.current;

      if (videoWidth === 0 || videoHeight === 0) {
        toast.error("❌ Camera not ready. Try again...");
        return;
      }

      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      // If camera is flipped, mirror the image on the canvas
      if (isFlipped) {
        context.scale(-1, 1);
        context.drawImage(videoRef.current, -videoWidth, 0, videoWidth, videoHeight);
      } else {
        context.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
      }

      // Convert to base64 for preview
      const imageData = canvasRef.current.toDataURL("image/jpeg", 0.85);
      setCapturedImage(imageData);
      setCameraState("captured"); // Transition to captured state
      toast.success("✅ Image captured!");
    } catch (err) {
      console.error("Capture error:", err);
      toast.error("❌ Failed to capture image");
    }
  }, [isFlipped]);

  // Upload captured image for detection
  const handleUploadCapture = async (blob = null) => {
    if (!capturedImage && !blob) return;

    try {
      setIsProcessing(true);
      setError("");

      // Use provided blob or convert base64 to blob
      let imageBlob = blob;
      if (!imageBlob) {
        const response = await fetch(capturedImage);
        imageBlob = await response.blob();
      }

      await processImage(imageBlob, "camera_capture.jpg");

      // Add to history
      setCaptureHistory([...captureHistory, capturedImage]);

      // Clear preview
      setCapturedImage(null);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("❌ Failed to upload image");
    } finally {
      setIsProcessing(false);
    }
  };

  // Retake - go back to camera
  const handleRetake = () => {
    setCapturedImage(null);
    setCameraState("camera");
  };

  // Check - upload and detect immediately
  const handleCheckCapture = async () => {
    if (!capturedImage) return;
    setCameraState("uploading");

    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      await handleUploadCapture(blob);
      // Don't force results state - let processImage handle state transitions
      // This allows processImage to set camera state if no items detected
    } catch (err) {
      console.error("Check capture error:", err);
      toast.error("Upload failed. Try again.");
      setCameraState("captured");
    }
  };

  // UNIFIED SINGLE-PAGE CAMERA & DETECTION VIEW
  if (cameraState === "camera" || cameraState === "uploading") {
    return (
      <>
        <div className="min-h-screen flex flex-col lg:flex-row bg-white gap-0 lg:gap-4 p-0 lg:p-4">
          
          {/* MAIN SECTION - Full width on mobile, 2/3 on desktop */}
          <div className="w-full lg:w-2/3 flex flex-col gap-2 lg:gap-4 flex-1">
            
            {/* Mobile Header - Black and White, Compact (hidden on desktop) */}
            <div className="lg:hidden flex items-center justify-between bg-black px-3 py-2 flex-shrink-0">
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

            {/* Camera Container - Square aspect ratio with instructions */}
            <div className="bg-black rounded-lg flex-shrink-0 relative overflow-hidden shadow-lg" style={{ aspectRatio: "1", maxHeight: "min(100vw, 600px)" }}>
              
              {/* Video Stream */}
              <video
                ref={videoRef}
                autoPlay={true}
                playsInline={true}
                muted={true}
                className="w-full h-full object-cover"
                style={{ 
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: isFlipped ? "scaleX(-1)" : "scaleX(1)"
                }}
              />

              {/* Canvas for capture (hidden) */}
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Scan Guide Frame - Square */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div 
                  className="border-2 lg:border-4 border-white/70 rounded-lg"
                  style={{
                    width: "min(70vw, 280px)",
                    height: "min(70vw, 280px)",
                    aspectRatio: "1",
                  }}
                />
              </div>

              {/* Instruction Text */}
              <div className="absolute top-2 lg:top-6 left-0 right-0 text-center text-white font-semibold text-xs lg:text-sm opacity-80">
                <span>Align instrument</span>
              </div>

              {/* Camera Controls - Compact on mobile */}
              <div className="absolute bottom-2 lg:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 lg:gap-2 bg-black/70 backdrop-blur-sm rounded-lg px-2 lg:px-3 py-1.5 lg:py-2">
                <button
                  onClick={handleCapture}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white p-1.5 lg:p-2 rounded transition flex items-center justify-center"
                  title="Capture photo for detection"
                >
                  <Camera size={18} />
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-white/30"></div>

                {/* Upload Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 lg:p-2 rounded transition flex items-center justify-center"
                  title="Upload image from gallery"
                >
                  <Upload size={18} />
                </button>

                {/* Divider */}
                <div className="w-px h-5 bg-white/30"></div>

                {/* Mirror Button */}
                <button
                  onClick={() => {
                    setIsFlipped(!isFlipped);
                    toast.success(!isFlipped ? "🔄 Mirrored" : "🔄 Normal");
                  }}
                  className="bg-black border border-white text-white p-1.5 lg:p-2 rounded transition hover:bg-gray-800"
                  title="Mirror camera"
                >
                  <RotateCw size={16} />
                </button>

                {/* Switch Camera Button */}
                {cameraDevices.length > 1 && (
                  <button
                    onClick={switchCamera}
                    className="bg-black border border-white text-white p-1.5 lg:p-2 rounded transition hover:bg-gray-800"
                    title="Switch camera"
                  >
                    <Maximize2 size={16} />
                  </button>
                )}

                {/* Retry Button */}
                <button
                  onClick={() => {
                    captureFrame();
                    toast.success("↻ Retry...");
                  }}
                  className="bg-black border border-white text-white p-1.5 lg:p-2 rounded transition hover:bg-gray-800"
                  title="Retry live detection"
                >
                  <Repeat size={16} />
                </button>
              </div>

              {/* Processing Overlay */}
              {cameraState === "uploading" && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-3">
                    <Loader className="animate-spin text-white" size={40} />
                    <p className="text-white font-medium">Processing...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Current Detections - Visible on all screen sizes */}
            {(persistentDetections.length > 0 || (lastScannedItems && lastScannedItems.length > 0)) && (
              <div className="bg-white rounded-lg p-3 shadow-md border border-gray-200">
                <p className="text-gray-600 text-xs uppercase tracking-wider font-semibold mb-3">
                  {persistentDetections.length > 0 ? "Current Detections" : "Recent Detections"}
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {persistentDetections.length > 0 ? (
                    persistentDetections.map((item, idx) => (
                      <div key={idx} className="bg-green-50 border border-green-200 rounded p-3 text-xs">
                        <p className="text-gray-900 font-bold">{item.name}</p>
                        <div className="mt-2 space-y-1 text-xs text-gray-600">
                          <p>Count: <span className="font-semibold text-gray-900">×{item.count}</span></p>
                          <p>Confidence: <span className="font-semibold text-green-700">{(item.avgConfidence * 100).toFixed(1)}%</span></p>
                          {item.matchedUnitIds.length > 0 && (
                            <p className="text-green-700 font-semibold">✓ In Stock</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    lastScannedItems.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-2 text-xs">
                        <p className="text-gray-900 font-medium">{item.name}</p>
                        <p className="text-gray-500">×{item.count}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>

          {/* SIDEBAR SECTION - Hidden on mobile, 1/3 on desktop */}
          <div className="hidden lg:flex lg:w-1/3 flex-col gap-4 overflow-y-auto max-h-screen">
            
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-3">
                <p className="text-red-800 text-xs font-medium">{error}</p>
              </div>
            )}



            {/* Cart Panel */}
            <div className="bg-white rounded-lg p-4 shadow-md flex-1 flex flex-col border border-gray-200">
              <p className="text-gray-600 text-xs uppercase tracking-wider font-semibold mb-3">Current Cart</p>
              <div className="flex-1 overflow-y-auto space-y-2">
                {cart && cart.length > 0 ? (
                  cart.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-2 text-xs">
                      <p className="text-gray-900 font-medium truncate">{item.name}</p>
                      <p className="text-gray-500">Unit: {item.unitId}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No items yet</p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                <button
                  onClick={() => {
                    setSidebarOpen(true);
                    navigate("/borrow-cart");
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded transition"
                >
                  View Cart ({cart?.length || 0})
                </button>
                <button
                  onClick={() => {
                    setSidebarOpen(true);
                    navigate(-1);
                  }}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-xs font-bold py-2 rounded transition"
                >
                  Back
                </button>
              </div>
            </div>

            {/* Hidden File Input for Gallery Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

        </div>

        {/* Error Modal Overlay */}
        {error && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-red-900 border-2 border-red-600 rounded-lg p-6 text-center max-w-sm">
              <AlertCircle className="mx-auto text-red-400 mb-3" size={40} />
              <p className="text-white font-bold mb-2">Detection Error</p>
              <p className="text-red-200 text-sm mb-4">{error}</p>
              <button
                onClick={() => setError("")}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

      </>
    );
  }

  // CAPTURED IMAGE PREVIEW - Full Screen with Check/Redo Overlay
  if (cameraState === "captured" && capturedImage) {
    return (
      <div className="w-full h-screen flex flex-col bg-black relative overflow-hidden">
        {/* Captured Image - Full Screen */}
        <img
          src={capturedImage}
          alt="Captured"
          className="w-full h-full object-cover"
        />

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
          {/* Center Controls */}
          <div className="flex flex-col gap-4 bg-black/70 backdrop-blur-sm rounded-2xl p-6 shadow-2xl items-center">
            <h2 className="text-white text-center font-bold text-lg">Ready to scan?</h2>

            <div className="flex gap-6 justify-center">
              {/* Redo Button - Icon Only */}
              <button
                onClick={handleRetake}
                className="bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg transition flex items-center justify-center"
                title="Redo"
              >
                <RefreshCw size={24} />
              </button>

              {/* Check Button - Icon Only */}
              <button
                onClick={handleCheckCapture}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white p-3 rounded-lg transition flex items-center justify-center"
                title="Check"
              >
                {isProcessing ? (
                  <Loader className="animate-spin" size={24} />
                ) : (
                  <CheckCircle size={24} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  
}
