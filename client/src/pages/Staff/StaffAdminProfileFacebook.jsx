import { useContext, useEffect, useState, useRef } from "react";
import { UserContext } from "../../../context/userContext";
import PageLayout from "../../components/layout/PageLayout";
import axios from "axios";
import { Mail, Phone, Shield, Camera, Upload, Check, Settings } from "lucide-react";
import toast from "react-hot-toast";
import ImagePreviewModal from "../../components/modals/ImagePreviewModal";
import SchoolIDVerificationModal from "../../components/modals/SchoolIDVerificationModal";

export default function StaffAdminProfileFacebook() {
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
      setTempProfile(buildTempProfile(profileData));
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
      setTempProfile(buildTempProfile(user));
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

  const saveExtendedProfile = async () => {
    try {
      const { data } = await axios.patch("/api/profiles/me", tempProfile, { withCredentials: true });
      const savedProfile = data.profile || data;
      setProfile(savedProfile);
      setTempProfile(buildTempProfile(savedProfile));
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

  // ===== HELPERS =====
  const getDivisionName = () => {
    if (!tempDivision) return "Not assigned";
    const division = divisions.find(d => d.id === tempDivision);
    return division?.name || "Not assigned";
  };

  const buildTempProfile = (profileData) => ({
    date_of_birth: profileData?.date_of_birth || "",
    citizenship: profileData?.citizenship || "",
    religion: profileData?.religion || "",
    marital_status: profileData?.marital_status || "",
    college: profileData?.college || "",
    program: profileData?.program || "",
    current_address: profileData?.current_address || "",
    height: profileData?.height || "",
    weight: profileData?.weight || "",
    eye_color: profileData?.eye_color || "",
    mother_full_name: profileData?.mother_full_name || "",
    mother_birthday: profileData?.mother_birthday || "",
    father_full_name: profileData?.father_full_name || "",
    father_birthday: profileData?.father_birthday || "",
    emergency_contact_name: profileData?.emergency_contact_name || "",
    emergency_contact_mobile: profileData?.emergency_contact_mobile || "",
    emergency_contact_relationship: profileData?.emergency_contact_relationship || "",
    emergency_contact_occupation: profileData?.emergency_contact_occupation || "",
  });

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

  const extendedProfileFields = profileSections
    .flatMap((section) => section.fields)
    .filter(({ key }) => !["name", "email", "phone", "division_id", "role"].includes(key));

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
      <div className="relative w-full h-60 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900">
        <div className="absolute top-0 left-0 right-0 h-full opacity-20">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent" />
        </div>

        {/* Action Buttons Top Right */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#222] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT WITH HEADER OVERLAP */}
      <div className="relative px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto mb-6 flex justify-end">
          <button
            onClick={() => setEditingProfile((prev) => !prev)}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700"
          >
            {editingProfile ? "Cancel" : "Edit Profile"}
          </button>
        </div>
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
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 border-4 border-white shadow-lg flex items-center justify-center">
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

            {/* Name & Role */}
            <div className="flex-1 flex flex-col justify-end pb-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">{profile?.name}</h1>
              
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200 rounded-full text-sm font-semibold transition-colors">
                  <Shield className="w-4 h-4" />
                  {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                </span>
                {profile?.department_name && (
                  <span className="text-sm text-gray-600 dark:text-gray-400">{profile.department_name}</span>
                )}
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                ID: <span className="font-mono text-gray-700 dark:text-gray-300">{user?.id}</span>
              </p>
            </div>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="max-w-7xl mx-auto pb-12">
          {/* TAB NAVIGATION */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-8 -mx-4 sm:mx-0 px-4 sm:px-0">
            {["overview", "documents"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-medium text-sm transition-all border-b-2 ${
                  activeTab === tab
                    ? "border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT SIDEBAR */}
              <div className="lg:col-span-1">
                {/* Personal Details Card */}
                <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                  <div className="bg-gray-50 dark:bg-[#222] px-6 py-4 border-b border-gray-200 dark:border-gray-700 transition-colors">
                    <h3 className="font-semibold text-gray-900 dark:text-white">About</h3>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Email */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Email</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100 break-all">{profile?.email}</p>
                    </div>

                    {/* Phone */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                      {editingPhone ? (
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            value={tempPhone}
                            onChange={(e) => setTempPhone(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#333] text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveField("phone")}
                            className="px-2 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingPhone(false);
                              setTempPhone(profile?.phone || "");
                            }}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-[#222] dark:text-gray-300 dark:bg-[#1a1a1a] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <p
                          onClick={() => setEditingPhone(true)}
                          className="text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          {tempPhone || "Not provided"} {tempPhone && "✎"}
                        </p>
                      )}
                    </div>

                    {/* Division */}
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Department</p>
                      {editingDivision ? (
                        <div className="flex gap-2">
                          <select
                            value={tempDivision || ""}
                            onChange={(e) => setTempDivision(e.target.value ? parseInt(e.target.value) : null)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#333] text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                            autoFocus
                          >
                            <option value="">Select...</option>
                            {divisions.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSaveField("division_id")}
                            className="px-2 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <p
                          onClick={() => setEditingDivision(true)}
                          className="text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          {getDivisionName()} {tempDivision && "✎"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Additional Profile Details</h3>
                    <div className="flex gap-2">
                      {editingProfile ? (
                        <>
                          <button onClick={saveExtendedProfile} className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700">Save</button>
                          <button onClick={() => { setEditingProfile(false); setTempProfile(buildTempProfile(profile)); }} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-[#222]">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setEditingProfile(true)} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-[#222]">Edit</button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {extendedProfileFields.map(({ label, key }) => (
                      <div key={key} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252525] p-3">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                        {editingProfile ? (
                          <input
                            type={key.includes("birthday") || key === "date_of_birth" ? "date" : "text"}
                            value={tempProfile?.[key] ?? ""}
                            onChange={(e) => setTempProfile((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#333] text-gray-900 dark:text-white"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 dark:text-white">{profile?.[key] || "Not provided"}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Documents Summary Card (Borrower Only) */}
                {user?.role === "borrower" && (
                  <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mt-6 transition-colors">
                    <div className="bg-gray-50 dark:bg-[#222] px-6 py-4 border-b border-gray-200 dark:border-gray-700 transition-colors">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Documents</h3>
                    </div>

                    <div className="p-6 space-y-3">
                      {["birth_certificate", "class_schedule", "id_front", "id_back"].map(doc => {
                        const labels = {
                          birth_certificate: "Birth Certificate",
                          class_schedule: "Class Schedule",
                          id_front: "ID (Front)",
                          id_back: "ID (Back)",
                        };
                        const isUploaded = getDocumentStatus(doc) === "uploaded";
                        return (
                          <div key={doc} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isUploaded ? (
                                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                              )}
                              <span className="text-sm text-gray-700 dark:text-gray-300">{labels[doc]}</span>
                            </div>
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              {isUploaded ? "✓" : "−"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT CONTENT */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg transition-colors">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Full Name</p>
                      {editingName ? (
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#333] text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveField("name")}
                            className="px-2 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <p
                          onClick={() => setEditingName(true)}
                          className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        >
                          {tempName} ✎
                        </p>
                      )}
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg transition-colors">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Role</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                      </p>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg transition-colors">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">User ID</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">{user?.id}</p>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg transition-colors">
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Last Updated</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENTS TAB (Borrower Only) */}
          {activeTab === "documents" && user?.role === "borrower" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {["birth_certificate", "class_schedule", "id_front", "id_back"].map(doc => {
                const labels = {
                  birth_certificate: "Birth Certificate",
                  class_schedule: "Class Schedule",
                  id_front: "School ID (Front)",
                  id_back: "School ID (Back)",
                };
                const icons = {
                  birth_certificate: "📄",
                  class_schedule: "📅",
                  id_front: "🆔",
                  id_back: "🆔",
                };
                const url = profile?.[`${doc}_url`];
                const isUploaded = !!url;

                return (
                  <div key={doc} className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md dark:hover:shadow-md dark:hover:shadow-black/50 transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-3xl mb-2">{icons[doc]}</div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{labels[doc]}</h4>
                      </div>
                      {isUploaded && (
                        <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      )}
                    </div>

                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      {isUploaded ? "✓ Uploaded" : "⚠ Missing"}
                    </p>

                    <div className="flex gap-2">
                      {isUploaded && (
                        <button
                          onClick={() =>
                            setPreviewModal({
                              isOpen: true,
                              imageUrl: url,
                              fileName: labels[doc],
                            })
                          }
                          className="flex-1 px-3 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-medium"
                        >
                          View
                        </button>
                      )}

                      {(doc === "id_front" || doc === "id_back") && (
                        <button
                          onClick={() => setCameraModal({ isOpen: true, fieldName: doc })}
                          className="flex-1 px-3 py-2 text-sm bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors font-medium"
                        >
                          Camera
                        </button>
                      )}

                      <button
                        onClick={() => fileInputRefs[doc].current?.click()}
                        disabled={uploadingDoc === doc}
                        className="flex-1 px-3 py-2 text-sm bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/50 disabled:opacity-50 transition-colors font-medium"
                      >
                        {uploadingDoc === doc ? "⏳ Uploading..." : "Upload"}
                      </button>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRefs[doc]}
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={handleDocumentFileChange}
                      disabled={uploadingDoc === doc}
                    />
                  </div>
                );
              })}
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
