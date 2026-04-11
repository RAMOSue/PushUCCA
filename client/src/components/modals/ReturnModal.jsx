import { useEffect, useRef, useState } from "react";
import {
  Camera,
  X,
  Check,
  RotateCcw,
  Upload,
  AlertCircle,
  CheckCircle,
  Trash2,
  Edit2,
} from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

/**
 * Unified Return Modal
 * Flow: Select Items → Capture Photos → Submit Return
 * Persistent modal stays open through entire return process
 */
export default function ReturnModal({
  isOpen,
  requestId,
  items = [],
  onClose,
  onReturnComplete,
}) {
  // Step state: 'select' | 'capture' | 'review' | 'submitted'
  const [step, setStep] = useState("select");
  const [selectedItems, setSelectedItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [returnRequestId, setReturnRequestId] = useState(null);

  // Camera state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Photo capture state
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [error, setError] = useState("");
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing photos when modal opens
  useEffect(() => {
    if (!isOpen || !requestId) return;

    const loadPhotos = async () => {
      try {
        const response = await axios.get(
          `/api/borrow/return/photos/${requestId}`,
          { withCredentials: true }
        );
        if (response.data.success) {
          setPhotos(response.data.photos || []);
        }
      } catch (err) {
        console.error("Failed to load return photos:", err);
      }
    };

    loadPhotos();
    setSelectedItems(items.map((item) => item.id || item.unit_id || item.inventory_unit_id) || []);
  }, [isOpen, requestId, items]);

  // Initialize camera when entering capture step
  useEffect(() => {
    if (step !== "capture" || !cameraActive) return;

    const initCamera = async () => {
      try {
        setError("");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setIsCameraReady(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Cannot access camera. Please check permissions.");
        toast.error("Camera access denied");
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [step, cameraActive]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen && streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, [isOpen]);

  const handleToggleItem = (itemId) => {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleInitiateReturn = async () => {
    if (selectedItems.length === 0) {
      setError("Please select at least one item to return");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await axios.post(
        `/api/borrow/return/initiate`,
        {
          borrowing_request_id: requestId,
          returned_unit_ids: selectedItems,
          notes: notes,
        },
        { withCredentials: true }
      );

      if (response.data.success) {
        setReturnRequestId(response.data.return_request_id);
        toast.success("✅ Return initiated. Now capture photos.");
        setStep("capture");
        setCameraActive(true);
      } else {
        setError(response.data.error || "Failed to initiate return");
      }
    } catch (err) {
      console.error("Initiate return error:", err);
      setError(
        err.response?.data?.error || "Failed to initiate return"
      );
      toast.error("Failed to initiate return");
    } finally {
      setIsSubmitting(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext("2d");
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    if (isFlipped) {
      context.scale(-1, 1);
      context.drawImage(
        videoRef.current,
        -canvasRef.current.width,
        0
      );
    } else {
      context.drawImage(videoRef.current, 0, 0);
    }

    canvasRef.current.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      setCapturedPhoto(url);
      setCameraActive(false);
    });
  };

  const resetCapture = () => {
    if (capturedPhoto) {
      URL.revokeObjectURL(capturedPhoto);
    }
    setCapturedPhoto(null);
    setCameraActive(true);
  };

  const uploadPhoto = async () => {
    if (!capturedPhoto || !requestId) return;

    setIsUploading(true);

    try {
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append("photo", blob, `return-photo-${Date.now()}.jpg`);

      const uploadResponse = await axios.post(
        `/api/borrow/return/photos/${requestId}/upload`,
        formData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (uploadResponse.data.success) {
        setPhotos([...photos, uploadResponse.data.photo]);
        resetCapture();
        toast.success("✅ Photo uploaded successfully");
      } else {
        setError(uploadResponse.data.error || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.response?.data?.error || "Failed to upload photo");
      toast.error("Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  const deletePhoto = async (photoId) => {
    if (!window.confirm("Delete this photo?")) return;

    try {
      const response = await axios.delete(
        `/api/borrow/return/photos/${photoId}`,
        { withCredentials: true }
      );

      if (response.data.success) {
        setPhotos(photos.filter((p) => p.id !== photoId));
        toast.success("✅ Photo deleted");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete photo");
    }
  };

  const handleSubmitReturn = async () => {
    if (photos.length === 0) {
      setError("Please capture at least one photo before submitting");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await axios.post(
        `/api/borrow/return/submit`,
        {
          return_request_id: returnRequestId,
          borrowing_request_id: requestId,
          photos_count: photos.length,
        },
        { withCredentials: true }
      );

      if (response.data.success) {
        toast.success("✅ Return submitted successfully!");
        setStep("submitted");
        setTimeout(() => {
          onReturnComplete();
          handleClose();
        }, 1500);
      } else {
        setError(response.data.error || "Failed to submit return");
      }
    } catch (err) {
      console.error("Submit return error:", err);
      setError(err.response?.data?.error || "Failed to submit return");
      toast.error("Failed to submit return");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setStep("select");
    setCapturedPhoto(null);
    setPhotos([]);
    setError("");
    setCameraActive(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl dark:shadow-2xl dark:shadow-black/40 max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-colors">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 bg-gradient-to-r from-orange-50 to-red-50 dark:from-[#222] dark:to-[#222] sticky top-0 z-10 transition-colors">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {step === "select" && "Return Items"}
            {step === "capture" && "Capture Return Photos"}
            {step === "review" && "Review Return"}
            {step === "submitted" && "Return Submitted"}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Select Items */}
          {step === "select" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  Select Items to Return
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">No items to return</p>
                  ) : (
                    items.map((item, idx) => (
                      <label
                        key={idx}
                        className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#222] cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(
                            item.id || item.unit_id || item.inventory_unit_id
                          )}
                          onChange={() =>
                            handleToggleItem(
                              item.id ||
                                item.unit_id ||
                                item.inventory_unit_id
                            )
                          }
                          className="w-4 h-4 text-orange-600"
                        />
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200">
                            {item.item_name || item.name || "N/A"}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Size: {item.size || "N/A"} • Condition:{" "}
                            {item.condition || "N/A"}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Return Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about the condition or damage..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#333] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-600 focus:border-transparent transition-colors"
                  rows="3"
                />
              </div>

              {error && (
                <div className="flex gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222] font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInitiateReturn}
                  disabled={isSubmitting || selectedItems.length === 0}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? "Processing..." : "Next: Capture Photos"}
                  <Edit2 size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Capture Photos */}
          {step === "capture" && (
            <div className="space-y-6">
              {cameraActive && (
                <div className="bg-black rounded-lg overflow-hidden relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className={`w-full h-96 object-cover ${
                      isFlipped ? "scale-x-[-1]" : ""
                    }`}
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />

                  {/* Camera Controls Overlay */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                    <button
                      onClick={() => setIsFlipped(!isFlipped)}
                      className="p-3 bg-white text-gray-800 rounded-full hover:bg-gray-100 shadow-lg"
                      title="Flip camera"
                    >
                      <RotateCcw size={20} />
                    </button>
                    <button
                      onClick={capturePhoto}
                      disabled={!isCameraReady}
                      className="p-3 bg-orange-600 text-white rounded-full hover:bg-orange-700 shadow-lg disabled:opacity-50"
                    >
                      <Camera size={24} />
                    </button>
                  </div>
                </div>
              )}

              {/* Captured Photo Preview */}
              {capturedPhoto && (
                  <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
                    <img
                      src={capturedPhoto}
                      alt="Captured"
                      className="w-full h-96 object-cover"
                    />
                    <div className="bg-gray-50 dark:bg-[#222] p-3 flex gap-2 transition-colors">
                      <button
                        onClick={resetCapture}
                        disabled={isUploading}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] font-semibold disabled:opacity-50 transition-colors"
                    >
                      <RotateCcw size={18} className="inline mr-2" />
                      Retake
                    </button>
                    <button
                      onClick={uploadPhoto}
                      disabled={isUploading}
                      className="flex-1 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold disabled:opacity-50"
                    >
                      {isUploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              {/* Photos Gallery */}
              {photos.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">
                    📸 Captured Photos ({photos.length})
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative rounded-lg overflow-hidden group"
                      >
                        <img
                          src={photo.photo_url}
                          alt="Return photo"
                          className="w-full h-24 object-cover"
                        />
                        <button
                          onClick={() => deletePhoto(photo.id)}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                          {new Date(photo.uploaded_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("select")}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmitReturn}
                  disabled={
                    isSubmitting ||
                    photos.length === 0
                  }
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? "Submitting..." : "Submit Return"}
                  <Check size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Submitted */}
          {step === "submitted" && (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <CheckCircle size={64} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-green-600 mb-2">
                  Return Submitted!
                </h3>
                <p className="text-gray-600">
                  Thank you! Your return request has been submitted with{" "}
                  <strong>{photos.length} photo(s)</strong>.
                </p>
                <p className="text-sm text-gray-500 mt-3">
                  Staff will review your submission shortly.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
