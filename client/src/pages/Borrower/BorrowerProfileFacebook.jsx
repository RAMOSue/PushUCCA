import { useContext, useEffect, useState, useRef } from "react";
import { UserContext } from "../../../context/userContext";
import PageLayout from "../../components/layout/PageLayout";
import axios from "axios";
import { Mail, Phone, Shield, Camera, Upload, Check, Settings, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import ImagePreviewModal from "../../components/modals/ImagePreviewModal";
import SchoolIDVerificationModal from "../../components/modals/SchoolIDVerificationModal";

export default function BorrowerProfileFacebook() {
  const { user } = useContext(UserContext);

  // ===== STATE =====
  const [profile, setProfile] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingDivision, setEditingDivision] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempPhone, setTempPhone] = useState("");
  const [tempDivision, setTempDivision] = useState(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [previewModal, setPreviewModal] = useState({ isOpen: false, imageUrl: "", fileName: "" });
  const [cameraModal, setCameraModal] = useState({ isOpen: false, fieldName: null });

  const fileInputRef = useRef();
  const fileInputRefs = {
    profile_pic: useRef(),
    birth_certificate: useRef(),
    class_schedule: useRef(),
    id_front: useRef(),
    id_back: useRef(),
  };

  // ===== FETCH DATA =====
  useEffect(() => {
    if (user?.id) {
      Promise.all([fetchProfile(), fetchDivisions()]);
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get("/api/profiles/me", { withCredentials: true });
      setProfile(data);
      setPreviewUrl(data.profile_pic_url);
      setTempName(data.name || "");
      setTempPhone(data.phone || "");
      setTempDivision(data.division_id || null);
    } catch (err) {
      console.error("Failed to fetch profile:", err.message);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const fetchDivisions = async () => {
    try {
      const { data } = await axios.get("/api/master-list/units", { withCredentials: true });
      const activeDivisions = Array.isArray(data)
        ? data.filter(d => d.status === "active" || d.is_active !== false)
        : [];
      setDivisions(activeDivisions);
    } catch (err) {
      console.error("Failed to fetch divisions:", err.message);
    }
  };

  // ===== HANDLERS =====
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.readAsDataURL(file);

    await uploadProfilePic(file);
  };

  const uploadProfilePic = async (file) => {
    const formData = new FormData();
    formData.append("profile_pic", file);
    setUploadingPic(true);

    try {
      const { data } = await axios.post("/api/profiles/upload", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProfile(prev => ({
        ...prev,
        profile_pic_url: data.profile?.profile_pic_url || data.profile_pic_url,
      }));

      toast.success("Profile picture updated");
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Failed to upload picture");
      setPreviewUrl(profile?.profile_pic_url || null);
    } finally {
      setUploadingPic(false);
    }
  };

  const handleSaveField = async (field) => {
    let value;
    if (field === "name") value = tempName;
    if (field === "phone") value = tempPhone;
    if (field === "division_id") value = tempDivision;

    if (field === "name" && (!value || !value.trim())) {
      toast.error("Name cannot be empty");
      return;
    }

    if (field === "phone" && value && value.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
      if (!phoneRegex.test(value)) {
        toast.error("Please enter a valid phone number");
        return;
      }
    }

    try {
      const updateData = {};
      updateData[field] = value;

      const { data } = await axios.patch("/api/profiles/me", updateData, { withCredentials: true });
      setProfile(data.profile || data);
      
      setEditingName(false);
      setEditingPhone(false);
      setEditingDivision(false);
      
      toast.success(`${field === "name" ? "Name" : field === "phone" ? "Phone" : "Division"} updated`);
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to update profile");
    }
  };

  const handleDocumentFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    if (selectedFiles.length > 0) {
      handleDocumentUpload(name, selectedFiles[0]);
    }
  };

  const handleDocumentUpload = async (fieldName, file) => {
    const formData = new FormData();
    formData.append(fieldName, file);
    setUploadingDoc(fieldName);

    try {
      await axios.post("/api/profiles/upload", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Document uploaded!");
      await fetchProfile();
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("Upload failed");
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleIdVerified = async () => {
    await fetchProfile();
  };

  // ===== HELPERS =====
  const getDivisionName = () => {
    if (!tempDivision) return "Not assigned";
    const division = divisions.find(d => d.id === tempDivision);
    return division?.name || "Not assigned";
  };

  const getDocumentStatus = (fieldName) => {
    const url = profile?.[`${fieldName}_url`];
    return url ? "uploaded" : "missing";
  };

  const getUploadedCount = () => {
    const docs = ["birth_certificate", "class_schedule", "id_front", "id_back"];
    return docs.filter(d => !!profile?.[`${d}_url`]).length;
  };

  const documentsList = [
    { key: "birth_certificate", label: "Birth Certificate", icon: "📄" },
    { key: "class_schedule", label: "Class Schedule", icon: "📅" },
    { key: "id_front", label: "School ID (Front)", icon: "🆔" },
    { key: "id_back", label: "School ID (Back)", icon: "🆔" },
  ];

  // ===== RENDER =====
  if (loading) {
    return (
      <PageLayout>
        <div className="w-full h-96 bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse" />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* COVER SECTION */}
      <div className="relative w-full h-60 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50">
        <div className="absolute top-0 left-0 right-0 h-full opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-200/20 via-purple-200/20 to-pink-200/20" />
        </div>

        {/* Action Buttons Top Right */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-200 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT WITH HEADER OVERLAP */}
      <div className="relative px-4 sm:px-6 lg:px-8">
        {/* PROFILE HEADER (OVERLAPPING) */}
        <div className="max-w-7xl mx-auto -mt-20 relative z-10 mb-8">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="relative inline-block">
                {previewUrl || profile?.profile_pic_url ? (
                  <img
                    src={previewUrl || profile?.profile_pic_url}
                    alt={user?.name}
                    className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-white shadow-lg object-cover"
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 border-4 border-white shadow-lg flex items-center justify-center">
                    <span className="text-4xl sm:text-5xl font-bold text-white">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                )}

                <button
                  onClick={handleAvatarClick}
                  disabled={uploadingPic}
                  className="absolute bottom-2 right-2 p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-full shadow-lg transition-all"
                  title="Change photo"
                >
                  {uploadingPic ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploadingPic}
                />
              </div>
            </div>

            {/* Name & Status */}
            <div className="flex-1 flex flex-col justify-end pb-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">{profile?.name}</h1>
              
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                  <Shield className="w-4 h-4" />
                  Member
                </span>
                {profile?.department_name && (
                  <span className="text-sm text-gray-600">{profile.department_name}</span>
                )}
              </div>

              <p className="text-sm text-gray-500 mt-2">
                ID: <span className="font-mono text-gray-700">{user?.id}</span>
              </p>
            </div>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="max-w-7xl mx-auto pb-12">
          {/* TAB NAVIGATION */}
          <div className="flex gap-1 border-b border-gray-200 mb-8 -mx-4 sm:mx-0 px-4 sm:px-0">
            {["overview", "documents"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-medium text-sm transition-all border-b-2 ${
                  activeTab === tab
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab === "overview" && "Overview"}
                {tab === "documents" && `Documents (${getUploadedCount()}/4)`}
              </button>
            ))}
          </div>

          {/* ===== OVERVIEW TAB ===== */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT SIDEBAR */}
              <div className="lg:col-span-1 space-y-6">
                {/* Personal Details Card */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">About</h3>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Email */}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-semibold">Email</p>
                      <p className="text-sm text-gray-900 break-all flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        {profile?.email}
                      </p>
                    </div>

                    {/* Phone */}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-semibold">Phone</p>
                      {editingPhone ? (
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            value={tempPhone}
                            onChange={(e) => setTempPhone(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveField("phone")}
                            className="px-2 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 whitespace-nowrap"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <p
                          onClick={() => setEditingPhone(true)}
                          className="text-sm text-gray-900 cursor-pointer hover:text-emerald-600 font-medium flex items-center gap-2"
                        >
                          <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          {tempPhone || "Not provided"}
                        </p>
                      )}
                    </div>

                    {/* Division */}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-semibold">Class / Division</p>
                      {editingDivision ? (
                        <div className="flex gap-2">
                          <select
                            value={tempDivision || ""}
                            onChange={(e) => setTempDivision(e.target.value ? parseInt(e.target.value) : null)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                          >
                            <option value="">Select...</option>
                            {divisions.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSaveField("division_id")}
                            className="px-2 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 whitespace-nowrap"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <p
                          onClick={() => setEditingDivision(true)}
                          className="text-sm text-gray-900 cursor-pointer hover:text-emerald-600 font-medium"
                        >
                          {getDivisionName()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Documents Summary Card */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Required Documents</h3>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                      {getUploadedCount()}/4
                    </span>
                  </div>

                  <div className="p-4 space-y-2">
                    {documentsList.map(doc => {
                      const isUploaded = getDocumentStatus(doc.key) === "uploaded";
                      return (
                        <div 
                          key={doc.key} 
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                          onClick={() => setActiveTab("documents")}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-lg">{doc.icon}</span>
                            <span className="text-sm text-gray-700 font-medium">{doc.label}</span>
                          </div>
                          <div className="flex-shrink-0">
                            {isUploaded ? (
                              <div className="flex items-center gap-1">
                                <Check className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs text-emerald-600 font-semibold">Done</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                <span className="text-xs text-orange-600 font-semibold">Needed</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {getUploadedCount() < 4 && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-orange-50">
                      <p className="text-xs text-orange-700 font-semibold">
                        ⚠ {4 - getUploadedCount()} more document(s) needed
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT CONTENT */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h3>
                  
                  <div className="space-y-6">
                    {/* Name Card */}
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-semibold">Full Name</p>
                      {editingName ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveField("name")}
                            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingName(false);
                              setTempName(profile?.name || "");
                            }}
                            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => setEditingName(true)}
                          className="p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                        >
                          <p className="text-base font-semibold text-gray-900">{tempName}</p>
                          <p className="text-xs text-gray-500 mt-1">Click to edit</p>
                        </div>
                      )}
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                        <p className="text-xs text-blue-700 uppercase tracking-wide font-semibold mb-1">User ID</p>
                        <p className="text-sm font-mono text-blue-900">{user?.id}</p>
                      </div>

                      <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                        <p className="text-xs text-purple-700 uppercase tracking-wide font-semibold mb-1">Member Since</p>
                        <p className="text-sm font-medium text-purple-900">
                          {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Status Info */}
                    <div className="p-4 border border-emerald-200 bg-emerald-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-5 h-5 text-emerald-600" />
                        <p className="font-semibold text-emerald-900">Account Status</p>
                      </div>
                      <p className="text-sm text-emerald-800">✓ Active and Verified</p>
                      <p className="text-xs text-emerald-700 mt-2">
                        📄 Documents: {getUploadedCount()} of 4 uploaded
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== DOCUMENTS TAB ===== */}
          {activeTab === "documents" && (
            <div>
              <div className="mb-6">
                <p className="text-sm text-gray-600">Upload and manage your required documents. All documents must be clear and legible.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {documentsList.map(doc => {
                  const url = profile?.[`${doc.key}_url`];
                  const isUploaded = !!url;

                  return (
                    <div 
                      key={doc.key} 
                      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow overflow-hidden"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="text-4xl mb-2">{doc.icon}</div>
                          <h4 className="font-semibold text-gray-900">{doc.label}</h4>
                        </div>
                        {isUploaded && (
                          <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-emerald-100 rounded">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-semibold text-emerald-700">Done</span>
                          </div>
                        )}
                      </div>

                      {isUploaded && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <p className="text-sm text-emerald-800 font-medium">✓ Document uploaded</p>
                          <p className="text-xs text-emerald-700 mt-1">
                            {profile?.[`${doc.key}_verified`] && "✓ Verified"}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {isUploaded && (
                          <button
                            onClick={() =>
                              setPreviewModal({
                                isOpen: true,
                                imageUrl: url,
                                fileName: doc.label,
                              })
                            }
                            className="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium"
                          >
                            👁 View
                          </button>
                        )}

                        {(doc.key === "id_front" || doc.key === "id_back") && (
                          <button
                            onClick={() => setCameraModal({ isOpen: true, fieldName: doc.key })}
                            className="flex-1 px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors font-medium"
                          >
                            📷 Camera
                          </button>
                        )}

                        <button
                          onClick={() => fileInputRefs[doc.key].current?.click()}
                          disabled={uploadingDoc === doc.key}
                          className="flex-1 px-3 py-2 text-sm bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50 transition-colors font-medium"
                        >
                          {uploadingDoc === doc.key ? (
                            <>
                              ⏳ Uploading...
                            </>
                          ) : (
                            <>
                              📤 {isUploaded ? "Update" : "Upload"}
                            </>
                          )}
                        </button>
                      </div>

                      <input
                        type="file"
                        ref={fileInputRefs[doc.key]}
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={handleDocumentFileChange}
                        disabled={uploadingDoc === doc.key}
                        name={doc.key}
                      />

                      {!isUploaded && (
                        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-xs text-orange-800 font-medium">⚠ Not yet uploaded</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Upload Guidelines */}
              <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">📋 Document Requirements</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>• All documents must be clear and readable</li>
                  <li>• Supported formats: JPG, PNG, PDF</li>
                  <li>• Maximum file size: 5MB per document</li>
                  <li>• Class schedule must show your name and semester</li>
                  <li>• School ID must include photo and student number</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ImagePreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, imageUrl: "", fileName: "" })}
        imageUrl={previewModal.imageUrl}
        fileName={previewModal.fileName}
      />

      <SchoolIDVerificationModal
        isOpen={cameraModal.isOpen}
        onClose={() => setCameraModal({ isOpen: false, fieldName: null })}
        onIdVerified={handleIdVerified}
        fieldName={cameraModal.fieldName}
      />
    </PageLayout>
  );
}
