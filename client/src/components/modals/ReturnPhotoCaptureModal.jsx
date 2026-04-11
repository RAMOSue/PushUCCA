import { useEffect, useRef, useState } from "react";
import { Camera, X, Check, RotateCcw, Upload, AlertCircle } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

/**
 * Modal to capture photos of returned items
 * Mirrors BorrowPhotoCaptureModal but for return verification
 * Used in MyBorrowedItems.jsx when returning items
 */
export default function ReturnPhotoCaptureModal({
  isOpen,
  requestId,
  returnRequestId,
  onClose,
  onReturnComplete,
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

  // Load existing return photos on modal open
  useEffect(() => {
    if (!isOpen || !requestId) return;

    const loadPhotos = async () => {
      try {
        const response = await axios.get(`/api/borrow/return/photos/${requestId}`, {
          withCredentials: true,
        });
        if (response.data.success) {
          setPhotos(response.data.photos);
        }
      } catch (err) {
        console.error("Failed to load return photos:", err);
      }
    };

    loadPhotos();
  }, [isOpen, requestId]);

  // Initialize camera
  useEffect(() => {
    if (!isOpen || !cameraActive) return;

    const initCamera = async () => {
      try {
        setError("");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setIsCameraReady(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Cannot access camera. Please check permissions.");
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, cameraActive]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext("2d");
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);

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
    } finally {
      setIsUploading(false);
    }
  };

  const deletePhoto = async (photoId) => {
    if (!window.confirm("Delete this photo?")) return;

    try {
      const response = await axios.delete(`/api/borrow/return/photos/${photoId}`, {
        withCredentials: true,
      });

      if (response.data.success) {
        setPhotos(photos.filter((p) => p.id !== photoId));
        toast.success("✅ Photo deleted");
      }
    } catch (err) {
      toast.error("Failed to delete photo");
    }
  };

  const completeReturn = async () => {
    if (photos.length === 0) {
      setError("Please capture at least one photo of the returned items");
      return;
    }

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
        toast.success("✅ Return submitted with photos for verification!");
        
        if (onReturnComplete) {
          onReturnComplete();
        }
        
        onClose();
      } else {
        setError(response.data.error || "Failed to submit return");
      }
    } catch (err) {
      console.error("Return submission error:", err);
      setError(err.response?.data?.error || "Failed to submit return");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gradient-to-r from-orange-50 to-orange-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Capture Return Photos</h2>
              <p className="text-xs sm:text-sm text-gray-600">Take photos of returned items for verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camera Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Camera</h3>

              {isCameraReady && cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg bg-gray-900 aspect-video object-cover border-2 border-gray-300"
                  />
                  <button
                    onClick={capturePhoto}
                    className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" /> Capture Photo
                  </button>
                </>
              ) : capturedPhoto ? (
                <>
                  <img
                    src={capturedPhoto}
                    alt="Captured"
                    className="w-full rounded-lg bg-gray-100 aspect-video object-cover border-2 border-gray-300"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={resetCapture}
                      disabled={isUploading}
                      className="flex-1 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" /> Retake
                    </button>
                    <button
                      onClick={uploadPhoto}
                      disabled={isUploading}
                      className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" /> Upload
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                  <p>Camera loading...</p>
                </div>
              )}
            </div>

            {/* Photos Gallery */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">
                Captured Photos ({photos.length})
              </h3>

              {photos.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-gray-500 bg-gray-50 rounded-lg">
                  <p>No photos yet. Capture photos on the left.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {photos.map((photo) => {
                    const photoUrl = photo.photo_url?.startsWith("http")
                      ? photo.photo_url
                      : `http://localhost:8000${photo.photo_url}`;

                    return (
                      <div
                        key={photo.id}
                        className="relative group bg-gray-100 rounded-lg overflow-hidden aspect-square"
                      >
                        <img
                          src={photoUrl}
                          alt="Return photo"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect fill='%23e5e7eb' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' font-family='system-ui' font-size='10' fill='%239ca3af'%3EError%3C/text%3E%3C/svg%3E";
                          }}
                        />

                        {/* Delete overlay */}
                        <button
                          onClick={() => deletePhoto(photo.id)}
                          className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100"
                          title="Delete photo"
                        >
                          <X className="w-6 h-6 text-white bg-red-600 rounded-full p-1" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Info */}
          <div className="mt-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs sm:text-sm text-blue-700">
              <strong>📸 Tips:</strong> Take clear photos from multiple angles to show the
              condition of returned items. Ensure good lighting and that items are clearly visible.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 sm:p-6 flex gap-2 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-semibold text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            onClick={completeReturn}
            disabled={photos.length === 0}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" /> Complete Return ({photos.length} photos)
          </button>
        </div>
      </div>
    </div>
  );
}
