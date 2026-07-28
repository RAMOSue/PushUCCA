import { useContext, useEffect, useState, useRef } from "react";
import { UserContext } from "../../../context/userContext";
import { useNavigate } from "react-router-dom";
import PageLayout from "../../components/layout/PageLayout";
import axios from "axios";
import { Mail, Phone, Shield, Camera, Upload, Check, Settings, AlertCircle, ChevronRight, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import ImagePreviewModal from "../../components/modals/ImagePreviewModal";
import SchoolIDVerificationModal from "../../components/modals/SchoolIDVerificationModal";

export default function BorrowerProfileFacebook() {
  const { user, setUser } = useContext(UserContext);
  const navigate = useNavigate();

  // ===== STATE =====
  const [profile, setProfile] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingDivision, setEditingDivision] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempPhone, setTempPhone] = useState("");
  const [tempDivision, setTempDivision] = useState(null);
  const [tempProfile, setTempProfile] = useState({});
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

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      const { data } = await axios.get("/api/profiles/me", { withCredentials: true });
      const profileData = data.profile || data;
      setProfile(profileData);
      setPreviewUrl(profileData.profile_pic_url || "");
      setTempName(profileData.name || "");
      setTempPhone(profileData.phone || "");
      setTempDivision(profileData.division_id || null);
      setTempProfile({
        date_of_birth: profileData.date_of_birth || "",
        citizenship: profileData.citizenship || "",
        religion: profileData.religion || "",
        marital_status: profileData.marital_status || "",
        college: profileData.college || "",
        program: profileData.program || "",
        current_address: profileData.current_address || "",
        height: profileData.height || "",
        weight: profileData.weight || "",
        eye_color: profileData.eye_color || "",
        mother_full_name: profileData.mother_full_name || "",
        mother_birthday: profileData.mother_birthday || "",
        father_full_name: profileData.father_full_name || "",
        father_birthday: profileData.father_birthday || "",
        emergency_contact_name: profileData.emergency_contact_name || "",
        emergency_contact_mobile: profileData.emergency_contact_mobile || "",
        emergency_contact_relationship: profileData.emergency_contact_relationship || "",
        emergency_contact_occupation: profileData.emergency_contact_occupation || "",
      });
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  };

  // ===== FETCH DATA =====
  useEffect(() => {
    const init = async () => {
      if (!user?.id) return;
      setProfile(user);
      setPreviewUrl(user.profile_pic_url || "");
      setTempName(user.name || "");
      setTempPhone(user.phone || "");
      setTempDivision(user.division_id || null);
      setTempProfile({
        date_of_birth: user.date_of_birth || "",
        citizenship: user.citizenship || "",
        religion: user.religion || "",
        marital_status: user.marital_status || "",
        college: user.college || "",
        program: user.program || "",
        current_address: user.current_address || "",
        height: user.height || "",
        weight: user.weight || "",
        eye_color: user.eye_color || "",
        mother_full_name: user.mother_full_name || "",
        mother_birthday: user.mother_birthday || "",
        father_full_name: user.father_full_name || "",
        father_birthday: user.father_birthday || "",
        emergency_contact_name: user.emergency_contact_name || "",
        emergency_contact_mobile: user.emergency_contact_mobile || "",
        emergency_contact_relationship: user.emergency_contact_relationship || "",
        emergency_contact_occupation: user.emergency_contact_occupation || "",
      });
      await fetchProfile();
      await fetchDivisions();
      setLoading(false);
    };
    init();
  }, [user]);

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
      const phoneRegex = /^[\d\s\-\+()]{10,}$/;
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

  const saveExtendedProfile = async () => {
    try {
      const { data } = await axios.patch("/api/profiles/me", tempProfile, { withCredentials: true });
      setProfile(data.profile || data);
      setEditingProfile(false);
      toast.success("Profile updated");
    } catch (err) {
      console.error("Profile save failed", err);
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

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err.message);
      toast.error("Logout failed");
    }
  };

  // ===== HELPERS =====
  const getDivisionName = () => {
    if (!tempDivision) return "Not assigned";
    const division = divisions.find(d => d.id === tempDivision);
    return division?.name || "Not assigned";
  };

  const profileSections = [
    {
      title: "Personal Information",
      fields: [
        { label: "Full Name", key: "name", value: profile?.name || "" },
        { label: "Date of Birth", key: "date_of_birth", value: profile?.date_of_birth || "" },
        { label: "Citizenship", key: "citizenship", value: profile?.citizenship || "" },
        { label: "Religion", key: "religion", value: profile?.religion || "" },
        { label: "Marital Status", key: "marital_status", value: profile?.marital_status || "" },
      ],
    },
    {
      title: "Contact Information",
      fields: [
        { label: "Email", key: "email", value: profile?.email || "" },
        { label: "Phone Number", key: "phone", value: profile?.phone || "" },
        { label: "Current Address", key: "current_address", value: profile?.current_address || "" },
      ],
    },
    {
      title: "Academic Information",
      fields: [
        { label: "College", key: "college", value: profile?.college || "" },
        { label: "Program / Course", key: "program", value: profile?.program || "" },
        { label: "Division", key: "division_id", value: profile?.division_id || "" },
        { label: "Role", key: "role", value: profile?.role || "" },
      ],
    },
    {
      title: "Physical Information",
      fields: [
        { label: "Height", key: "height", value: profile?.height || "" },
        { label: "Weight", key: "weight", value: profile?.weight || "" },
        { label: "Eye Color", key: "eye_color", value: profile?.eye_color || "" },
      ],
    },
    {
      title: "Parents",
      fields: [
        { label: "Mother's Full Name", key: "mother_full_name", value: profile?.mother_full_name || "" },
        { label: "Mother's Birthday", key: "mother_birthday", value: profile?.mother_birthday || "" },
        { label: "Father's Full Name", key: "father_full_name", value: profile?.father_full_name || "" },
        { label: "Father's Birthday", key: "father_birthday", value: profile?.father_birthday || "" },
      ],
    },
    {
      title: "Emergency Contact",
      fields: [
        { label: "Emergency Contact Name", key: "emergency_contact_name", value: profile?.emergency_contact_name || "" },
        { label: "Mobile Number", key: "emergency_contact_mobile", value: profile?.emergency_contact_mobile || "" },
        { label: "Relationship", key: "emergency_contact_relationship", value: profile?.emergency_contact_relationship || "" },
        { label: "Occupation", key: "emergency_contact_occupation", value: profile?.emergency_contact_occupation || "" },
      ],
    },
  ];

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
        <div className="w-full h-48 sm:h-96 bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse" />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* COVER SECTION - HIDDEN ON MOBILE */}
      <div className="hidden sm:block relative w-full h-60 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50">
        <div className="absolute top-0 left-0 right-0 h-full opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-200/20 via-purple-200/20 to-pink-200/20" />
        </div>

        {/* Action Buttons Top Right */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-200 transition-colors text-sm"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* MOBILE HEADER - MESSENGER STYLE */}
      <div className="sm:hidden bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              {previewUrl || profile?.profile_pic_url ? (
                <img
                  src={previewUrl || profile?.profile_pic_url}
                  alt={user?.name}
                  className="w-12 h-12 rounded-full border-2 border-gray-200 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 border-2 border-white flex items-center justify-center">
                  <span className="text-xl font-bold text-white">
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}
              
              <button
                onClick={handleAvatarClick}
                disabled={uploadingPic}
                className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-full shadow-lg transition-all"
                title="Change photo"
              >
                {uploadingPic ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-3 h-3" />
                )}
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">{profile?.name}</h1>
              <p className="text-xs text-gray-500 mt-0.5">ID: {user?.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploadingPic}
        />
      </div>

      {/* DESKTOP PROFILE HEADER */}
      <div className="hidden sm:block relative px-6 lg:px-8">
        <div className="max-w-7xl mx-auto -mt-20 relative z-10 mb-8">
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <div className="relative inline-block">
                {previewUrl || profile?.profile_pic_url ? (
                  <img
                    src={previewUrl || profile?.profile_pic_url}
                    alt={user?.name}
                    className="w-28 h-28 lg:w-36 lg:h-36 rounded-full border-4 border-white shadow-lg object-cover"
                  />
                ) : (
                  <div className="w-28 h-28 lg:w-36 lg:h-36 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 border-4 border-white shadow-lg flex items-center justify-center">
                    <span className="text-3xl lg:text-5xl font-bold text-white">
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

            <div className="flex-1 flex flex-col justify-end pb-2">
              <h1 className="text-2xl lg:text-4xl font-bold text-gray-900">{profile?.name}</h1>
              
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
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
      </div>

      {/* CONTENT AREA */}
      <div className="sm:px-6 lg:px-8 pb-8 sm:pb-12">
        {/* TAB NAVIGATION */}
        <div className="flex gap-1 border-b border-gray-200 mb-6 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
          {["overview", "documents"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-6 py-2 sm:py-3 font-medium text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === tab
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "overview" && "Overview"}
              {tab === "documents" && `Docs (${getUploadedCount()}/4)`}
            </button>
          ))}
        </div>

        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* LEFT SIDEBAR - MOBILE ROW LAYOUT */}
            <div className="lg:col-span-1 space-y-0 sm:space-y-6">
              {/* Mobile Personal Details - Row Layout */}
              <div className="sm:hidden bg-white border-t border-gray-200">
                {/* Email Row */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-semibold">Email</p>
                    <p className="text-xs text-gray-900 break-all truncate">{profile?.email}</p>
                  </div>
                </div>

                {/* Phone Row */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-semibold">Phone</p>
                  {editingPhone ? (
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={tempPhone}
                        onChange={(e) => setTempPhone(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveField("phone")}
                        className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 whitespace-nowrap font-medium"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p
                      onClick={() => setEditingPhone(true)}
                      className="text-xs text-gray-900 cursor-pointer hover:text-emerald-600 font-medium"
                    >
                      {tempPhone || "Not provided"}
                    </p>
                  )}
                </div>

                {/* Division Row */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-semibold">Class / Division</p>
                  {editingDivision ? (
                    <div className="flex gap-2">
                      <select
                        value={tempDivision || ""}
                        onChange={(e) => setTempDivision(e.target.value ? parseInt(e.target.value) : null)}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      >
                        <option value="">Select...</option>
                        {divisions.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSaveField("division_id")}
                        className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 whitespace-nowrap font-medium"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p
                      onClick={() => setEditingDivision(true)}
                      className="text-xs text-gray-900 cursor-pointer hover:text-emerald-600 font-medium"
                    >
                      {getDivisionName()}
                    </p>
                  )}
                </div>

                {/* Documents Summary Row */}
                <div 
                  onClick={() => setActiveTab("documents")}
                  className="px-4 py-3 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 font-semibold">Required Documents</p>
                    <p className="text-xs text-gray-700 font-medium">{getUploadedCount()} of 4 uploaded</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {getUploadedCount() < 4 && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">
                        {4 - getUploadedCount()} needed
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Desktop Personal Details Card */}
              <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                  <h3 className="font-semibold text-sm text-gray-900">About</h3>
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
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveField("phone")}
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 whitespace-nowrap font-medium"
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
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
                          autoFocus
                        >
                          <option value="">Select...</option>
                          {divisions.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleSaveField("division_id")}
                          className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 whitespace-nowrap font-medium"
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

              {/* Desktop Documents Card */}
              <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-gray-900">Required Docs</h3>
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
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm">{doc.icon}</span>
                          <span className="text-sm text-gray-700 font-medium truncate">{doc.label}</span>
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

            {/* RIGHT CONTENT - DESKTOP ONLY */}
            <div className="hidden lg:block lg:col-span-2">
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
                          className="px-4 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 font-medium whitespace-nowrap"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingName(false);
                            setTempName(profile?.name || "");
                          }}
                          className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 font-medium whitespace-nowrap"
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
                      <p className="text-sm font-mono text-blue-900 truncate">{user?.id}</p>
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
                      <p className="font-semibold text-sm text-emerald-900">Account Status</p>
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
            <div className="mb-4 sm:mb-6">
              <p className="text-xs sm:text-sm text-gray-600">Upload and manage your required documents. All documents must be clear and legible.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {documentsList.map(doc => {
                const url = profile?.[`${doc.key}_url`];
                const isUploaded = !!url;

                return (
                  <div 
                    key={doc.key} 
                    className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-3xl sm:text-4xl mb-2">{doc.icon}</div>
                        <h4 className="font-semibold text-sm lg:text-base text-gray-900">{doc.label}</h4>
                      </div>
                      {isUploaded && (
                        <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-emerald-100 rounded text-xs">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold text-emerald-700 hidden sm:inline">Done</span>
                        </div>
                      )}
                    </div>

                    {isUploaded && (
                      <div className="mb-4">
                        {/* Inline Image Preview */}
                        <div className="mb-4 rounded-lg overflow-hidden border border-gray-200">
                          <img 
                            src={url} 
                            alt={doc.label}
                            className="w-full h-auto max-h-96 object-cover"
                          />
                        </div>

                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <p className="text-xs sm:text-sm text-emerald-800 font-medium">✓ Document uploaded</p>
                          <p className="text-xs text-emerald-700 mt-1">
                            {profile?.[`${doc.key}_verified`] && "✓ Verified"}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      {(doc.key === "id_front" || doc.key === "id_back") && (
                        <button
                          onClick={() => setCameraModal({ isOpen: true, fieldName: doc.key })}
                          className="flex-1 min-w-20 px-3 py-2 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors font-medium"
                        >
                          📷 Camera
                        </button>
                      )}

                      <button
                        onClick={() => fileInputRefs[doc.key].current?.click()}
                        disabled={uploadingDoc === doc.key}
                        className="flex-1 min-w-20 px-3 py-2 text-xs bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 disabled:opacity-50 transition-colors font-medium"
                      >
                        {uploadingDoc === doc.key ? (
                          <>⏳ Uploading...</>
                        ) : (
                          <>📤 {isUploaded ? "Update" : "Upload"}</>
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
            <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-semibold text-sm lg:text-base text-gray-900 mb-3">📋 Document Requirements</h4>
              <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-700">
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