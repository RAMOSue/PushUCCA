import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { UserContext } from "../../../context/userContext";
import { BorrowingContext } from "../../../context/borrowingContext";
import { SidebarContext } from "../../context/SidebarContext";
import axios from "axios";
import { Package, ClipboardList, RefreshCw, Calendar, Users, Box, LogOut, User, ChevronRight, Plus, Database, Camera, Settings, Home, FileText, TrendingUp, Megaphone } from "lucide-react";

export default function SideNavbar({ role = "staff" }) {
  const { user, setUser, loading } = useContext(UserContext);
  const { cart } = useContext(BorrowingContext);
  const { sidebarOpen, setSidebarOpen, isMobile } = useContext(SidebarContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [profilePic, setProfilePic] = useState(null);

  // ✅ Use profile picture from UserContext instead of separate API call
  useEffect(() => {
    if (user?.profile_pic_url) {
      setProfilePic(user.profile_pic_url);
    }
  }, [user]);

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
      { path: "/performances", label: "Performances", icon: Calendar }, // ✅ NEW: Borrower performances
      { path: "/my-borrowed-items", label: "My Items", icon: Box },
    ];

    // Filter borrower items for mobile - only show Performances and Settings
    const borrowerItemsMobile = isMobile ? borrowerItems.filter(item => 
      ["/performances", "/settings"].includes(item.path)
    ) : borrowerItems;

      // Reordered for staff daily workflow
    const staffItems = [
      // Daily Operations
      { path: "/staff/manage-requests", label: "Manage borrowing", icon: ClipboardList },
      { path: "/staff/inventory", label: "Inventory", icon: Package },
      { path: "/staff/schedule", label: "Performance", icon: Calendar },
      { path: "/staff/announcements", label: "Announcements", icon: Megaphone },
      // Member Management
      { path: "/staff/borrower-profiles", label: "Borrower Profiles", icon: Users },
      { path: "/staff/documents", label: "Documents", icon: FileText },
      // Administration
      { path: "/staff/master-list", label: "Master List", icon: Database },
    ];

    const adminItems = [
      { path: "/admin/reports", label: "Reports", icon: Package },
      { path: "/admin/detection-accuracy", label: "AI Accuracy", icon: TrendingUp },
      { path: "/admin/manage-inventory", label: "Inventory", icon: Box },
      { path: "/admin/users", label: "User Management", icon: Users },
      { path: "/admin/master-list", label: "Master List", icon: Database },
      { path: "/admin/history", label: "History", icon: RefreshCw },
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
            transition: width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
                        box-shadow 0.3s ease-in-out,
                        padding 0.3s ease-in-out;
          }
        }
        @media (max-width: 1023px) {
          aside.left-sidebar {
            transition: width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                        box-shadow 0.25s ease-in-out;
          }
        }
      `}</style>

      {/* Sidebar */}
      <aside
        className={`left-sidebar fixed left-0 top-16 h-[calc(100vh-64px)] bg-surface-container-low dark:bg-[#1f1f1f] shadow-lg dark:shadow-none z-50 ${
          sidebarOpen ? "lg:w-64 md:w-56 sm:w-48 w-40" : "w-0"
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
        <div className="px-3 sm:px-4 md:px-5 lg:px-6 py-3 sm:py-3 md:py-3 lg:py-4 border-b border-outline-variant/20 dark:border-[#2a2a2a] sticky top-0 bg-surface-container-low dark:bg-[#1f1f1f] z-10 transition-all duration-300 mb-3 mt-2">
          {/* Profile Picture Circle - Clickable */}
          <button
            onClick={() => {
              handleViewProfile();
              if (isMobile) {
                setSidebarOpen(false);
              }
            }}
            className="w-full flex flex-col items-center text-center hover:opacity-80 transition-opacity duration-200"
            title="View Profile"
          >
            <div className="mb-2">
              {profilePic ? (
                <img
                  src={profilePic}
                  alt={user?.name}
                  className="w-12 sm:w-13 md:w-14 lg:w-16 h-12 sm:h-13 md:h-14 lg:h-16 rounded-full object-cover border-3 sm:border-3 md:border-4 lg:border-4 border-primary dark:border-blue-500 shadow-lg hover:border-primary/70 dark:hover:border-blue-400 transition-all duration-200"
                />
              ) : (
                <div className="w-12 sm:w-13 md:w-14 lg:w-16 h-12 sm:h-13 md:h-14 lg:h-16 rounded-full bg-primary/10 dark:bg-blue-900/20 flex items-center justify-center border-3 sm:border-3 md:border-4 lg:border-4 border-primary/20 dark:border-blue-500/30 shadow-lg hover:border-primary/30 dark:hover:border-blue-500/50 transition-all duration-200">
                  <User className="w-6 sm:w-6 md:w-7 lg:w-8 h-6 sm:h-6 md:h-7 lg:h-8 text-primary dark:text-blue-400" />
                </div>
              )}
            </div>

            {/* User Info */}
            <h3 className="font-bold text-on-surface dark:text-white text-xs sm:text-xs md:text-sm lg:text-sm truncate w-full">{user?.name || "User"}</h3>
            <p className="text-[10px] sm:text-[10px] md:text-xs lg:text-xs text-on-surface-variant dark:text-gray-400 capitalize font-medium mt-0.5 truncate w-full">{user?.role}</p>
          </button>
        </div>

      

        {/* Home removed — staff workflow streamlines to Manage Borrowing as landing */}

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col px-2 sm:px-3 md:px-4 lg:px-4 space-y-1 sm:space-y-1 md:space-y-2 lg:space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (isMobile) {
                    setSidebarOpen(false);
                  }
                }}
                className={`flex items-center justify-between px-3 sm:px-3 md:px-4 lg:px-4 py-2 sm:py-2 md:py-3 lg:py-3 rounded-lg text-xs sm:text-xs md:text-sm lg:text-sm font-medium transition-all duration-200 gap-2 sm:gap-3 ${
                  active
                    ? "bg-surface-container-lowest dark:bg-[#2a2a2a] text-primary dark:text-blue-400 shadow-sm border border-primary/20 dark:border-blue-500/30"
                    : "text-on-surface-variant dark:text-gray-400 hover:bg-surface-container-highest dark:hover:bg-[#2a2a2a] hover:text-on-surface dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <Icon className="w-4 sm:w-4 md:w-5 lg:w-5 h-4 sm:h-4 md:h-5 lg:h-5 flex-shrink-0" />
                  <span className="text-[9px] sm:text-[9px] md:text-[10px] lg:text-[10px] uppercase tracking-widest font-semibold truncate">{item.label}</span>
                </div>
                {active && <ChevronRight className="w-3 sm:w-3 md:w-4 lg:w-4 h-3 sm:h-3 md:h-4 lg:h-4 flex-shrink-0" />}
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
