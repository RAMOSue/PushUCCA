import { useEffect, useRef, useState } from "react";
import { Camera, X, Check, RotateCcw, Loader, AlertCircle, Plus, Trash2 } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

/**
 * Modal for staff to capture photos of returned items
 * Used in StaffBorrowTimeline.jsx for manual return processing
 */
export default function StaffReturnPhotoCaptureModal({
  isOpen,
  requestId,
  borrowerName,
  itemCount,
  onClose,
  onPhotosSubmitted,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [cameraActive, setCameraActive] = useState(true);
  const [error, setError] = useState("");
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Choose the best default camera and mirror preview automatically for front-facing cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");

        let preferredCamera = videoDevices.find((d) => /back|rear|environment/i.test(d.label));
        if (!preferredCamera) {
          preferredCamera = videoDevices.find((d) => /front|user|facing/i.test(d.label));
        }
        if (!preferredCamera && videoDevices.length > 0) {
          preferredCamera = videoDevices[0];
        }

        if (preferredCamera) {
          setActiveCameraId(preferredCamera.deviceId);
          setIsFlipped(/front|user|facing/i.test(preferredCamera.label));
        }
      } catch (err) {
        console.error("Error enumerating cameras:", err);
      }
    };

    getCameras();
  }, []);

  // Initialize camera on modal open
  useEffect(() => {
    if (!isOpen || !cameraActive) return;

    const initCamera = async () => {
      if (isInitializing) return;
      setIsInitializing(true);
      
      try {
        setError("");
        
        // Stop existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        // Try with optimal constraints first, then fallback to basic
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: activeCameraId ? { exact: activeCameraId } : undefined,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch (err) {
          // Fallback to basic constraints
          console.warn("Optimal constraints failed, trying basic:", err);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch((e) => {
              console.error("Play error:", e);
              setError("Failed to start video playback");
            });
            setIsCameraReady(true);
          };
          
          // Fallback: set ready state after 1 second if metadata doesn't load
          const timeout = setTimeout(() => {
            if (!isCameraReady) {
              setIsCameraReady(true);
            }
          }, 1000);
          
          return () => clearTimeout(timeout);
        }
      } catch (err) {
        console.error("Camera error:", err);
        
        // Better error messages
        let errorMsg = "Unable to access camera. ";
        if (err.name === "NotAllowedError") {
          errorMsg += "Permission denied. Please grant camera access.";
        } else if (err.name === "NotFoundError") {
          errorMsg += "No camera found on this device.";
        } else if (err.name === "NotReadableError") {
          errorMsg += "Camera is in use by another application.";
        } else if (err.name === "AbortError") {
          errorMsg += "Camera initialization timed out. Please try again.";
        } else {
          errorMsg += "Check camera permissions and settings.";
        }
        
        setError(errorMsg);
        toast.error("❌ " + errorMsg);
      } finally {
        setIsInitializing(false);
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, cameraActive, activeCameraId]);


  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) return;

    try {
      const context = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      
      // Mirror if front camera
      if (isFlipped) {
        context.translate(canvasRef.current.width, 0);
        context.scale(-1, 1);
      }
      
      context.drawImage(videoRef.current, 0, 0);

      const photoData = canvasRef.current.toDataURL("image/jpeg", 0.8);
      setCapturedPhoto(photoData);
      setCameraActive(false);
      toast.success("✅ Photo captured");
    } catch (err) {
      console.error("Capture error:", err);
      toast.error("Failed to capture photo");
    }
  };

  const addPhotoToList = () => {
    if (!capturedPhoto) return;

    setPhotos([...photos, capturedPhoto]);
    setCapturedPhoto(null);
    setCameraActive(true);
    toast.success(`📸 Photo added (${photos.length + 1} total)`);
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
    toast.success("Photo removed");
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setCameraActive(true);
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      toast.error("Please capture at least one photo");
      return;
    }

    try {
      setIsSubmitting(true);

      // Convert base64 images to blobs
      const photoBlobs = await Promise.all(
        photos.map(async (photoData) => {
          const response = await fetch(photoData);
          return response.blob();
        })
      );

      // Create FormData with photos
      const formData = new FormData();
      formData.append("borrowing_request_id", requestId);
      photoBlobs.forEach((blob, index) => {
        formData.append(`photos`, blob, `return-photo-${index}.jpg`);
      });

      // Submit photos and mark as received
      const response = await axios.post(
        "/api/borrow/return/manual-with-photos",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true,
        }
      );

      if (response.data.success) {
        toast.success(`✅ ${photos.length} photo(s) captured and items received!`);
        onPhotosSubmitted();
        onClose();
      } else {
        toast.error(response.data.error || "Failed to submit photos");
      }
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(err.response?.data?.error || "Failed to submit photos");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto shadow-2xl">
        <div className="p-0">
          {/* Main Content */}
        <div className="p-6 space-y-4">
          {/* Camera or Preview */}
          {cameraActive && !capturedPhoto ? (
            <div className="space-y-4">
              <div className="bg-black rounded-lg overflow-hidden relative">
                <video
                  ref={videoRef}
                  className="w-full aspect-video object-cover block"
                  playsInline
                  muted
                  style={{ transform: isFlipped ? "scaleX(-1)" : "scaleX(1)" }}
                />
                
                {isInitializing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader className="animate-spin text-white" size={32} />
                      <p className="text-white text-sm">Starting camera...</p>
                    </div>
                  </div>
                )}
                
                {!isCameraReady && !isInitializing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <p className="text-white text-sm">Initializing camera...</p>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={capturePhoto}
                disabled={!isCameraReady || isInitializing}
                className="mx-auto mt-4 w-16 h-16 rounded-full bg-white/95 border-4 border-white shadow-xl flex items-center justify-center transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Capture photo"
              >
                <span className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white">
                  <Camera className="w-5 h-5" />
                </span>
              </button>
            </div>
          ) : capturedPhoto ? (
            <div className="space-y-4">
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={capturedPhoto}
                  alt="Captured"
                  className="w-full aspect-video object-cover"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={retakePhoto}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} />
                  Retake
                </button>
                <button
                  onClick={addPhotoToList}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  Add to List
                </button>
              </div>
            </div>
          ) : null}

          {/* Photos List */}
          {photos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  Captured Photos ({photos.length})
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={photo}
                      alt={`Return photo ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border-2 border-green-200"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add More Photos Button */}
              {!capturedPhoto && (
                <button
                  onClick={() => setCameraActive(true)}
                  className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 text-blue-600 hover:text-blue-700 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Capture Another Photo
                </button>
              )}
            </div>
          )}
        </div>      </div>
        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg font-medium transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || photos.length === 0}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader className="animate-spin" size={18} />
                Submitting...
              </>
            ) : (
              <>
                <Check size={18} />
                Submit & Mark Received
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
