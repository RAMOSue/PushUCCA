import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext, useEffect, useState, useRef } from "react";
import { UserContext } from "../../../context/userContext";
import { BorrowingContext } from "../../../context/borrowingContext";
import { SidebarContext } from "../../context/SidebarContext";
import { LoginModalContext } from "../../../context/LoginModalContext";
import { useSidebarStore, DIVISION_OPTIONS } from "../../../context/sidebarStore";
import axios from "axios";
import tokenManager from "../../utils/tokenManager";
import { INACTIVITY_CONFIG } from "../../config/inactivityConfig";
import { Home, LogOut, Camera, Menu, BookOpen, ShoppingCart, Smartphone, ImageIcon, X, User, ChevronDown, Bell, Settings, History, Search } from 'lucide-react';
import NotificationBadge from "../ui/NotificationBadge";
import { notificationService } from "../../services/notifications";
import Logo from "../../assets/Logo.png";

// Material Symbols Icon Component
const MaterialIcon = ({ icon, className = "" }) => (
  <span className={`material-symbols-outlined ${className}`} data-icon={icon}>{icon}</span>
);

const PublicBrand = () => (
  <div className="flex items-center gap-2 sm:gap-3">
    <img src={Logo} alt="CSU Logo" className="h-9 w-auto object-contain sm:h-12" />
    <div className="leading-tight">
      <p className="text-sm font-thick text-black sm:text-base">Caraga State University</p>
      <p className="text-[10px] font-thin text-black sm:text-xs">University Center for Culture and the Arts</p>
    </div>
  </div>
);

