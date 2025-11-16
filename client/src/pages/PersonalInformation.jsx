import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../context/userContext";
import { Plus, ArrowLeft } from "lucide-react";

export default function PersonalInformation() {
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

  const handleUpload = async (fieldName, file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append(fieldName, file);
    setUploading(true);
    try {
      await axios.post("/api/profiles/upload", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      fetchProfile();
    } catch (err) {
      console.error("Upload failed:", err.response?.data || err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-3 sm:p-6 flex justify-center">
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-lg shadow-md p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold mb-3 text-purple-600">Personal Information</h3>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded-lg"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        <div className="space-y-3 text-gray-700 text-sm sm:text-base">
          {[
            { key: "birth_certificate", label: "Birth Certificate" },
            { key: "class_schedule", label: "Class Schedule" },
            { key: "id_front", label: "ID Front" },
            { key: "id_back", label: "ID Back" },
          ].map(({ key, label }) => (
            <div key={key} className="flex justify-between items-center border-b pb-2">
              <div>
                {label}: {profile?.[`${key}_url`] ? (
                  <a href={profile[`${key}_url`]} target="_blank" rel="noreferrer" className="text-blue-600 underline">View</a>
                ) : (
                  "-"
                )}
              </div>

              <button
                onClick={() => fileInputRefs[key].current.click()}
                className="flex items-center gap-1 text-purple-600 hover:text-purple-800 text-sm"
              >
                <Plus size={14} /> Add
              </button>

              <input
                type="file"
                name={key}
                ref={fileInputRefs[key]}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
              />
            </div>
          ))}
        </div>

        {uploading && <p className="text-center text-gray-500 mt-3 text-sm">Uploading...</p>}

        <div className="mt-5">
          <button onClick={() => navigate('/dashboard')} className="w-full py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm font-medium">← Back to Dashboard</button>
        </div>
      </div>
    </div>
  );
}
