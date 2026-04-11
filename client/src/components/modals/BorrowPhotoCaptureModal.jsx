import { useEffect, useRef, useState } from "react";
import { Camera, X, Check, RotateCcw, Upload, AlertCircle } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

/**
 * Modal to capture photos of items before/after borrowing
 * Used in BorrowCart.jsx when submitting borrow request
 */
export default function BorrowPhotoCaptureModal({
  isOpen,
  requestId,
  onClose,
  onPhotosCaptured,
  itemCount = 0,
  addToCart,  // ✅ Add this function from BorrowingContext
  borrowerId,  // ✅ Borrower ID for batch add
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [cameraActive, setCameraActive] = useState(true);
  const [error, setError] = useState("");
  const [detectedItems, setDetectedItems] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showDetectionSummary, setShowDetectionSummary] = useState(false);

  // Load photos from API on mount
  useEffect(() => {
    if (!isOpen || !requestId) return;

    const loadPhotos = async () => {
      try {
        const response = await axios.get(`/api/borrow/photos/${requestId}`, {
          withCredentials: true,
        });
        if (response.data.success) {
          setPhotos(response.data.photos);
        }
      } catch (err) {
        console.error("Failed to load photos:", err);
      }
    };

    loadPhotos();
  }, [isOpen, requestId]);

  // Initialize camera
  useEffect(() => {
    if (!isOpen || !cameraActive) return;

    const initCamera = async () => {
      try {
        // Stop any existing stream before starting a new one
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => {
            track.stop();
          });
          streamRef.current = null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setIsCameraReady(true);
          setError("");
        }
      } catch (err) {
        console.error("Camera error:", err);
        let errorMessage = "Cannot access camera. Please check permissions.";
        
        if (err.name === "NotReadableError") {
          errorMessage = "Camera is already in use. Please close other camera apps and try again.";
        } else if (err.name === "NotAllowedError") {
          errorMessage = "Camera permission denied. Please allow camera access in settings.";
        } else if (err.name === "NotFoundError") {
          errorMessage = "No camera device found.";
        }
        
        setError(errorMessage);
        setIsCameraReady(false);
        toast.error(errorMessage);
      }
    };

    initCamera();

    return () => {
      // Cleanup: stop all tracks when component unmounts or dependencies change
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }
      setIsCameraReady(false);
    };
  }, [isOpen, cameraActive]);

  // Aggregate detections by instrument name
  const aggregateDetections = (predictions) => {
    if (!predictions || predictions.length === 0) return [];
    
    console.log("📊 Raw predictions for aggregation:", predictions);
    
    const grouped = {};
    predictions.forEach((pred) => {
      // Use matched_item_name first (from DB), fallback to class_name (from AI)
      const name = pred.matched_item_name || pred.class_name;
      
      if (!name) {
        console.warn("⚠️ Prediction has no name:", pred);
        return;
      }

      if (!grouped[name]) {
        grouped[name] = {
          name: name,
          count: 0,
          confidences: [],
          matchedItemId: pred.matched_item_id,
          matchedUnitIds: [],
          predictions: [],
        };
      }
      grouped[name].count++;
      grouped[name].predictions.push(pred);
      grouped[name].confidences.push(pred.confidence || 0);
      
      // ✅ FIX: Verify unit ID before adding and log it
      if (pred.matched_unit_id) {
        grouped[name].matchedUnitIds.push(pred.matched_unit_id);
        console.log(`✅ Matched unit ${pred.matched_unit_id} for ${name}`);
      } else {
        console.warn(`⚠️ No matched_unit_id for prediction:`, pred);
      }
    });
    
    const result = Object.values(grouped)
      .map((item) => ({
        ...item,
        avgConfidence:
          item.confidences.length > 0
            ? item.confidences.reduce((a, b) => a + b, 0) / item.confidences.length
            : 0,
        maxConfidence: Math.max(...item.confidences),
      }))
      .sort((a, b) => b.count - a.count);
    
    // ✅ NEW: Detailed logging of aggregation with unit counts
    result.forEach((item) => {
      console.log(`📦 ${item.name}: count=${item.count}, unitIds=[${item.matchedUnitIds.join(', ')}], itemId=${item.matchedItemId}`);
    });
    console.log("✅ Aggregated result:", result);
    
    return result;
  };

  // Detect instruments in captured image
  const detectInstruments = async (imageBase64) => {
    setIsDetecting(true);
    try {
      // Convert base64 to blob
      const blob = await fetch(imageBase64).then((res) => res.blob());
      const formData = new FormData();
      formData.append("image", blob, "photo.jpg");

      const response = await axios.post(
        "/api/image-recognition/scan",
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      console.log("🎵 Detection response:", response.data);

      // Check for success type (backend returns type: "success" or "no_items")
      if (response.data.type === "success" && response.data.predictions) {
        const aggregated = aggregateDetections(response.data.predictions);
        setDetectedItems(aggregated);
        console.log("🎵 Aggregated instruments:", aggregated);

        // Show summary modal after detection completes
        setTimeout(() => {
          setShowDetectionSummary(true);
        }, 500);
      } else if (response.data.type === "no_items") {
        setDetectedItems([]);
        toast.error("No instruments detected. Please try a clearer image.");
      }
    } catch (err) {
      console.error("Detection error:", err);
      toast.error("Detection failed. Please try again.");
    } finally {
      setIsDetecting(false);
    }
  };

  // Add all detected items to cart
  const handleAddAllToCart = async () => {
    if (!capturedPhoto || !requestId) {
      toast.error("Photo or request ID missing");
      return;
    }

    if (!addToCart) {
      toast.error("Add to cart function not available");
      return;
    }

    setIsUploading(true);
    try {
      // Convert base64 to blob and upload photo
      const blob = await fetch(capturedPhoto).then((res) => res.blob());
      const formData = new FormData();
      formData.append("photo", blob, "photo.jpg");
      formData.append("photoType", "item-photo");

      const response = await axios.post(
        `/api/borrow/photos/${requestId}/upload`,
        formData,
        { withCredentials: true, headers: { "Content-Type": "multipart/form-data" } }
      );

      if (response.data.success) {
        // ✅ FIX: Add each detected item to cart SEQUENTIALLY with proper error handling
        let addedCount = 0;
        let failedCount = 0;
        const totalUnits = detectedItems.reduce((sum, item) => sum + item.count, 0);

        console.log(`🎵 Batch adding ${totalUnits} units to cart...`);

        // ✅ NEW: Build batch request with all items
        const batchItems = [];
        for (const item of detectedItems) {
          for (let i = 0; i < item.count; i++) {
            const unitId = item.matchedUnitIds[i];
            if (unitId) {
              batchItems.push({
                unit_id: unitId,
                item_id: item.matchedItemId,
                quantity: 1,
              });
            }
          }
        }

        if (batchItems.length === 0) {
          toast.error("❌ No valid items to add");
          return;
        }

        try {
          // ✅ Call batch endpoint ONCE instead of sequential calls
          const batchRes = await axios.post("/api/borrow/cart/batch-add", {
            borrower_id: borrowerId,
            items: batchItems,
          });

          if (batchRes.data.success) {
            const { items: addedItems, failed_items } = batchRes.data;
            const addedCount = addedItems?.length || 0;
            const failedCount = failed_items?.length || 0;

            console.log(`✅ Batch add result: Added ${addedCount}, Failed ${failedCount}`);

            // Show summary
            if (addedCount > 0 && failedCount === 0) {
              toast.success(`✅ All ${addedCount} instrument${addedCount !== 1 ? 's' : ''} added to cart!`);
            } else if (addedCount > 0 && failedCount > 0) {
              const failureText = failed_items.map(f => f.error || 'Unknown error').join(', ');
              toast.warning(`✅ Added ${addedCount}, but ${failedCount} failed: ${failureText}`);
            } else if (failedCount > 0) {
              const failureText = failed_items.map(f => f.error || 'Unknown error').join(', ');
              toast.error(`❌ Failed to add items: ${failureText}`);
            }

            // Clear state only if at least one item was added
            if (addedCount > 0) {
              setPhotos([...photos, response.data.photo]);
              setCapturedPhoto(null);
              setCameraActive(true);
              setDetectedItems([]);
              setShowDetectionSummary(false);
            }
          } else {
            toast.error(batchRes.data.error || "Failed to add items to cart");
          }
        } catch (err) {
          console.error("Batch add error:", err);
          toast.error(err.response?.data?.error || "Failed to add items to cart");
        } finally {
          setIsUploading(false);
        }
      } else {
        toast.error("Failed to upload photo");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.response?.data?.error || "Failed to upload photo");
      setIsUploading(false);
    }
  };

  // Close summary and recapture
  const handleCloseSummary = () => {
    setShowDetectionSummary(false);
    setDetectedItems([]);
  };

  // Capture photo from video stream
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext("2d");
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    context.drawImage(videoRef.current, 0, 0);
    const imageData = canvasRef.current.toDataURL("image/jpeg", 0.9);

    setCapturedPhoto(imageData);
    setCameraActive(false);
    setDetectedItems([]);

    // Auto-detect instruments in captured image
    await detectInstruments(imageData);
  };

  // Recapture (show camera again)
  const handleRecapture = () => {
    setCapturedPhoto(null);
    setCameraActive(true);
    setDetectedItems([]);
  };

  // Upload captured photo
  const handleConfirmPhoto = async () => {
    if (!capturedPhoto || !requestId) {
      toast.error("Photo or request ID missing");
      return;
    }

    setIsUploading(true);

    try {
      // Convert base64 to blob
      const blob = await fetch(capturedPhoto).then((res) => res.blob());
      const formData = new FormData();
      formData.append("photo", blob, "photo.jpg");
      formData.append("photoType", "item-photo");

      const response = await axios.post(
        `/api/borrow/photos/${requestId}/upload`,
        formData,
        { withCredentials: true, headers: { "Content-Type": "multipart/form-data" } }
      );

      if (response.data.success) {
        toast.success("✅ Photo captured and uploaded!");
        setPhotos([...photos, response.data.photo]);
        setCapturedPhoto(null);
        setCameraActive(true);
      } else {
        toast.error("Failed to upload photo");
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.response?.data?.error || "Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  // Done capturing photos
  const handleDone = () => {
    if (photos.length === 0) {
      toast.error("Please capture at least one photo");
      return;
    }
    // Stop camera stream before closing
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    onPhotosCaptured?.(photos);
    onClose();
  };

  // Handle modal close - clean up camera
  const handleCloseModal = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow-2xl dark:shadow-2xl dark:shadow-black/40 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">📸 Capture Item Photos</h2>
          </div>
          <button
            onClick={handleCloseModal}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-start gap-2 transition-colors">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Camera View */}
          {cameraActive && !showDetectionSummary && (
            <div className="space-y-4">
              <div className="relative bg-black dark:bg-black rounded-lg overflow-hidden aspect-video">
                {!isCameraReady && error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 dark:bg-black text-white">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-500" />
                      <p className="text-sm">{error}</p>
                      <button
                        onClick={() => {
                          setError("");
                          setCameraActive(false);
                          setCameraActive(true);
                        }}
                        className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition"
                      >
                        Retry Camera
                      </button>
                    </div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${!isCameraReady ? "hidden" : ""}`}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <p className="text-sm text-gray-600 text-center">
                Position your items in frame and click "Capture"
              </p>

              <button
                onClick={handleCapture}
                disabled={!isCameraReady}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Capture Photo
              </button>
            </div>
          )}

          {/* Preview & Confirm */}
          {capturedPhoto && !cameraActive && !showDetectionSummary && (
            <div className="space-y-4">
              <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
                <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
              </div>

              {isDetecting && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium">🔍 Detecting instruments...</span>
                  </div>
                </div>
              )}

              {detectedItems.length > 0 && !isDetecting && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    🎵 Detected Instruments
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {detectedItems.map((item, idx) => (
                      <div key={idx} className="flex items-start justify-between bg-white p-2 rounded border border-green-100">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 flex items-center gap-2">
                            {item.name}
                            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">
                              ×{item.count}
                            </span>
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Confidence: {(item.avgConfidence * 100).toFixed(0)}% avg
                            {item.confidences.length > 1 && (
                              <span> (Range: {Math.round(Math.min(...item.confidences) * 100)}%-{Math.round(Math.max(...item.confidences) * 100)}%)</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-green-100 font-medium">
                      ✓ Total: {detectedItems.reduce((sum, item) => sum + item.count, 0)} instruments detected
                    </p>
                  </div>
                </div>
              )}

              {!isDetecting && detectedItems.length === 0 && capturedPhoto && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  ⚠️ No instruments detected. Please try a clearer image.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleRecapture}
                  className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Recapture
                </button>

                <button
                  onClick={handleConfirmPhoto}
                  disabled={isUploading}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Upload className="w-5 h-5 animate-pulse" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Confirm
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Photos List */}
          {photos.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                Captured Photos ({photos.length})
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, idx) => {
                  // Handle dynamic photo URL
                  const photoUrl = photo.photo_url?.startsWith('http')
                    ? photo.photo_url
                    : `http://localhost:8000${photo.photo_url}`;

                  return (
                    <div
                      key={photo.id || idx}
                      className="relative aspect-square bg-gray-100 rounded overflow-hidden group"
                    >
                      <img
                        src={photoUrl}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f3f4f6" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="12"%3EUnable to load%3C/text%3E%3C/svg%3E';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Detection Summary Modal */}
        {showDetectionSummary && detectedItems.length > 0 && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Check className="w-6 h-6 text-green-600" />
                🎵 Detection Complete
              </h3>

              {/* Detected Instruments List */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto space-y-3">
                {detectedItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 pb-3 border-b border-gray-200 last:border-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800">{item.name}</span>
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-500 text-white text-xs font-bold rounded-full">
                          ×{item.count}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Confidence: {(item.avgConfidence * 100).toFixed(1)}%
                        {item.confidences.length > 1 && (
                          <span> • Range: {Math.round(Math.min(...item.confidences) * 100)}%-{Math.round(Math.max(...item.confidences) * 100)}%</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-center">
                <p className="text-sm font-semibold text-blue-900">
                  Total detected: {detectedItems.reduce((sum, item) => sum + item.count, 0)} items
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCloseSummary}
                  className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAllToCart}
                  disabled={isUploading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Add All
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t p-6 flex justify-between">
          <button
            onClick={handleCloseModal}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleDone}
            disabled={photos.length === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-semibold"
          >
            Done ({photos.length} photos)
          </button>
        </div>
      </div>
    </div>
  );
}
