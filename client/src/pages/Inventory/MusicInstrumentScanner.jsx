// src/pages/MusicInstrumentScanner.jsx
import { useEffect, useRef, useState, useContext, useCallback } from "react";
import axios from "axios";
import { BorrowingContext } from "../../../context/borrowingContext";
import { UserContext } from "../../../context/userContext";
import { SidebarContext } from "../../../context/SidebarContext";
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
  const [cameraState, setCameraState] = useState("default"); // "default" | "camera" | "captured" | "uploading" | "results"
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

  const initializeCamera = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");

      console.log("🎥 Available camera devices:", videoDevices);

      if (videoDevices.length === 0) {
        const errMsg = "❌ No camera devices found";
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
      console.error("Camera initialization error:", err);
      const errMsg = `❌ Camera error: ${err.message}`;
      setError(errMsg);
      toast.error(errMsg);
    }
  };

  const startCamera = async (deviceId) => {
    try {
      console.log("📹 Starting camera with device:", deviceId);
      
      // Stop existing stream
      if (streamRef.current) {
        console.log("⏹️ Stopping previous stream");
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

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
      console.error("Failed to start camera:", err);
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
        toast.error("❌ No instruments detected in image");
        setError("No instruments detected. Try different angle or lighting.");
        setLastScannedItems([]);
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
      setCameraState("results");
    } catch (err) {
      console.error("Check capture error:", err);
      toast.error("Upload failed. Try again.");
      setCameraState("captured");
    }
  };

  // SPLIT-SCREEN DESKTOP POS VIEW (same as ScanQR.jsx)
  if (cameraState === "camera" || cameraState === "uploading") {
    return (
      <div className="h-screen flex bg-gray-900 gap-4 p-4">
        {/* LEFT PANEL: Scanner (2/3 width) */}
        <div className="w-2/3 flex flex-col gap-4">
          {/* Scanner Container */}
          <div className="bg-black rounded-xl h-full relative overflow-hidden shadow-lg">
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
                borderRadius: "0.75rem",
                transform: isFlipped ? "scaleX(-1)" : "scaleX(1)"
              }}
            />

            {/* Canvas for capture (hidden) */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Scan Guide Overlay - Pulsing animated square */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-4 border-white/80 rounded-lg animate-pulse"></div>
            </div>

            {/* Instruction Text */}
            <div className="absolute top-8 left-0 right-0 text-center text-white font-semibold text-lg opacity-90">
              Align instrument inside the box
            </div>

            {/* Scanner Controls (Bottom Center) */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-3">
              {/* Mirror Button */}
              <button
                onClick={() => {
                  setIsFlipped(!isFlipped);
                  toast.success(!isFlipped ? "🔄 Camera mirrored" : "🔄 Camera normal");
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full transition"
                title="Mirror camera"
              >
                <RefreshCw size={18} />
              </button>

              {/* Switch Camera Button */}
              {cameraDevices.length > 1 && (
                <button
                  onClick={switchCamera}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full transition"
                  title="Switch camera"
                >
                  <Camera size={18} />
                </button>
              )}

              {/* AI Assist Toggle (placeholder) */}
              <button
                className="bg-yellow-600 hover:bg-yellow-700 text-white p-2 rounded-full transition"
                title="AI assist"
              >
                <span className="text-sm font-bold">⚡</span>
              </button>

              {/* Retry Button */}
              <button
                onClick={() => {
                  captureFrame();
                  toast.success("↻ Retrying...");
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-full transition"
                title="Retry detection"
              >
                <RefreshCw size={18} />
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
        </div>

        {/* RIGHT PANEL: Info (1/3 width) */}
        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto">
          {/* A. Error Alert */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4">
              <p className="text-red-200 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* B. Last Detected Item Card */}
          {persistentDetections.length > 0 && (
            <div className="bg-gray-800 border-l-4 border-green-500 rounded-lg p-4 shadow-md">
              <p className="text-gray-300 text-xs uppercase tracking-wider mb-2">Last Detected</p>
              <p className="text-white font-bold text-lg">{persistentDetections[0].name}</p>
              <div className="mt-3 space-y-1 text-xs text-gray-400">
                <p>Category: <span className="text-gray-200">Instrument</span></p>
                <p>Confidence: <span className="text-yellow-400">{(persistentDetections[0].avgConfidence * 100).toFixed(1)}%</span></p>
                {persistentDetections[0].matchedUnitIds.length > 0 && (
                  <p className="text-green-400 font-semibold">✓ In Stock</p>
                )}
              </div>
            </div>
          )}

          {/* C. Cart Panel */}
          <div className="bg-gray-800 rounded-lg p-4 shadow-md flex-1 flex flex-col">
            <p className="text-gray-300 text-xs uppercase tracking-wider font-semibold mb-3">Current Cart</p>
            <div className="flex-1 overflow-y-auto space-y-2">
              {cart && cart.length > 0 ? (
                cart.map((item, idx) => (
                  <div key={idx} className="bg-gray-700/50 rounded p-2 text-xs">
                    <p className="text-white font-medium truncate">{item.name}</p>
                    <p className="text-gray-400">Unit: {item.unitId}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No items yet</p>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2">
              <button
                onClick={() => {
                  setSidebarOpen(true);
                  navigate("/borrow-cart");
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded transition"
              >
                View Cart ({cart?.length || 0})
              </button>
              <button
                onClick={() => {
                  setSidebarOpen(true);
                  navigate(-1);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-2 rounded transition"
              >
                Back
              </button>
            </div>
          </div>

          {/* D. System Status Panel */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-2 shadow-md">
            <p className="text-gray-300 text-xs uppercase tracking-wider font-semibold">System Status</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Camera</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-green-400">Active</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Session</span>
                <span className="flex items-center gap-1">
                  <span className="text-yellow-400">⏳</span>
                  <span className="text-yellow-400">Ready</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">AI Service</span>
                <span className={`flex items-center gap-1 ${aiServiceHealth?.status === 'healthy' ? 'text-green-400' : 'text-red-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${aiServiceHealth?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span>{aiServiceHealth?.status === 'healthy' ? 'Connected' : 'Offline'}</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Detected</span>
                <span className="text-blue-400 font-semibold">{detectionCount} items</span>
              </div>
            </div>
          </div>

          {/* E. Detection History */}
          {lastScannedItems && lastScannedItems.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 shadow-md">
              <p className="text-gray-300 text-xs uppercase tracking-wider font-semibold mb-3">Recent Detections</p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {lastScannedItems.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="bg-gray-700/50 rounded p-2 text-xs">
                    <p className="text-white font-medium">{item.name}</p>
                    <p className="text-gray-400">×{item.count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hidden File Input for Gallery Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Error Modal Overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
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

        {/* Detection Results Modal Overlay */}
        {detectionModal && persistentDetections.length > 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="rounded-lg max-w-2xl w-full shadow-2xl bg-white overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 flex items-start justify-between">
                <div>
                  <p className="font-bold text-xl text-white">
                    ✅ {detectionCount} Instruments Detected
                  </p>
                  <p className="text-sm text-green-100 mt-1">
                    {persistentDetections.length} unique type(s)
                  </p>
                </div>
                <button
                  onClick={() => setDetectionModal(null)}
                  className="p-1 rounded-full hover:bg-white/20 transition"
                >
                  <X size={24} className="text-white" />
                </button>
              </div>

              {/* Detected Items Grid */}
              <div className="p-6 max-h-96 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {persistentDetections.map((item, idx) => (
                    <div
                      key={idx}
                      className="border-2 border-green-200 rounded-lg p-4 bg-green-50 hover:border-green-400 transition"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-bold text-lg text-gray-800">{item.name}</p>
                          <p className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold mt-1">
                            ×{item.count} detected
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-700 space-y-1">
                        <p>
                          <span className="font-semibold">Avg Confidence:</span>{" "}
                          {(item.avgConfidence * 100).toFixed(1)}%
                        </p>
                        <p>
                          <span className="font-semibold">Range:</span>{" "}
                          {(Math.min(...item.confidences) * 100).toFixed(0)}% -{" "}
                          {(Math.max(...item.confidences) * 100).toFixed(0)}%
                        </p>
                        {item.matchedUnitIds.length > 0 && (
                          <p className="text-green-700 font-semibold">
                            ✓ {item.matchedUnitIds.length} unit(s) in inventory
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t px-6 py-4 flex gap-3">
                <button
                  onClick={() => setDetectionModal(null)}
                  className="flex-1 bg-gray-400 hover:bg-gray-500 text-white py-2 rounded-lg font-medium transition"
                >
                  Close
                </button>
                <button
                  onClick={() => setDetectionModal(null)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition"
                >
                  ✓ Got It
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
          <div className="flex flex-col gap-4 bg-black/70 backdrop-blur-sm rounded-2xl p-8 shadow-2xl">
            <h2 className="text-white text-center font-bold text-lg">Ready to scan?</h2>

            <div className="flex gap-4 justify-center">
              {/* Redo Button */}
              <button
                onClick={handleRetake}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Redo
              </button>

              {/* Check Button (Upload) */}
              <button
                onClick={handleCheckCapture}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader className="animate-spin" size={18} />
                    Scanning...
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />
                    Check
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RESULTS VIEW - Back to Normal Scanner with Detections
  if (cameraState === "results") {
    return (
      <div className="w-full min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
          <div className="flex justify-between items-center p-4 max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2">
              <ImageIcon className="text-blue-600" size={24} />
              <h1 className="text-lg font-bold text-blue-600">
                Detection Results
              </h1>
            </div>
            {/* Cart Badge */}
            {cart.length > 0 && (
              <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                <ShoppingCart size={16} />
                <span>{cart.length}</span>
              </div>
            )}
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
        {/* Large Camera Button - Direct Entry to Full-Screen Camera */}
        <button
          onClick={() => setCameraState("camera")}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-lg font-bold transition shadow-lg flex items-center justify-center gap-3 mb-4"
        >
          <Camera size={28} />
          <span className="text-lg">📸 Open Camera</span>
        </button>

        {/* Mode Selection */}
        <div className="flex gap-2 sticky top-24">
          <button
            onClick={() => {
              setCameraState("camera");
              setScanMode("camera");
            }}
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
                ✅ Click capture to take a photo, then upload for detection
              </div>

              {/* Capture Button - Large and prominent */}
              <button
                onClick={handleCapture}
                disabled={isProcessing}
                className="col-span-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold transition text-lg flex items-center justify-center gap-2"
              >
                <Camera size={24} />
                📸 Capture Photo
              </button>

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
                            
                            // Show success modal
                            setAddedItemName(detection.matched_item_name || detection.class_name);
                            setShowAddToCartModal(true);
                            // Don't auto-close - let user click "View Cart" button
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

        {/* Scanned Items Summary (Upload/Capture Results) - Aggregated */}
        {scanSummary && lastScannedItems.length > 0 && (
          <div className="bg-white rounded-lg border-2 border-emerald-200 overflow-hidden shadow-md">
            <div className="bg-emerald-50 px-4 py-4 border-b border-emerald-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-emerald-700 flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" />
                  Scan Results - {scanSummary.totalItems} Item(s) Detected
                </h3>
              </div>
              <p className="text-xs text-emerald-600">
                {scanSummary.itemsToAdd.length} item(s) ready to add to cart
              </p>
            </div>
            <div className="divide-y">
              {lastScannedItems.map((item, idx) => {
                const canAdd = item.matchedItemId && item.matchedUnitIds && item.matchedUnitIds.length > 0;
                return (
                  <div key={idx} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-2">
                          <p className="font-bold text-lg text-gray-800">{item.name}</p>
                          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                            ×{item.count} detected
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs mb-2">
                          <div>
                            <p className="text-gray-600">Average Confidence</p>
                            <p className="font-semibold text-gray-800">{(item.avgConfidence * 100).toFixed(0)}%</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Confidence Range</p>
                            <p className="font-semibold text-gray-800">
                              {(Math.min(...item.confidences) * 100).toFixed(0)}%-{(Math.max(...item.confidences) * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        {canAdd && (
                          <p className="text-xs text-green-600 font-medium">✓ {item.matchedUnitIds.length} unit(s) available</p>
                        )}
                        {!canAdd && (
                          <p className="text-xs text-orange-600 font-medium">⚠️ Not in inventory or no units available</p>
                        )}
                      </div>
                      {canAdd && (
                        <button
                          onClick={async () => {
                            try {
                              // ✅ Validate unit IDs before sending
                              if (!item.matchedUnitIds || item.matchedUnitIds.length === 0) {
                                toast.error(`No unit IDs available for ${item.name}`);
                                return;
                              }

                              console.log(`🚀 Adding ${item.matchedUnitIds.length} unit(s) for ${item.name} to cart...`);

                              // ✅ Add each unit using context's addToCart (ensures proper state management)
                              // This maintains cart persistence via context + localStorage
                              let addedCount = 0;
                              let failedCount = 0;
                              const failedReasons = [];

                              for (let idx = 0; idx < item.matchedUnitIds.length; idx++) {
                                const unitId = item.matchedUnitIds[idx];
                                try {
                                  console.log(`  [${idx + 1}/${item.matchedUnitIds.length}] Adding unit ${unitId}...`);
                                  
                                  // ✅ Use context's addToCart (handles context updates + localStorage)
                                  const result = await addToCart({
                                    unitId: unitId,
                                    itemId: item.matchedItemId,
                                    name: item.name,
                                    category: "instrument",
                                  }, { suppressToast: true });

                                  if (result?.success) {
                                    addedCount++;
                                    console.log(`  ✅ Added unit ${unitId}`);
                                  } else {
                                    failedCount++;
                                    failedReasons.push(`Unit ${idx + 1}: ${result?.error || 'Unknown error'}`);
                                    console.warn(`  ❌ Failed unit ${unitId}: ${result?.error}`);
                                  }
                                } catch (err) {
                                  failedCount++;
                                  failedReasons.push(`Unit ${idx + 1}: ${err.message}`);
                                  console.error(`  ❌ Error adding unit ${unitId}:`, err);
                                }
                              }

                              console.log(`✅ Add result: ${addedCount} added, ${failedCount} failed`);

                              // Show result toast
                              if (addedCount > 0) {
                                setAddedItemName(`${addedCount} unit(s) of ${item.name}`);
                                setShowAddToCartModal(true);
                                // Don't auto-close - let user click "View Cart" button
                                setDetectionCount((prev) => prev + addedCount);

                                if (failedCount > 0) {
                                  toast.warning(`✅ Added ${addedCount} but ${failedCount} failed`);
                                } else {
                                  toast.success(`✅ Added all ${addedCount} unit(s) to cart!`);
                                }
                              } else if (failedCount > 0) {
                                toast.error(`❌ Failed to add any units: ${failedReasons[0]}`);
                              }
                            } catch (err) {
                              console.error("Add to cart error:", err);
                              toast.error(err.response?.data?.error || "Failed to add to cart");
                            }
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-medium text-sm whitespace-nowrap flex-shrink-0"
                        >
                          + Add All {item.matchedUnitIds.length}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Old Scanned Items Results - DEPRECATED */}
        {false && lastScannedItems.length > 0 && (
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
            onClick={() => {
              setSidebarOpen(true);
              navigate(-1);
            }}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-blue-600 transition"
          >
            <Camera size={20} />
            <span className="text-xs">Back</span>
          </button>
          <button
            onClick={clearHistory}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-blue-600 transition"
          >
            <RefreshCw size={20} />
            <span className="text-xs">Refresh</span>
          </button>
          {/* Go to Cart Button - Only show if cart has items */}
          {cart.length > 0 && (
            <button
              onClick={() => {
                setSidebarOpen(true);
                navigate("/borrow-cart");
              }}
              className="flex flex-col items-center gap-1 text-emerald-600 hover:text-emerald-700 transition font-semibold"
              title={`View cart (${cart.length} items)`}
            >
              <div className="relative">
                <ShoppingCart size={20} />
                <span className="absolute -top-2 -right-2 bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              </div>
              <span className="text-xs">Cart</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
  }

  // DEFAULT VIEW - Normal scanner with mode selection
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
          {/* Cart Badge */}
          {cart.length > 0 && (
            <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
              <ShoppingCart size={16} />
              <span>{cart.length}</span>
            </div>
          )}
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

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-4">
        {/* Large Camera Button - Direct Entry to Full-Screen Camera */}
        <button
          onClick={() => setCameraState("camera")}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-lg font-bold transition shadow-lg flex items-center justify-center gap-3 mb-4"
        >
          <Camera size={28} />
          <span className="text-lg">📸 Open Camera</span>
        </button>

        {/* Or divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-gray-600 text-sm font-medium">Or</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        {/* Upload Option */}
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center hover:border-blue-500 transition cursor-pointer bg-blue-50"
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

        {/* AI Service Status Info */}
        {aiServiceHealth?.status === "unhealthy" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              ⚠️ <strong>AI Service Unavailable:</strong> {aiServiceHealth?.error}
            </p>
          </div>
        )}

        {/* Add to Cart Success Modal */}
        <AddToCartModal
          isOpen={showAddToCartModal}
          onClose={() => setShowAddToCartModal(false)}
          itemName={addedItemName}
        />
      </div>
    </div>
  );
}
