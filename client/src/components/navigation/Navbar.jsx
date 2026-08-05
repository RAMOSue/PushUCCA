import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext, useEffect, useState, useRef } from "react";
import { UserContext } from "../../../context/userContext";
import { BorrowingContext } from "../../../context/borrowingContext";
import { LoginModalContext } from "../../../context/LoginModalContext";
import { SidebarContext } from "../../context/SidebarContext";
import { useSidebarStore, DIVISION_OPTIONS } from "../../../context/sidebarStore";
import axios from "axios";
import tokenManager from "../../utils/tokenManager";
import { INACTIVITY_CONFIG } from "../../config/inactivityConfig";
import { Home, LogOut, Camera, BookOpen, ShoppingCart, Smartphone, X, User, ChevronDown, Settings, Search, Calendar, Menu, Bell } from "lucide-react";
import NotificationBadge from "../ui/NotificationBadge";
import { notificationService } from "../../services/notifications";
import Logo from "../../assets/Logo.png";

const PublicBrand = () => (
  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
    <img src={Logo} alt="CSU Logo" className="h-7 w-auto object-contain sm:h-9 md:h-10" />
    <div className="min-w-0 leading-tight">
      <p className="truncate text-[10px] font-semibold text-black sm:text-xs md:text-sm">Caraga State University</p>
      <p className="truncate text-[8px] font-medium text-black/80 sm:text-[10px] md:text-xs">University Center for Culture and the Arts</p>
    </div>
  </div>
);

