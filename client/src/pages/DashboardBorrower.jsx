import { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { UserContext } from "../../context/userContext";
import { useNavigate } from "react-router-dom";
import { Camera, Plus, Settings } from "lucide-react"; // ✅ added Settings icon
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

function getStatusColor(status) {
  switch (status) {
    case "pending":
      return "text-yellow-600";
    case "approved":
      return "text-green-600";
    case "declined":
      return "text-red-600";
    case "returned":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
}

export default function DashboardBorrower() {
  const { user, setUser } = useContext(UserContext);
  const [history, setHistory] = useState([]);
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
  };

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err.message);
    }
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

  useEffect(() => {
    if (!user?.id) return;
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`/api/borrow/history/${user.id}`);
        setHistory(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      }
    };
    fetchHistory();
  }, [user]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = dayjs(dateString).tz("Asia/Manila");
    return date.isValid() ? date.format("MMM D, YYYY") : "—";
  };

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
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-3 sm:p-6">
      {/* Profile Header */}
      <div className="flex flex-col w-full max-w-md bg-white p-4 rounded-lg shadow-sm mb-6">
        {/* Top Row - Profile Info */}
        <div className="flex items-center text-left">
          {/* Image on the left */}
          <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500 flex-shrink-0">
            {profile?.profile_pic_url ? (
              <img
                src={profile.profile_pic_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-500 text-xs">
                No Photo
              </div>
            )}

            {/* Small camera icon overlay for upload */}
            <button
              className="absolute bottom-0 right-0 bg-purple-600 p-1 rounded-full text-white shadow hover:bg-purple-700"
              onClick={() => fileInputRefs.profile_pic.current.click()}
            >
              <Camera size={12} />
            </button>
            <input
              type="file"
              name="profile_pic"
              ref={fileInputRefs.profile_pic}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>

          {/* Name & Email beside the image */}
          <div className="ml-4 flex flex-col justify-center">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">
              {user?.name}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 opacity-50 break-all">
              {user?.email}
            </p>
          </div>
        </div>

        {/* ✅ Next Row - Settings Button */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>

      {/* Menu Buttons */}
      <div className="w-full max-w-xs sm:max-w-md space-y-3">
          {/* Notification testing panel removed in production build */}

          <button
            onClick={() => navigate("/scanner")}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-medium text-sm sm:text-base hover:bg-green-700 transition flex items-center justify-center gap-2"
          >
            <Camera size={18} />
            Scan Instrument
          </button>

          <button
            onClick={() => navigate("/personal-information")}
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium text-sm sm:text-base hover:bg-purple-700 transition"
          >
            Personal Information
          </button>

          <button
            onClick={() => navigate("/borrow-history")}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium text-sm sm:text-base hover:bg-blue-700 transition"
          >
            Borrow History
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-red-500 text-white rounded-lg font-medium text-sm sm:text-base hover:bg-red-600 transition mt-4"
          >
            Logout
          </button>
        </div>
    </div>
  );
}
