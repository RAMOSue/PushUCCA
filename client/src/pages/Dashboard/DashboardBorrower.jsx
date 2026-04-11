import { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { UserContext } from "../../../context/userContext";
import { SidebarContext } from "../../../context/SidebarContext";
import { useNavigate } from "react-router-dom";
import { Camera, Plus, Settings, UserCircle, History, LogOut } from "lucide-react";
import PageLayout from "../../components/layout/PageLayout";
import NotificationBadge from "../../components/ui/NotificationBadge";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// Material Symbols Icon Component
const MaterialIcon = ({ icon, className = "" }) => (
  <span className={`material-symbols-outlined ${className}`} data-icon={icon}>{icon}</span>
);

dayjs.extend(utc);
dayjs.extend(timezone);

function getStatusColor(status) {
  switch (status) {
    case "pending":
      return "text-secondary-fixed";
    case "approved":
      return "text-primary";
    case "declined":
      return "text-error";
    case "returned":
      return "text-primary-container";
    default:
      return "text-on-surface-variant";
  }
}

export default function DashboardBorrower() {
  const { user, setUser } = useContext(UserContext);
  const { sidebarOpen, setSidebarOpen } = useContext(SidebarContext);
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [profilePic, setProfilePic] = useState(null);
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

  // Fetch profile picture on mount
  useEffect(() => {
    if (user?.id) {
      fetchProfilePicture();
    }
  }, [user]);

  const fetchProfilePicture = async () => {
    try {
      const { data } = await axios.get("/api/profiles/me", {
        withCredentials: true,
      });
      if (data?.profile_pic_url) {
        setProfilePic(data.profile_pic_url);
      }
    } catch (err) {
      console.error("Failed to fetch profile picture:", err.message);
    }
  };

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
    <PageLayout>
      
      <div className="">
      {/* Welcome Section */}
      <div className="px-6 md:px-12 lg:px-20 pt-24 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-primary font-bold mb-2 block">Borrower Dashboard</span>
            <h1 className="font-headline text-5xl md:text-6xl text-on-surface leading-tight">
              Welcome, {user?.name || "Borrower"}
            </h1>
            <p className="text-on-surface-variant mt-4 max-w-xl">
              View your borrowing history, manage active loans, and explore available items in our collection.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-20 mb-12">
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10 flex flex-col md:flex-row md:items-center gap-8">
          {/* Profile Picture */}
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-primary flex-shrink-0">
            {profile?.profile_pic_url ? (
              <img
                src={profile.profile_pic_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10">
                <UserCircle className="w-12 h-12 text-primary" />
              </div>
            )}

            {/* Camera icon overlay */}
            <button
              className="absolute bottom-0 right-0 bg-primary text-on-primary p-2 rounded-full shadow hover:bg-primary-container transition-all"
              onClick={() => fileInputRefs.profile_pic.current.click()}
            >
              <Camera size={14} />
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

          {/* Profile Info */}
          <div className="flex-1">
            <h2 className="font-headline text-3xl text-on-surface mb-2">
              {user?.name}
            </h2>
            <p className="text-on-surface-variant mb-2">{user?.email}</p>
            <p className="text-sm text-outline-variant capitalize mb-4">Role: {user?.role}</p>
            
            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/documents")}
                className="bg-primary text-on-primary px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-container transition-all font-bold text-sm"
              >
                <UserCircle className="w-4 h-4" />
                Personal Info
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="bg-surface-container-high text-on-surface px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-outline-variant/20 transition-all font-bold text-sm"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Borrowing Summary Cards */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-20 mb-16">
        <h3 className="font-headline text-2xl text-on-surface mb-6">
          <span className="text-primary font-bold">Borrowing</span> Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
            <Plus className="w-6 h-6 text-primary mb-4" />
            <h4 className="font-serif text-3xl text-primary font-bold">{history.filter(h => h.status === 'approved').length}</h4>
            <p className="text-sm font-bold text-on-surface-variant uppercase tracking-tighter mt-2">Active Borrows</p>
            <p className="text-xs text-outline mt-2 italic">Currently in use</p>
          </div>
          
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
            <History className="w-6 h-6 text-secondary mb-4" />
            <h4 className="font-serif text-3xl text-secondary font-bold">{history.length}</h4>
            <p className="text-sm font-bold text-on-surface-variant uppercase tracking-tighter mt-2">Total Requests</p>
            <p className="text-xs text-outline mt-2 italic">All time records</p>
          </div>
          
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10">
            <Plus className="w-6 h-6 text-tertiary mb-4" />
            <h4 className="font-serif text-3xl text-tertiary font-bold">{history.filter(h => h.status === 'returned').length}</h4>
            <p className="text-sm font-bold text-on-surface-variant uppercase tracking-tighter mt-2">Returned Items</p>
            <p className="text-xs text-outline mt-2 italic">Completed</p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-20 mb-16">
        <h3 className="font-headline text-2xl text-on-surface mb-6">Quick Links</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/available-items")}
            className="bg-primary text-on-primary px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-primary-container transition-all font-bold text-sm"
          >
            <Plus className="w-5 h-5" />
            Browse Items
          </button>
          <button
            onClick={() => navigate("/borrow-history")}
            className="bg-secondary-fixed text-on-secondary-fixed px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-secondary-fixed-dim transition-all font-bold text-sm"
          >
            <History className="w-5 h-5" />
            View History
          </button>
          <button
            onClick={handleLogout}
            className="bg-error text-on-error px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-error/90 transition-all font-bold text-sm"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>

      <div className="pb-12" />
    </div>
    </PageLayout>
  );
}