function GlobalSearchBar({ value, onChange, onClear, placeholder = "Search", compact = false }) {
  return (
    <div className={`relative flex items-center h-full min-w-0 flex-1 ${compact ? 'max-w-[220px]' : 'max-w-xs'}`}>
      <Search className={`absolute left-3 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-500 dark:text-gray-400`} />
      <input
        className={`w-full ${compact ? 'h-8' : 'h-9'} rounded-lg border border-slate-200 bg-white pl-9 pr-9 ${compact ? 'text-sm' : 'text-sm'} text-slate-700 placeholder-slate-400 shadow-sm outline-none transition focus:border-[#FBBC38] focus:ring-2 focus:ring-[#FBBC38]/20 dark:border-slate-700 dark:bg-[#1f1f1f] dark:text-slate-100 dark:placeholder-slate-500`}
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
          <X className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
        </button>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, setUser, loading } = useContext(UserContext);
  const { cart } = useContext(BorrowingContext);
  const { openLoginModal } = useContext(LoginModalContext);
  const { sidebarOpen, setSidebarOpen, rightSidebarOpen, setRightSidebarOpen, isMobile } = useContext(SidebarContext);
  const { selectedDivision, setSelectedDivision, globalSearchQuery, setGlobalSearchQuery } = useSidebarStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [profileHovered, setProfileHovered] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [divisionMenuOpen, setDivisionMenuOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const divisionMenuRef = useRef(null);
  const pathnameRef = useRef(location.pathname);

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
    (route) => location.pathname === route || location.pathname.startsWith(route + "/")
  );
  const isBorrowerRoute = borrowerRoutes.some(
    (route) => location.pathname === route || location.pathname.startsWith(route + "/")
  );
  const showBorrowerBottomNav = user?.role === "borrower" && isBorrowerRoute && !isOnScannerPage;

  useEffect(() => {
    if (pathnameRef.current !== location.pathname) {
      setGlobalSearchQuery('');
    }
    pathnameRef.current = location.pathname;
  }, [location.pathname, setGlobalSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
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

  useEffect(() => {
    if (user) {
      const setupNotifications = async () => {
        const initialized = await notificationService.init();
        if (initialized && Notification.permission === "granted") {
          await notificationService.subscribe(user.id);
        }
      };
      setupNotifications();

      if (user?.profile_pic_url) {
        setProfilePic(user.profile_pic_url);
      }
    }
  }, [user]);

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
      await axios.post("/api/auth/logout");
    } catch (err) {
      console.error("Backend logout failed:", err?.message || err);
    } finally {
      tokenManager.clearAll();
      localStorage.removeItem(INACTIVITY_CONFIG.SESSION_KEY);
      setUser(null);
      navigate("/");
    }
  };

  const handleDivisionSelect = (option) => {
    setSelectedDivision(option);
    setDivisionMenuOpen(false);
  };

  const borrowerBottomNav = showBorrowerBottomNav ? (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1f1f1f] border-t border-gray-100 dark:border-[#2a2a2a] shadow-lg dark:shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-50 h-16 transition-colors duration-300">
      <div className="flex justify-around items-center sm-mobile:py-2 md-mobile:py-2.5 lg-mobile:py-3 tablet:py-4 gap-0.5">
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

        <button
          onClick={() => setShowScannerModal(true)}
          className="flex flex-col items-center justify-center relative sm-mobile:-mt-4 md-mobile:-mt-5 lg-mobile:-mt-5 tablet:-mt-6 mb-1 transition-transform duration-300 hover:scale-110 active:scale-95"
        >
          <div className="sm-mobile:w-12 sm-mobile:h-12 md-mobile:w-14 md-mobile:h-14 lg-mobile:w-14 lg-mobile:h-14 tablet:w-16 tablet:h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-blue-500 dark:to-blue-600 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-shadow">
            <Camera className="sm-mobile:w-6 sm-mobile:h-6 md-mobile:w-6 md-mobile:h-6 lg-mobile:w-7 lg-mobile:h-7 tablet:w-8 tablet:h-8 text-white" />
          </div>
          <span className="sm-mobile:text-[9px] md-mobile:text-[10px] lg-mobile:text-xs tablet:text-xs mt-1 font-medium text-gray-700 dark:text-gray-300">Scan</span>
        </button>

        <Link
          to="/performances"
          className={`flex flex-col items-center justify-center transition-all duration-300 relative ${
            location.pathname.includes("/performances")
              ? "text-emerald-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-blue-300"
          }`}
        >
          <div className="sm-mobile:p-2 md-mobile:p-2.5 lg-mobile:p-2.5 tablet:p-3 relative">
            <Calendar className="sm-mobile:w-5 sm-mobile:h-5 md-mobile:w-5 md-mobile:h-5 lg-mobile:w-6 lg-mobile:h-6 tablet:w-6 tablet:h-6" />
          </div>
          <span className="sm-mobile:text-[10px] md-mobile:text-[10px] lg-mobile:text-xs tablet:text-xs font-medium">Performances</span>
        </Link>

        <Link
          to="/profile"
          className={`flex flex-col items-center justify-center transition-all duration-300 ${
            location.pathname === "/profile"
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
  ) : null;

  const borrowerScannerModal = showScannerModal ? (
    <div className="lg:hidden fixed inset-0 bg-black bg-opacity-40 dark:bg-black/60 flex items-center justify-center z-[60] sm-mobile:p-3 md-mobile:p-4 lg-mobile:p-4 tablet:p-6 animate-fadeIn">
      <div className="bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-2xl dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] sm-mobile:p-4 md-mobile:p-6 lg-mobile:p-6 tablet:p-8 w-full sm-mobile:max-w-xs md-mobile:max-w-sm lg-mobile:max-w-md tablet:max-w-lg animate-slideUp transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="sm-mobile:text-lg md-mobile:text-xl lg-mobile:text-xl tablet:text-2xl font-bold text-gray-900 dark:text-white">Choose Scanner</h2>
          <button
            onClick={() => setShowScannerModal(false)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            <X className="sm-mobile:w-5 sm-mobile:h-5 md-mobile:w-6 md-mobile:h-6 lg-mobile:w-6 lg-mobile:h-6 tablet:w-6 tablet:h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
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
  ) : null;

  if (user?.role === "borrower" && isOnScannerPage) {
    return null;
  }

  if (loading) {
    return (
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-300 ease-in-out h-12 sm:h-14 md:h-16">
        <div className="flex h-full w-full items-center justify-between gap-2 px-2 py-2 sm:px-3 sm:py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <PublicBrand />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[#004aad]"></div>
            <span className="text-xs text-slate-500 sm:text-sm">Loading...</span>
          </div>
        </div>
      </header>
    );
  }

  if (!user) {
    return (
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-300 ease-in-out h-12 sm:h-14 md:h-16">
        <div className="flex h-full w-full items-center justify-between gap-2 px-2 py-2 sm:px-3 sm:py-3 md:px-6">
          <div className="flex min-w-0 items-center">
            <PublicBrand />
          </div>

          <button
            onClick={openLoginModal}
            className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-[#164f11] px-2.5 text-[10px] font-semibold text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0f3c0c] hover:shadow-md sm:h-9 sm:px-3 sm:text-xs md:h-11 md:px-5 md:text-sm"
          >
            Log In
          </button>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-300 ease-in-out h-12 sm:h-14 md:h-16">
        <div className="flex h-full items-center justify-between gap-2 px-2 py-2 sm:px-3 sm:py-3 md:px-6">
          <div className={`flex min-w-0 items-center gap-2 sm:gap-3`}>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center leading-none text-[15px] font-black tracking-[-0.08em] sm:text-[17px] md:text-[20px]">
                <span className="text-[#004aad]">Du</span>
                <span className="text-[#ffbd59]">Bud</span>
                <span className="text-[#ff3131]">Ka</span>
              </div>

              <div className="relative mt-1" ref={divisionMenuRef}>
                <button
                  type="button"
                  onClick={() => setDivisionMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1 text-left text-[9px] font-semibold text-slate-600 transition hover:text-slate-900 sm:text-[10px] md:text-xs"
                >
                  <span className="truncate">{selectedDivision === "All" ? "ᜇᜓᜊᜓᜇ᜔ᜃ" : selectedDivision}</span>
                  <ChevronDown className={`h-3 w-3 transition ${divisionMenuOpen ? "rotate-180" : ""}`} />
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
                            onClick={() => handleDivisionSelect(option)}
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

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
            <div className={`${isMobile ? 'block w-36 sm:w-44' : 'block w-24 sm:w-32 md:w-48 lg:w-72'}`}>
              <GlobalSearchBar
                compact={isMobile}
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                onClear={() => setGlobalSearchQuery('')}
                placeholder="Search"
              />
            </div>

            {(user?.role === "staff" || user?.role === "borrower") && (
              <div className="flex">
                <NotificationBadge isMobile={isMobile} />
              </div>
            )}

            {(user?.role === "staff" || user?.role === "admin") && (
              <Link to="/staff-borrow-cart" className={`${isMobile ? 'flex h-7 w-7 sm:h-8 sm:w-8' : 'flex h-8 w-8 sm:h-9 sm:w-9'} flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100`} title="Staff Borrowing Cart">
                <ShoppingCart className={`${isMobile ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'}`} />
              </Link>
            )}

            {user?.role === "borrower" && (
              <Link
                to="/borrow-cart"
                className={`${isMobile ? 'relative flex h-7 w-7 sm:h-8 sm:w-8' : 'relative flex h-8 w-8 sm:h-9 sm:w-9'} flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100`}
                title="Borrow Cart"
              >
                <ShoppingCart className={`${isMobile ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'}`} />
                {cart && cart.length > 0 && (
                  <span className={`absolute ${isMobile ? '-top-1 -right-1' : '-top-2 -right-2'} flex h-4 min-w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white sm:h-5 sm:w-auto sm:px-1`}>{cart.length}</span>
                )}
              </Link>
            )}

            <div
              className="relative flex-shrink-0"
              ref={profileDropdownRef}
              onMouseEnter={() => setProfileHovered(true)}
              onMouseLeave={() => setProfileHovered(false)}
            >
              <button
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className={`${isMobile ? 'flex h-7 w-7 sm:h-8 sm:w-8' : 'flex h-8 w-8 sm:h-9 sm:w-9'} items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100`}
                title="Profile menu"
              >
                {profilePic ? (
                  <img alt={user?.name} className="h-full w-full object-cover" src={profilePic} />
                ) : (
                  <User className={`${isMobile ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4'}`} />
                )}
              </button>

              {(profileDropdownOpen || profileHovered) && (
                <div className={`${isMobile ? 'fixed right-2 top-16 w-36' : 'fixed right-3 top-20 w-44 sm:right-4 md:right-6 lg:right-8'} z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl`}> 
                  <button
                    onClick={() => {
                      handleViewProfile();
                      setProfileDropdownOpen(false);
                      setProfileHovered(false);
                    }}
                    className={`flex w-full items-center gap-2 border-b border-slate-100 ${isMobile ? 'px-2 py-2 text-xs' : 'px-3 py-2.5 text-sm'} text-left text-slate-700 transition hover:bg-slate-50`}
                  >
                    <User className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
                    <span className="truncate">View Profile</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate("/settings");
                      setProfileDropdownOpen(false);
                      setProfileHovered(false);
                    }}
                    className={`flex w-full items-center gap-2 border-b border-slate-100 ${isMobile ? 'px-2 py-2 text-xs' : 'px-3 py-2.5 text-sm'} text-left text-slate-700 transition hover:bg-slate-50`}
                  >
                    <Settings className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
                    <span className="truncate">Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      handleLogout();
                      setProfileDropdownOpen(false);
                      setProfileHovered(false);
                    }}
                    className={`flex w-full items-center gap-2 ${isMobile ? 'px-2 py-2 text-xs' : 'px-3 py-2.5 text-sm'} text-left text-red-600 transition hover:bg-red-50`}
                  >
                    <LogOut className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
                    <span className="truncate">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {borrowerBottomNav}
      {borrowerScannerModal}
    </>
  );
}
