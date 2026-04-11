import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { UserContext } from "../../../context/userContext";
import { BorrowingContext } from "../../../context/borrowingcontext";
import { SidebarContext } from "../../../context/SidebarContext";
import axios from "axios";
import { Package, ClipboardList, RefreshCw, Calendar, Users, Box, LogOut, User, ChevronRight, Plus, Database, Camera } from "lucide-react";

export default function SideNavbar({ role = "staff" }) {
  const { user, setUser } = useContext(UserContext);
  const { cart } = useContext(BorrowingContext);
  const { sidebarOpen, setSidebarOpen, isMobile } = useContext(SidebarContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [profilePic, setProfilePic] = useState(null);

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

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err.message);
    }
  };

  const handleViewProfile = () => {
    if (role === "admin") {
      navigate("/admin/profile");
    } else if (role === "borrower") {
      navigate("/profile");
    } else {
      navigate("/staff/profile");
    }
  };

  // Navigation items based on role
  const getNavItems = () => {
    const borrowerItems = [
      { path: "/available-items", label: "Available Items", icon: Package },
      { path: "/my-borrowed-items", label: "My Items", icon: Box },
      { path: "/borrow-history", label: "History", icon: RefreshCw },
      { path: "/settings", label: "Settings", icon: Package },
    ];

    // Filter borrower items for mobile - only show History and Settings
    const borrowerItemsMobile = isMobile ? borrowerItems.filter(item => 
      ["/borrow-history", "/settings"].includes(item.path)
    ) : borrowerItems;

    const staffItems = [
      { path: "/staff", label: "Dashboard", icon: Package },
      { path: "/staff/available-items", label: "Available Items", icon: Package },
      { path: "/staff/manage-requests", label: "Manage borrowing", icon: ClipboardList },
      { path: "/staff/schedule", label: "Schedule", icon: Calendar },
      { path: "/staff/borrower-profiles", label: "Borrower Profiles", icon: Users },
      { path: "/staff/manage-inventory", label: "Inventory", icon: Box },
      { path: "/staff/master-list", label: "Master List", icon: Database },
    ];

    const adminItems = [
      { path: "/admin/available-items", label: "Available Items", icon: Package },
      { path: "/admin/manage-requests", label: "Borrow Requests", icon: ClipboardList },
      { path: "/admin/return-items", label: "Manage Returns", icon: RefreshCw },
      { path: "/admin/manage-inventory", label: "Inventory", icon: Box },
      { path: "/admin/users", label: "User Management", icon: Users },
      { path: "/admin/reports", label: "Reports", icon: Package },
    ];

    if (role === "admin") {
      return adminItems;
    } else if (role === "borrower") {
      return borrowerItemsMobile;
    }
    return staffItems;
  };

  const navItems = getNavItems();
  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Global Animation Styles for Synchronized Sidebars */}
      <style>{`
        @media (min-width: 1024px) {
          aside.left-sidebar {
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                        box-shadow 0.3s ease-out;
          }
        }
      `}</style>

      {/* Sidebar */}
      <aside
        className={`left-sidebar fixed left-0 top-19 h-[calc(100vh-64px)] bg-surface-container-low dark:bg-[#1f1f1f] shadow-lg dark:shadow-none z-50 ${
          sidebarOpen ? "w-64" : "w-0"
        }`}
        style={{
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          willChange: "width",
          backfaceVisibility: "hidden",
          perspective: 1000,
          transform: "translateZ(0)",
        }}
      >
        {/* Hide scrollbar styles */}
        <style>{`
          aside::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* User Profile Section at Top */}
        <div className="px-6 py-4 border-b border-outline-variant/20 dark:border-[#2a2a2a] sticky top-0 bg-surface-container-low dark:bg-[#1f1f1f] z-10 transition-colors duration-300">
          {/* Profile Picture Circle - Clickable */}
          <button
            onClick={handleViewProfile}
            className="w-full flex flex-col items-center text-center hover:opacity-80 transition-opacity"
            title="View Profile"
          >
            <div className="mb-2">
              {profilePic ? (
                <img
                  src={profilePic}
                  alt={user?.name}
                  className="w-16 h-16 rounded-full object-cover border-4 border-primary dark:border-blue-500 shadow-lg hover:border-primary/70 dark:hover:border-blue-400 transition-colors"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-blue-900/20 flex items-center justify-center border-4 border-primary/20 dark:border-blue-500/30 shadow-lg hover:border-primary/30 dark:hover:border-blue-500/50 transition-colors">
                  <User className="w-8 h-8 text-primary dark:text-blue-400" />
                </div>
              )}
            </div>

            {/* User Info */}
            <h3 className="font-bold text-on-surface dark:text-white text-sm">{user?.name || "User"}</h3>
            <p className="text-xs text-on-surface-variant dark:text-gray-400 capitalize font-medium mt-0.5">{user?.role}</p>
          </button>
         
        </div>

        {/* App Branding */}
        <div className="pt-6 px-6 mb-6">
          <h2 className="font-headline text-primary dark:text-blue-400 text-xl font-bold">Instrument Hub</h2>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant dark:text-gray-400 mt-1">Borrowing System</p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 gap-3 ${
                  active
                    ? "bg-surface-container-lowest dark:bg-[#2a2a2a] text-primary dark:text-blue-400 shadow-sm border border-primary/20 dark:border-blue-500/30"
                    : "text-on-surface-variant dark:text-gray-400 hover:bg-surface-container-highest dark:hover:bg-[#2a2a2a] hover:text-on-surface dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-widest font-semibold">{item.label}</span>
                </div>
                {active && <ChevronRight className="w-4 h-4" />}
              </Link>
            );
          })}
        </nav>

       
      </aside>

      {/* Overlay when sidebar is open on mobile */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 top-16"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
