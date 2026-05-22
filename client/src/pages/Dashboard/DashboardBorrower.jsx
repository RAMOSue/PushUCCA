import { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { UserContext } from "../../../context/userContext";
import { SidebarContext } from "../../context/SidebarContext";
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

  // ✅ Use profile data from UserContext instead of making duplicate API calls
  useEffect(() => {
    if (user?.id) {
      setProfile(user);
      if (user?.profile_pic_url) {
        setProfilePic(user.profile_pic_url);
      }
    }
  }, [user]);

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

