import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../../context/userContext";
import { Upload, ArrowLeft, Calendar, CreditCard, Check, X, Camera } from "lucide-react";
import PageLayout from "../../components/layout/PageLayout";
import ImagePreviewModal from "../../components/modals/ImagePreviewModal";
import SchoolIDVerificationModal from "../../components/modals/SchoolIDVerificationModal";
import toast from "react-hot-toast";

export default function Documents() {
  const { user } = useContext(UserContext);
  const [profile, setProfile] = useState(null);
  const [files, setFiles] = useState({
    profile_pic: null,
    birth_certificate: null,
    class_schedule: null,
    id_front: null,
    id_back: null,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingField, setUploadingField] = useState(null);
  const [previewModal, setPreviewModal] = useState({ isOpen: false, imageUrl: "", fileName: "" });
  const [cameraModal, setCameraModal] = useState({ isOpen: false, fieldName: null });
  const navigate = useNavigate();

  const fileInputRefs = {
    profile_pic: useRef(),
    birth_certificate: useRef(),
    class_schedule: useRef(),
    id_front: useRef(),
    id_back: useRef(),
  };

  useEffect(() => {
    if (user?.id) fetchProfile();
  }, [user]);

  async function fetchProfile() {
    try {
      const res = await axios.get("/api/profiles/me", { withCredentials: true });
      setProfile(res.data);
    } catch (err) {
      console.error("Failed to fetch profile:", err.response?.data || err.message);
    }
  }

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    if (selectedFiles.length > 0) {
      setFiles((prev) => ({ ...prev, [name]: selectedFiles[0] }));
      handleUpload(name, selectedFiles[0]);
    }
  };

  const handleIdVerified = async (verificationData) => {
    // Update profile after successful verification and upload
    if (verificationData.verified) {
      toast.success(`✅ ${verificationData.fieldName === "id_front" ? "Front" : "Back"} ID verified and uploaded!`);
      await fetchProfile();
    }
  };

  const handleUpload = async (fieldName, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append(fieldName, file);
    setUploading(true);
    setUploadingField(fieldName);
    try {
      await axios.post("/api/profiles/upload", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Document uploaded successfully!");
      fetchProfile();
    } catch (err) {
      console.error("Upload failed:", err.response?.data || err.message);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadingField(null);
    }
  };

  const documents = [
    { key: "birth_certificate", label: "Birth Certificate", icon: <Calendar className="w-5 h-5" />, hasCamera: false },
    { key: "class_schedule", label: "Class Schedule", icon: <Calendar className="w-5 h-5" />, hasCamera: false },
    { key: "id_front", label: "ID (Front)", icon: <CreditCard className="w-5 h-5" />, hasCamera: true },
    { key: "id_back", label: "ID (Back)", icon: <CreditCard className="w-5 h-5" />, hasCamera: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white pb-20 xs:pb-24 sm:pb-28">
      <div className="w-full max-w-3xl mx-auto px-3 xs:px-4 sm:px-6 md:px-8 py-3 xs:py-4 sm:py-6 md:py-8">
        {/* Header - Mobile Style (No top navbar) */}
        <div className="flex items-center justify-between gap-3 mb-5 xs:mb-6 sm:mb-7 md:mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              Documents
            </h1>
            <p className="text-2xs xs:text-xs sm:text-sm text-gray-500 mt-0.5 xs:mt-1">Upload your files</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center p-2 xs:p-2.5 sm:p-3 rounded-lg xs:rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors flex-shrink-0"
            title="Go back"
          >
            <ArrowLeft size={18} className="xs:hidden" />
            <ArrowLeft size={20} className="hidden xs:block sm:hidden" />
            <ArrowLeft size={22} className="hidden sm:block" />
          </button>
        </div>

        {/* Documents Grid */}
        <div className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
          {documents.map(({ key, label, icon }) => (
            <div
              key={key}
              className="bg-white rounded-lg xs:rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all p-3 xs:p-4 sm:p-5 md:p-6"
            >
              <div className="flex items-start justify-between gap-3 xs:gap-4 sm:gap-5">
                {/* Document Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 xs:gap-3 mb-2 xs:mb-2.5">
                    <div className="p-1.5 xs:p-2 bg-emerald-100 rounded-lg text-emerald-600 flex-shrink-0">
                      {icon}
                    </div>
                    <h3 className="text-sm xs:text-base sm:text-lg font-semibold text-gray-900 truncate">
                      {label}
                    </h3>
                  </div>

                  {/* Document Status */}
                  <div className="min-h-6 xs:min-h-7">
                    {profile?.[`${key}_url`] ? (
                      <div className="flex items-center gap-1 xs:gap-2 text-2xs xs:text-xs sm:text-sm text-emerald-600 font-medium flex-wrap">
                        <Check size={14} className="xs:hidden" />
                        <Check size={16} className="hidden xs:block" />
                        <span>Uploaded</span>
                        <button
                          onClick={() =>
                            setPreviewModal({
                              isOpen: true,
                              imageUrl: profile[`${key}_url`],
                              fileName: label,
                            })
                          }
                          className="text-emerald-600 hover:text-emerald-700 hover:underline font-semibold ml-1"
                        >
                          View
                        </button>
                      </div>
                    ) : (
                      <p className="text-2xs xs:text-xs sm:text-sm text-gray-500">No document</p>
                    )}
                  </div>
                </div>

                {/* Upload Button */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Camera button for ID fields */}
                  {key === "id_front" || key === "id_back" ? (
                    <button
                      onClick={() => setCameraModal({ isOpen: true, fieldName: key })}
                      className="flex items-center justify-center gap-1 xs:gap-2 px-3 xs:px-4 sm:px-5 md:px-6 py-2 xs:py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg xs:rounded-xl font-medium transition-colors text-2xs xs:text-xs sm:text-sm whitespace-nowrap"
                      title="Scan ID with camera"
                    >
                      <Camera size={16} className="xs:hidden" />
                      <Camera size={18} className="hidden xs:block" />
                      <span className="hidden xs:inline">Camera</span>
                    </button>
                  ) : null}

                  <button
                    onClick={() => fileInputRefs[key].current.click()}
                    disabled={uploading && uploadingField === key}
                    className="flex items-center justify-center gap-1 xs:gap-2 px-3 xs:px-4 sm:px-5 md:px-6 py-2 xs:py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg xs:rounded-xl font-medium transition-colors text-2xs xs:text-xs sm:text-sm whitespace-nowrap"
                  >
                    {uploading && uploadingField === key ? (
                      <>
                        <div className="animate-spin text-xs xs:text-sm">⏳</div>
                        <span className="hidden xs:inline">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} className="xs:hidden" />
                        <Upload size={18} className="hidden xs:block" />
                        <span className="hidden xs:inline">Upload</span>
                      </>
                    )}
                  </button>
                </div>

                <input
                  type="file"
                  name={key}
                  ref={fileInputRefs[key]}
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Info Message */}
        <div className="mt-5 xs:mt-6 sm:mt-7 md:mt-8 p-3 xs:p-4 sm:p-5 md:p-6 bg-blue-50 border border-blue-200 rounded-lg xs:rounded-xl sm:rounded-2xl">
          <p className="text-2xs xs:text-xs sm:text-sm md:text-base text-blue-900 leading-relaxed">
            <span className="font-semibold">✓ Tip:</span> Make sure all documents are clear and legible. Accepted: PNG, JPG, PDF.
          </p>
        </div>
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, imageUrl: "", fileName: "" })}
        imageUrl={previewModal.imageUrl}
        fileName={previewModal.fileName}
      />

      {/* School ID Verification Modal */}
      <SchoolIDVerificationModal
        isOpen={cameraModal.isOpen}
        onClose={() => setCameraModal({ isOpen: false, fieldName: null })}
        onIdVerified={handleIdVerified}
        fieldName={cameraModal.fieldName}
      />
    </div>
  );
}
