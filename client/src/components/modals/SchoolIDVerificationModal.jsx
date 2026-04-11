import React, { useEffect, useRef, useState } from "react";
import { Camera, X, AlertCircle, CheckCircle, ShieldAlert, Loader, RotateCcw } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

/**
 * School ID Verification Modal
 * Captures ID images and validates them using AI/OCR detection
 * Features:
 * - Live camera preview
 * - Real-time ID detection (front & back)
 * - Verification status feedback
 * - Google Lens-like functionality
 */
export default function SchoolIDVerificationModal({
  isOpen,
  onClose,
  onIdVerified,
  fieldName, // "id_front" or "id_back"
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // State management
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState("");
  const [detectionFeedback, setDetectionFeedback] = useState("");
  const [isIdDetected, setIsIdDetected] = useState(false);

  // Initialize camera with auto-focus and fallback constraints
  useEffect(() => {
    if (!isOpen || !cameraActive) return;

    const initCamera = async () => {
      if (isInitializing) return; // Prevent concurrent initialization
      
      setIsInitializing(true);
      setError("");
      
      try {
        // Stop any existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        let stream;
        let initSuccessful = false;

        // ✅ Try with increasingly relaxed constraints
        const constraintOptions = [
          {
            video: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          {
            video: {
              facingMode: "environment",
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          },
          {
            video: { facingMode: "environment" },
            audio: false,
          },
          {
            video: true,
            audio: false,
          },
        ];

        for (let i = 0; i < constraintOptions.length; i++) {
          try {
            console.log(`📸 Attempting camera with constraints set ${i + 1}...`);
            stream = await navigator.mediaDevices.getUserMedia(constraintOptions[i]);
            initSuccessful = true;
            console.log(`✅ Camera initialized with constraints set ${i + 1}`);
            break;
          } catch (err) {
            console.warn(`⚠️ Constraints set ${i + 1} failed:`, err.message);
            if (i === constraintOptions.length - 1) {
              throw err; // All constraint sets failed
            }
          }
        }

        if (!initSuccessful || !stream) {
          throw new Error("Failed to initialize camera with all constraint options");
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          
          // ✅ Attempt to set focus if supported
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            try {
              const capabilities = videoTrack.getCapabilities?.();
              if (capabilities?.focusMode) {
                await videoTrack.applyConstraints({
                  advanced: [{ focusMode: "continuous" }]
                });
                console.log("✅ Auto-focus enabled");
              }
            } catch (focusErr) {
              console.log("⚠️ Auto-focus not available");
            }
          }
          
          // ✅ Set ready state with longer timeout as fallback
          setIsCameraReady(true);
          console.log("✅ Camera ready state set");
          
          setTimeout(() => {
            setIsCameraReady(true);
          }, 2000);
        }
      } catch (err) {
        console.error("❌ Camera initialization failed:", err);
        let errorMessage = "Cannot access camera. Please check permissions.";

        if (err.name === "NotReadableError") {
          errorMessage = "Camera is already in use by another app. Please close other camera apps.";
        } else if (err.name === "NotAllowedError") {
          errorMessage = "Camera permission denied. Please allow camera access in settings.";
        } else if (err.name === "NotFoundError") {
          errorMessage = "No camera device found on this device.";
        } else if (err.name === "AbortError") {
          errorMessage = "Camera request was cancelled. Please try again.";
        } else if (err.message.includes("Permission denied")) {
          errorMessage = "Camera permission denied. Please allow access.";
        }

        console.error("Final error message:", errorMessage);
        setError(errorMessage);
        setIsCameraReady(false);
        toast.error(errorMessage);
      } finally {
        setIsInitializing(false);
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, cameraActive]);

  /**
   * Capture photo from camera
   */
  const capturePhoto = async () => {
    console.log("📸 Capture button clicked");
    console.log("videoRef.current:", videoRef.current);
    console.log("canvasRef.current:", canvasRef.current);
    console.log("isCameraReady:", isCameraReady);
    
    if (!videoRef.current || !canvasRef.current) {
      console.error("❌ Missing refs - videoRef:", !!videoRef.current, "canvasRef:", !!canvasRef.current);
      toast.error("Camera not ready. Please wait.");
      return;
    }

    if (!isCameraReady) {
      console.error("❌ Camera not ready yet");
      toast.error("Camera is still loading. Please wait.");
      return;
    }

    try {
      console.log("✅ Drawing image to canvas");
      console.log("Video dimensions:", videoRef.current.videoWidth, "x", videoRef.current.videoHeight);
      
      const context = canvasRef.current.getContext("2d");
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      
      // ✅ Unmirror the image before sending (mirror was only for preview UX)
      context.scale(-1, 1);  // Flip horizontally
      context.drawImage(
        videoRef.current,
        -canvasRef.current.width,  // Adjust X position after flipping
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );
      
      // Reset transformation for future use
      context.setTransform(1, 0, 0, 1, 0, 0);

      const photoData = canvasRef.current.toDataURL("image/jpeg", 0.9);
      console.log("✅ Photo captured, size:", photoData.length, "bytes");
      
      setCapturedPhoto(photoData);
      setCameraActive(false);
      
      console.log("⏳ Starting verification...");
      // Automatically verify the captured photo
      await verifyIdPhoto(photoData);
      console.log("✅ Verification complete");
    } catch (err) {
      console.error("❌ Capture error:", err);
      toast.error("Failed to capture photo: " + err.message);
    }
  };

  /**
   * Verify ID photo using backend AI/OCR detection
   * Mimics Google Lens functionality with QR code support
   */
  const verifyIdPhoto = async (photoData) => {
    setIsVerifying(true);
    setVerificationResult(null);
    setDetectionFeedback("🔍 Analyzing document...\n📱 Scanning for QR code...");

    try {
      const response = await axios.post(
        "/api/profiles/verify-school-id",
        {
          image: photoData,
          fieldName: fieldName, // "id_front" or "id_back"
          expectedType: fieldName === "id_front" ? "school_id_front" : "school_id_back",
        },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
          timeout: 30000, // 30 second timeout for API call
        }
      );

      const {
        isValid,
        isSchoolID,
        detectedText,
        confidence,
        schoolName,
        studentID,
        studentIDSource,
        issues,
        message,
        qrDetection,
        detectionMethods,
      } = response.data;

      // Build detailed detection feedback with QR code info
      let feedbackText = `✅ CARAGA STATE UNIVERSITY\n`;
      
      // Add detection method info
      if (qrDetection?.found) {
        feedbackText += `📱 QR Code: ${qrDetection.studentID}\n`;
        feedbackText += `📝 ID Text: ${studentID}\n`;
      } else {
        feedbackText += `📝 Student ID: ${studentID}\n`;
      }
      
      feedbackText += `Confidence: ${(confidence * 100).toFixed(0)}%`;
      
      // Add detection source info
      if (studentIDSource === "qr") {
        feedbackText += `\n✅ Verified via QR Code`;
      } else if (studentIDSource === "ocr") {
        feedbackText += `\n✅ Verified via Text Recognition`;
      }

      // Update detection feedback based on results
      if (isValid && isSchoolID) {
        setDetectionFeedback(feedbackText);
        setIsIdDetected(true);
        setVerificationResult({
          isValid: true,
          isSchoolID: true,
          schoolName,
          studentID,
          studentIDSource,
          confidence,
          detectedText,
          message: "✅ VALID CSU ID - Ready to upload!",
          qrDetection,
          detectionMethods,
        });
      } else if (!isSchoolID) {
        setDetectionFeedback(
          `❌ Not a CSU ID\n\nPlease scan a valid\nCaraga State University ID`
        );
        setIsIdDetected(false);
        setVerificationResult({
          isValid: false,
          isSchoolID: false,
          message: "❌ Not a Caraga State University ID. Please try again.",
          issues: ["Not a recognized CSU ID format"],
        });
      } else {
        setDetectionFeedback(
          `⚠️ Issue Detected\n${issues?.join("\n") || "Please ensure ID is clear and readable"}`
        );
        setIsIdDetected(false);
        setVerificationResult({
          isValid: false,
          isSchoolID: false,
          message: "⚠️ CSU ID detected but needs better clarity",
          issues: issues || ["Document quality issue - please retake"],
        });
      }
    } catch (err) {
      console.error("Verification error:", err);
      const errorMsg =
        err.response?.data?.error ||
        "Failed to verify ID. Please try again.";
      
      setDetectionFeedback(`❌ ${errorMsg}`);
      setVerificationResult({
        isValid: false,
        message: `❌ ${errorMsg}`,
        error: true,
      });
      toast.error(errorMsg);
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Retake photo - reset and restart camera
   */
  const retakePhoto = () => {
    setCapturedPhoto(null);
    setVerificationResult(null);
    setDetectionFeedback("");
    setIsIdDetected(false);
    setCameraActive(true);
  };

  /**
   * Accept and upload verified ID
   */
  const acceptAndUpload = async () => {
    if (!capturedPhoto || !verificationResult?.isValid) {
      toast.error("Please capture a valid ID first");
      return;
    }

    try {
      setIsVerifying(true);
      
      // Convert base64 to blob
      const response = await fetch(capturedPhoto);
      const blob = await response.blob();
      
      // Upload to backend
      const formData = new FormData();
      formData.append(fieldName, blob, `${fieldName}-${Date.now()}.jpg`);

      const uploadResponse = await axios.post("/api/profiles/upload", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(`✅ ${fieldName === "id_front" ? "Front" : "Back"} ID uploaded successfully!`);
      
      if (onIdVerified) {
        onIdVerified({
          fieldName,
          verified: true,
          detectionData: verificationResult,
          uploadResponse: uploadResponse.data,
        });
      }

      onClose();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - Clean design matching BorrowPhotoCaptureModal */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                📸 Verify School ID
              </h2>
              <p className="text-xs text-gray-600">
                Capture {fieldName === "id_front" ? "front" : "back"} side
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Camera Error</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Camera View - Portrait Mode */}
          {cameraActive && (
            <div className="space-y-4">
              {/* Camera Preview Container - Portrait aspect ratio */}
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "9/16", maxHeight: "500px" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${!isCameraReady ? "hidden" : ""}`}
                  style={{
                    // ✅ Mirror video for front-facing camera (better UX for laptop users)
                    transform: "scaleX(-1)"
                  }}
                />

                {/* ✅ PORTRAIT Yellow Guide Line - Thin and centered */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* Thin vertical yellow line in center */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-3/4 bg-yellow-400 rounded-full opacity-70"></div>
                  
                  {/* Top horizontal line */}
                  <div className="absolute top-1/4 left-0 right-0 h-0.5 bg-yellow-400 opacity-50"></div>
                  
                  {/* Bottom horizontal line */}
                  <div className="absolute bottom-1/4 left-0 right-0 h-0.5 bg-yellow-400 opacity-50"></div>
                  
                  {/* Corner markers for alignment */}
                  <div className="absolute top-1/4 left-8 w-8 h-8 border-t-2 border-l-2 border-yellow-400"></div>
                  <div className="absolute top-1/4 right-8 w-8 h-8 border-t-2 border-r-2 border-yellow-400"></div>
                  <div className="absolute bottom-1/4 left-8 w-8 h-8 border-b-2 border-l-2 border-yellow-400"></div>
                  <div className="absolute bottom-1/4 right-8 w-8 h-8 border-b-2 border-r-2 border-yellow-400"></div>
                  
                  {/* Label */}
                  <p className="text-yellow-300 text-xs font-semibold bg-black/40 px-2 py-1 rounded absolute bottom-8">
                    Position ID in frame
                  </p>
                </div>

                {/* Loading State */}
                {!isCameraReady && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin w-10 h-10 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-3"></div>
                      <p className="text-white text-sm">Initializing camera...</p>
                    </div>
                  </div>
                )}

                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-blue-900 space-y-1">
                  <p><strong>📸 How to capture:</strong></p>
                  <p>✓ Use back camera for best results (rear-facing)</p>
                  <p>✓ Position your ID vertically in the yellow guide</p>
                  <p>✓ Ensure entire ID text is clear and readable</p>
                  <p>✓ Good lighting recommended (natural light works best)</p>
                  <p>✓ Hold steady and click Capture</p>
                </div>
              </div>

              {/* Capture Button */}
              <button
                onClick={capturePhoto}
                disabled={!isCameraReady || isVerifying}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                {isVerifying ? "Verifying..." : "Capture Photo"}
              </button>
            </div>
          )}

          {/* Photo Preview & Verification Results */}
          {capturedPhoto && !cameraActive && (
            <div className="space-y-4">
              {/* Preview Image */}
              <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: "9/16", maxHeight: "400px" }}>
                <img src={capturedPhoto} alt="Captured ID" className="w-full h-full object-cover" />
              </div>

              {/* Verifying State */}
              {isVerifying && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                  <Loader className="w-5 h-5 animate-spin text-amber-600" />
                  <p className="text-sm text-amber-900 font-semibold">Analyzing document...</p>
                </div>
              )}

              {/* Detection Feedback */}
              {detectionFeedback && !isVerifying && (
                <div className={`p-4 rounded-lg border-l-4 ${
                  isIdDetected
                    ? "bg-green-50 border-green-600"
                    : "bg-orange-50 border-orange-600"
                }`}>
                  <p className={`text-sm font-semibold whitespace-pre-wrap ${
                    isIdDetected ? "text-green-800" : "text-orange-800"
                  }`}>
                    {detectionFeedback}
                  </p>
                </div>
              )}

              {/* Detailed Results */}
              {verificationResult && !isVerifying && verificationResult.isValid && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-green-900">✅ Valid School ID</p>
                      <div className="mt-2 text-xs text-green-800 space-y-1">
                        <p><strong>School:</strong> {verificationResult.schoolName}</p>
                        <p><strong>Student ID:</strong> {verificationResult.studentID}</p>
                        <p><strong>Confidence:</strong> {(verificationResult.confidence * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Results */}
              {verificationResult && !isVerifying && !verificationResult.isValid && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-900">{verificationResult.message}</p>
                      {verificationResult.issues && (
                        <div className="mt-2 text-xs text-red-800">
                          <p><strong>Issues:</strong></p>
                          <ul className="list-disc list-inside mt-1">
                            {verificationResult.issues.map((issue, idx) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={retakePhoto}
                  disabled={isVerifying}
                  className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:bg-gray-400 transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Retake
                </button>

                <button
                  onClick={acceptAndUpload}
                  disabled={!verificationResult?.isValid || isVerifying}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Accept & Upload
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