function GlobalSearchBar({ value, onChange, onClear, placeholder = "Search" }) {
  return (
    <div className="relative flex items-center h-full min-w-0 flex-1 max-w-xs">
      <Search className="absolute left-3 h-4 w-4 text-gray-500 dark:text-gray-400" />
      <input
        className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 placeholder-slate-400 shadow-sm outline-none transition focus:border-[#FBBC38] focus:ring-2 focus:ring-[#FBBC38]/20 dark:border-slate-700 dark:bg-[#1f1f1f] dark:text-slate-100 dark:placeholder-slate-500"
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={onChange}
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-2 text-gray-500 transition hover:text-[#FBBC38] dark:text-gray-400 dark:hover:text-blue-400"
          title="Clear search"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, setUser, loading } = useContext(UserContext);
  const { cart } = useContext(BorrowingContext);
  const { rightSidebarOpen, setRightSidebarOpen } = useContext(SidebarContext);
  const { openLoginModal } = useContext(LoginModalContext);
  const { selectedDivision, setSelectedDivision, globalSearchQuery, setGlobalSearchQuery } = useSidebarStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [profileHovered, setProfileHovered] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [divisionMenuOpen, setDivisionMenuOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const divisionMenuRef = useRef(null);
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    if (pathnameRef.current !== location.pathname) {
      setGlobalSearchQuery('');
    }
    pathnameRef.current = location.pathname;
  }, [location.pathname, setGlobalSearchQuery]);

  // ✅ Close dropdown when clicking outside (unless hovering)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        // Only close if not hovering
        if (!profileHovered) {
          setProfileDropdownOpen(false);
        }
      }
      if (divisionMenuRef.current && !divisionMenuRef.current.contains(event.target)) {
        setDivisionMenuOpen(false);
      }
    };

    if (profileDropdownOpen || profileHovered || divisionMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [profileDropdownOpen, profileHovered, divisionMenuOpen]);

  // ✅ Detect scroll for dynamic z-index (borrower desktop navbar)
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (user) {
      const setupNotifications = async () => {
        const initialized = await notificationService.init();
        if (initialized && Notification.permission === "granted") {
          await notificationService.subscribe(user.id);
        }
      };
      setupNotifications();
      
      // ✅ Use profile picture from UserContext instead of separate API call
      if (user?.profile_pic_url) {
        setProfilePic(user.profile_pic_url);
      }
    }
  }, [user]);

  // Removed: fetchProfilePicture() - now using data from UserContext

  const handleViewProfile = () => {
    if (user?.role === "admin") {
      navigate("/admin/profile");
    } else if (user?.role === "borrower") {
      navigate("/profile");
    } else if (user?.role === "staff") {
      navigate("/staff/profile");
    }
    setProfileDropdownOpen(false);
  };

  const handleLogout = async () => {
    try {
      // Call backend to clear cookies
      await axios.post("/api/auth/logout");
      console.log("✅ Backend logout successful");
    } catch (err) {
      console.error("⚠️ Backend logout failed:", err.message);
    } finally {
      // Always clear local session regardless of API call success
      // This ensures user is logged out locally even if backend fails
      console.log("🔄 Clearing local session...");
      
      // Clear all stored tokens from localStorage
      tokenManager.clearAll();
      console.log("✅ Cleared tokenManager");
      
      // Clear session key from localStorage
      localStorage.removeItem(INACTIVITY_CONFIG.SESSION_KEY);
      console.log("✅ Cleared session storage");
      
      // Clear user from state
      setUser(null);
      console.log("✅ Cleared user state");
      
      // Navigate to home
      navigate("/");
      console.log("✅ Navigated to home");
    }
  };

  const getDashboardLink = () => {
    if (user?.role === "admin") return "/admin/available-items";
    if (user?.role === "staff") return "/staff/available-items";
    return "/dashboard"; // borrower
  };

  // Show loading navbar while checking authentication
  if (loading) {
    return (
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-300 ease-in-out h-14 sm:h-16">
        <div className="flex h-full w-full items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <PublicBrand />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[#004aad]"></div>
            <span className="text-sm text-slate-500">Loading...</span>
          </div>
        </div>
      </header>
    );
  }

  // Professional header for unauthenticated users (GetStarted page)
  if (!user) {
    return (
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-300 ease-in-out h-14 sm:h-16">
        <div className="flex h-full w-full items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4 md:px-6">
          <div className="flex min-w-0 items-center">
            <PublicBrand />
          </div>

          <button
            onClick={openLoginModal}
            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-[#164f11] px-3 text-xs font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0f3c0c] hover:shadow-md sm:h-11 sm:px-5 sm:text-sm"
          >
            Log In
          </button>
        </div>
      </header>
    );
  }

  // <CHANGE> Updated borrower bottom navbar with green accent theme
  if (user?.role === "borrower") {
    const borrowerRoutes = [
      "/dashboard",
      "/available-items",
      "/borrow-cart",
      "/performances",
      "/my-borrowed-items",
      "/borrow-history",
      "/settings",
      "/profile",
      "/scanner",
      "/scan",
      "/notifications",
    ];

    const scannerRoutes = ["/scan", "/scanner"];
    const isOnScannerPage = scannerRoutes.some(
      (r) => location.pathname === r || location.pathname.startsWith(r + "/")
    );

    if (isOnScannerPage) {
      return null;
    }

    const isBorrowerRoute = borrowerRoutes.some(
      (r) => location.pathname === r || location.pathname.startsWith(r + "/")
    );

    if (isBorrowerRoute) {
      return (
        <>
          {/* ✅ BORROWER HEADER - Responsive colors: white on mobile, branded on desktop */}
          <header className="sticky top-0 bg-white md:bg-[#001800] dark:md:bg-[#171717] backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95 z-40 border-b-4 border-gray-200 md:border-[#FBBC38] dark:md:border-[#2a2a2a] shadow-[0_20px_50px_rgba(0,0,0,0.1)] md:shadow-[0_20px_50px_rgba(0,24,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] h-16 transition-all duration-300 ease-in-out">
            <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8 py-0 w-full h-full max-w-full gap-3 sm:gap-4 md:gap-6 lg:gap-8">
              {/* Leading: Logo & Menu */}
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4 lg:gap-6 h-full min-w-0">
                <button 
                  onClick={() => setLeftSidebarCollapsed((prev) => !prev)}
                  className="text-gray-600 md:text-[#92D6A2] dark:md:text-gray-300 hover:scale-95 duration-150 transition-all flex items-center justify-center w-6 sm:w-7 md:w-8 lg:w-8 h-6 sm:h-7 md:h-8 lg:h-8 flex-shrink-0"
                  title={leftSidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
                >
                  <MaterialIcon icon="menu" className="text-xl sm:text-2xl md:text-2xl lg:text-2xl" />
                </button>
                <div className="text-xs sm:text-sm md:text-lg lg:text-lg font-black tracking-tighter text-gray-900 md:text-[#C8EDBA] dark:md:text-white font-headline uppercase line-clamp-1 leading-none truncate">
                  {user ? "UCCA" : "Academic Conservator"}
                </div>
                  {/* Search Bar - Visible on all screens */}
{user && (
  <div className="ml-2 sm:ml-3 md:ml-6 lg:ml-8 flex-1 max-w-xs">
    <GlobalSearchBar
      value={globalSearchQuery}
      onChange={(e) => setGlobalSearchQuery(e.target.value)}
      onClear={() => setGlobalSearchQuery('')}
      placeholder="Search across the app"
    />
  </div>
)}
              </div>

              {/* Trailing: Actions */}
              <div className="flex items-center gap-2 sm:gap-3 md:gap-4 lg:gap-6 ml-auto h-full">
              

                {/* Borrower Cart Button (Desktop) */}
                {user?.role === "borrower" && (
                  <Link
                    to="/borrow-cart"
                    className="relative h-full flex items-center justify-center hover:opacity-80 transition-opacity duration-300 ease-in-out flex-shrink-0"
                    title="Borrow Cart"
                  >
                    <div className="flex items-center justify-center relative">
                      <ShoppingCart className="w-5 sm:w-5 md:w-6 lg:w-6 h-5 sm:h-5 md:h-6 lg:h-6 text-gray-600 md:text-[#92D6A2] dark:md:text-blue-400 hover:text-gray-900 md:hover:text-[#FBBC38] dark:md:hover:text-yellow-400 transition-colors duration-300 ease-in-out" />
                      {/* Cart badge */}
                      {cart && cart.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 dark:bg-red-600 text-white text-[10px] sm:text-[10px] md:text-xs font-bold w-4 sm:w-4 md:w-5 h-4 sm:h-4 md:h-5 rounded-full flex items-center justify-center">
                          {cart.length}
                        </span>
                      )}
                    </div>
                  </Link>
                )}

                {/* Notification Badge */}
                {user?.role === "borrower" && (
                  <div className="h-full flex items-center">
                    <NotificationBadge />
                  </div>
                )}

                {/* Profile Section with Dropdown */}
                {user && (
                  <div 
                    className="relative" 
                    ref={profileDropdownRef}
                    onMouseEnter={() => setProfileHovered(true)}
                    onMouseLeave={() => setProfileHovered(false)}
                  >
                    <button
  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
  className="hidden md:flex w-8 sm:w-9 md:w-10 lg:w-10 h-8 sm:h-9 md:h-10 lg:h-10 rounded-full bg-[#13300E] dark:bg-[#2a2a2a] items-center justify-center overflow-hidden border border-[#42493E]/20 dark:border-[#3a3a3a] flex-shrink-0 hover:border-[#FBBC38]/50 dark:hover:border-blue-500/50 transition-colors duration-200 ease-in-out"
  title="Profile menu"
>
  {profilePic ? (
    <img
      alt={user?.name}
      className="w-full h-full object-cover"
      src={profilePic}
    />
  ) : (
    <MaterialIcon
      icon="account_circle"
      className="text-[#92D6A2] dark:text-blue-400 text-xl sm:text-2xl md:text-2xl lg:text-2xl"
    />
  )}
</button>

                    {/* Dropdown Menu - Uses fixed positioning to overlay everything */}
                    {(profileDropdownOpen || profileHovered) && (
                      <div 
                        className="fixed right-3 sm:right-4 md:right-6 lg:right-8 top-20 bg-white dark:bg-[#1f1f1f] rounded-lg shadow-2xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-[#2a2a2a] w-44 sm:w-48 md:w-48 lg:w-48 overflow-visible z-[9999] transition-all duration-200 ease-in-out"
                        onMouseEnter={() => setProfileHovered(true)}
                        onMouseLeave={() => setProfileHovered(false)}
                      >
                        <button
                          onClick={() => {
                            handleViewProfile();
                            setProfileDropdownOpen(false);
                            setProfileHovered(false);
                          }}
                          className="w-full px-3 sm:px-4 md:px-4 lg:px-4 py-2 sm:py-2.5 md:py-2.5 lg:py-2.5 text-left text-xs sm:text-sm md:text-sm lg:text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] flex items-center gap-2 transition-colors duration-200 ease-in-out border-b border-gray-100 dark:border-[#2a2a2a]"
                        >
                          <User className="w-4 h-4 flex-shrink-0" />
                          View Profile
                        </button>
                        <button
                          onClick={() => {
                            navigate("/settings");
                            setProfileDropdownOpen(false);
                            setProfileHovered(false);
                          }}
                          className="w-full px-3 sm:px-4 md:px-4 lg:px-4 py-2 sm:py-2.5 md:py-2.5 lg:py-2.5 text-left text-xs sm:text-sm md:text-sm lg:text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] flex items-center gap-2 transition-colors duration-200 ease-in-out border-b border-gray-100 dark:border-[#2a2a2a]"
                        >
                          <Settings className="w-4 h-4 flex-shrink-0" />
                          Settings
                        </button>
                        <button
                          onClick={() => {
                            handleLogout();
                            setProfileDropdownOpen(false);
                            setProfileHovered(false);
                          }}
                          className="w-full px-3 sm:px-4 md:px-4 lg:px-4 py-2 sm:py-2.5 md:py-2.5 lg:py-2.5 text-left text-xs sm:text-sm md:text-sm lg:text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors duration-200 ease-in-out"
                        >
                          <LogOut className="w-4 h-4 flex-shrink-0" />
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* <CHANGE> Mobile bottom navbar (hidden on 1024px+) */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1f1f1f] border-t border-gray-100 dark:border-[#2a2a2a] shadow-lg dark:shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-50 h-16 transition-colors duration-300">
            <div className="flex justify-around items-center sm-mobile:py-2 md-mobile:py-2.5 lg-mobile:py-3 tablet:py-4 gap-0.5">
              {/* Home Button */}
              <Link
                to="/available-items"
                className={`flex flex-col items-center justify-center transition-all duration-300 ${
                  location.pathname.includes("/available-items")
                    ? "text-emerald-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-blue-300"
                }`}
              >
                <div className="sm-mobile:p-2 md-mobile:p-2.5 lg-mobile:p-2.5 tablet:p-3">
                  <Home className="sm-mobile:w-5 sm-mobile:h-5 md-mobile:w-5 md-mobile:h-5 lg-mobile:w-6 lg-mobile:h-6 tablet:w-6 tablet:h-6" />
                </div>
                <span className="sm-mobile:text-[10px] md-mobile:text-[10px] lg-mobile:text-xs tablet:text-xs font-medium">Home</span>
              </Link>

              {/* Borrowed Items Button */}
              <Link
                to="/my-borrowed-items"
                className={`flex flex-col items-center justify-center transition-all duration-300 ${
                  location.pathname.includes("/my-borrowed-items")
                    ? "text-emerald-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-blue-300"
                }`}
              >
                <div className="sm-mobile:p-2 md-mobile:p-2.5 lg-mobile:p-2.5 tablet:p-3">
                  <BookOpen className="sm-mobile:w-5 sm-mobile:h-5 md-mobile:w-5 md-mobile:h-5 lg-mobile:w-6 lg-mobile:h-6 tablet:w-6 tablet:h-6" />
                </div>
                <span className="sm-mobile:text-[10px] md-mobile:text-[10px] lg-mobile:text-xs tablet:text-xs font-medium">Borrowed</span>
              </Link>

              {/* <CHANGE> Center Scanner Button with green gradient */}
              <button
                onClick={() => setShowScannerModal(true)}
                className="flex flex-col items-center justify-center relative sm-mobile:-mt-4 md-mobile:-mt-5 lg-mobile:-mt-5 tablet:-mt-6 mb-1 transition-transform duration-300 hover:scale-110 active:scale-95"
              >
                <div className="sm-mobile:w-12 sm-mobile:h-12 md-mobile:w-14 md-mobile:h-14 lg-mobile:w-14 lg-mobile:h-14 tablet:w-16 tablet:h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-blue-500 dark:to-blue-600 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
                  <Camera className="sm-mobile:w-6 sm-mobile:h-6 md-mobile:w-6 md-mobile:h-6 lg-mobile:w-7 lg-mobile:h-7 tablet:w-8 tablet:h-8 text-white" />
                </div>
                <span className="sm-mobile:text-[9px] md-mobile:text-[10px] lg-mobile:text-xs tablet:text-xs mt-1 font-medium text-gray-700 dark:text-gray-300">Scan</span>
              </button>

              {/* Cart Button */}
              <Link
                to="/borrow-cart"
                className={`flex flex-col items-center justify-center transition-all duration-300 relative ${
                  location.pathname.includes("/borrow-cart")
                    ? "text-emerald-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-blue-300"
                }`}
              >
                <div className="sm-mobile:p-2 md-mobile:p-2.5 lg-mobile:p-2.5 tablet:p-3 relative">
                  <ShoppingCart className="sm-mobile:w-5 sm-mobile:h-5 md-mobile:w-5 md-mobile:h-5 lg-mobile:w-6 lg-mobile:h-6 tablet:w-6 tablet:h-6" />
                  {/* <CHANGE> Cart badge styling updated */}
                  {cart && cart.length > 0 && (
                    <span className="absolute sm-mobile:-top-1 sm-mobile:-right-1 md-mobile:-top-1.5 md-mobile:-right-1.5 bg-emerald-500 dark:bg-blue-500 text-white sm-mobile:text-[7px] md-mobile:text-[8px] lg-mobile:text-[8px] tablet:text-xs font-bold sm-mobile:w-4 sm-mobile:h-4 md-mobile:w-5 md-mobile:h-5 lg-mobile:w-5 lg-mobile:h-5 tablet:w-6 tablet:h-6 rounded-full flex items-center justify-center">
                      {cart.length}
                    </span>
                  )}
                </div>
                <span className="sm-mobile:text-[10px] md-mobile:text-[10px] lg-mobile:text-xs tablet:text-xs font-medium">Cart</span>
              </Link>

              {/* Profile Button */}
              <Link
                to="/profile"
                className={`flex flex-col items-center justify-center transition-all duration-300 ${
                  location.pathname === "/documents"
                    ? "text-emerald-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-blue-300"
                }`}
              >
                <div className="sm-mobile:p-2 md-mobile:p-2.5 lg-mobile:p-2.5 tablet:p-3">
                  <User className="sm-mobile:w-5 sm-mobile:h-5 md-mobile:w-5 md-mobile:h-5 lg-mobile:w-6 lg-mobile:h-6 tablet:w-6 tablet:h-6" />
                </div>
                <span className="sm-mobile:text-[10px] md-mobile:text-[10px] lg-mobile:text-xs tablet:text-xs font-medium">Profile</span>
              </Link>
            </div>
          </nav>

          {/* <CHANGE> Scanner Modal with green accent theme - Mobile version */}
          {showScannerModal && (
            <div className="lg:hidden fixed inset-0 bg-black bg-opacity-40 dark:bg-black/60 flex items-center justify-center z-[60] sm-mobile:p-3 md-mobile:p-4 lg-mobile:p-4 tablet:p-6 animate-fadeIn">
              <div className="bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-2xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] sm-mobile:p-4 md-mobile:p-6 lg-mobile:p-6 tablet:p-8 w-full sm-mobile:max-w-xs md-mobile:max-w-sm lg-mobile:max-w-md tablet:max-w-lg animate-slideUp transition-colors duration-300">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="sm-mobile:text-lg md-mobile:text-xl lg-mobile:text-xl tablet:text-2xl font-bold text-gray-900 dark:text-white">Choose Scanner</h2>
                  <button
                    onClick={() => setShowScannerModal(false)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-lg transition-colors"
                  >
                    <X className="sm-mobile:w-5 sm-mobile:h-5 md-mobile:w-6 md-mobile:h-6 lg-mobile:w-6 lg-mobile:h-6 tablet:w-6 tablet:h-6 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Scanner Options */}
                <div className="grid grid-cols-1 gap-3">
                  {/* Instrument Scanner */}
                  <button
                    onClick={() => {
                      setShowScannerModal(false);
                      navigate("/scanner");
                    }}
                    className="flex items-center gap-3 sm-mobile:p-3 md-mobile:p-4 lg-mobile:p-4 tablet:p-4 border-2 border-gray-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                  >
                    <div className="sm-mobile:w-10 sm-mobile:h-10 md-mobile:w-12 md-mobile:h-12 lg-mobile:w-12 lg-mobile:h-12 tablet:w-14 tablet:h-14 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                      <Camera className="sm-mobile:w-5 sm-mobile:h-5 md-mobile:w-6 md-mobile:h-6 lg-mobile:w-6 lg-mobile:h-6 tablet:w-7 tablet:h-7 text-gray-600 group-hover:text-emerald-600 transition-colors" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="sm-mobile:text-sm md-mobile:text-base lg-mobile:text-base tablet:text-lg font-semibold text-gray-900">Scan Instrument</p>
                      <p className="sm-mobile:text-xs md-mobile:text-sm lg-mobile:text-sm tablet:text-sm text-gray-500">Use AI to detect items</p>
                    </div>
                  </button>

                  {/* QR Code Scanner */}
                  <button
                    onClick={() => {
                      setShowScannerModal(false);
                      navigate("/scan");
                    }}
                    className="flex items-center gap-3 sm-mobile:p-3 md-mobile:p-4 lg-mobile:p-4 tablet:p-4 border-2 border-gray-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                  >
                    <div className="sm-mobile:w-10 sm-mobile:h-10 md-mobile:w-12 md-mobile:h-12 lg-mobile:w-12 lg-mobile:h-12 tablet:w-14 tablet:h-14 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                      <Smartphone className="sm-mobile:w-5 sm-mobile:h-5 md-mobile:w-6 md-mobile:h-6 lg-mobile:w-6 lg-mobile:h-6 tablet:w-7 tablet:h-7 text-gray-600 group-hover:text-emerald-600 transition-colors" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="sm-mobile:text-sm md-mobile:text-base lg-mobile:text-base tablet:text-lg font-semibold text-gray-900">QR Code Scanner</p>
                      <p className="sm-mobile:text-xs md-mobile:text-sm lg-mobile:text-sm tablet:text-sm text-gray-500">Scan item QR codes</p>
                    </div>
                  </button>


                </div>
              </div>
            </div>
          )}

          {/* Global Styles for Modal Animations */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .animate-fadeIn {
              animation: fadeIn 0.3s ease-out;
            }
            .animate-slideUp {
              animation: slideUp 0.3s ease;
            }
          `}</style>
        </>
      );
    }
  }

  // Updated header with reference design (green/gold theme)
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-300 ease-in-out">
        <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center leading-none text-[20px] font-black tracking-[-0.08em] sm:text-[22px]">
                <span className="text-[#004aad]">Du</span>
                <span className="text-[#ffbd59]">Bud</span>
                <span className="text-[#ff3131]">Ka</span>
              </div>

              <div className="relative mt-1" ref={divisionMenuRef}>
                <button
                  type="button"
                  onClick={() => setDivisionMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 text-left text-[11px] font-semibold text-slate-600 transition hover:text-slate-900 sm:text-xs"
                >
                  <span>{selectedDivision === "All" ? "ᜇᜓᜊᜓᜇ᜔ᜃ" : selectedDivision}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition ${divisionMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {divisionMenuOpen && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl transition-all duration-300 ease-out animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white">
                      {DIVISION_OPTIONS.map((option) => {
                        const active = selectedDivision === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setSelectedDivision(option);
                              setDivisionMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition ${active ? "bg-slate-100 font-bold text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}
                          >
                            <span>{option === "All" ? "All Divisions" : option}</span>
                            {active && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user && (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden md:block w-56 lg:w-72">
                  <GlobalSearchBar
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    onClear={() => setGlobalSearchQuery('')}
                    placeholder="Search"
                  />
                </div>

                {user?.role === "staff" && (
                  <div className="hidden sm:flex">
                    <NotificationBadge />
                  </div>
                )}

                {user && (user?.role === "staff" || user?.role === "admin") && (
                  <Link to="/staff-borrow-cart" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100" title="Staff Borrowing Cart">
                    <ShoppingCart className="h-4 w-4" />
                  </Link>
                )}

                <div
                  className="relative"
                  ref={profileDropdownRef}
                  onMouseEnter={() => setProfileHovered(true)}
                  onMouseLeave={() => setProfileHovered(false)}
                >
                  <button
                    onClick={() => setProfileDropdownOpen((prev) => !prev)}
                    className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                    title="Profile menu"
                  >
                    {profilePic ? (
                      <img alt={user?.name} className="h-full w-full object-cover" src={profilePic} />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </button>

                  {(profileDropdownOpen || profileHovered) && (
                    <div className="fixed right-3 top-20 z-[9999] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:right-4 md:right-6 lg:right-8">
                      <button
                        onClick={() => {
                          handleViewProfile();
                          setProfileDropdownOpen(false);
                          setProfileHovered(false);
                        }}
                        className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <User className="h-4 w-4" />
                        View Profile
                      </button>
                      <button
                        onClick={() => {
                          navigate("/settings");
                          setProfileDropdownOpen(false);
                          setProfileHovered(false);
                        }}
                        className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </button>
                      <button
                        onClick={() => {
                          handleLogout();
                          setProfileDropdownOpen(false);
                          setProfileHovered(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}