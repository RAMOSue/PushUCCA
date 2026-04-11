// client/src/App.jsx
import { Routes, Route } from "react-router-dom";
import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";

import Navbar from "./components/navigation/Navbar";
import SideNavbar from "./components/navigation/SideNavbar"; // ✅ Borrower sidebar
import RightNavbar from "./components/navigation/RightNavbar"; // ✅ Right navbar
import TestUserSwitcher from "./components/TestUserSwitcher"; // ✅ Multi-user testing
import Register from "./pages/Auth/Register";
import Login from "./pages/Auth/Login";
import VerifyEmail from "./pages/Auth/VerifyEmail";
import Dashboard from "./pages/Dashboard/Dashboard";
import GetStarted from "./pages/Home/GetStarted";
import AvailableItems from "./pages/Inventory/AvailableItems";
import BorrowCart from "./pages/Borrower/BorrowCart";
import StaffBorrowCart from "./pages/Staff/StaffBorrowCart";
import MyBorrowedItems from "./pages/Borrower/MyBorrowedItems";
import BorrowerHistory from "./pages/Borrower/BorrowerHistory";
import ScanQR from "./pages/Inventory/ScanQR";
import MusicInstrumentScanner from "./pages/Inventory/MusicInstrumentScanner";
import ScannerSelection from "./pages/Inventory/ScannerSelection";
import AdminUserManagement from "./pages/Admin/AdminUserManagement";
import DashboardStaff from "./pages/Dashboard/DashboardStaff";
import StaffSchedule from "./pages/Staff/StaffSchedule";
import DashboardAdmin from "./pages/Dashboard/DashboardAdmin";
import StaffBorrowTimeline from "./pages/Staff/StaffBorrowTimeline";
import ManageInventory from "./pages/Inventory/ManageInventory";
import AdminReports from "./pages/Admin/AdminReports";
import BorrowerProfiles from "./pages/Borrower/BorrowerProfiles";
import BorrowerProfileFacebook from "./pages/Borrower/BorrowerProfileFacebook"; // ✅ Facebook-style UI
import Settings from "./pages/Settings/Settings";
import StaffAdminProfileFacebook from "./pages/Staff/StaffAdminProfileFacebook"; // ✅ Facebook-style UI
import MasterList from "./pages/Staff/MasterList";
import StaffLayout from "./components/layout/StaffLayout"; // ✅ Staff layout shell
import BorrowerLayout from "./components/layout/BorrowerLayout"; // ✅ Borrower layout shell

import { UserContextProvider, UserContext } from "../context/userContext";
import { BorrowingProvider } from "../context/borrowingContext";
import { SidebarProvider } from "../context/SidebarContext";
import { LoginModalProvider } from "../context/LoginModalContext"; // ✅ Import login modal context
import { notificationService } from "./services/notifications"; // ✅ Import notification service
import { useInactivityTimeout } from "./hooks/useInactivityTimeout.jsx"; // ✅ Import inactivity hook
import "./index.css";

// ✅ Global axios configuration (supports both local and production)
const apiURL = import.meta.env.VITE_API_URL || "http://localhost:8000"
axios.defaults.baseURL = apiURL
axios.defaults.withCredentials = true;

function AppContent() {
  const { user, darkMode } = useContext(UserContext);

  // ✅ Initialize inactivity timeout monitoring
  useInactivityTimeout();


  // ✅ Automatically toggle Tailwind's dark mode globally
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // ✅ Initialize push notifications after user logs in
  useEffect(() => {
    const setupNotifications = async () => {
      if (user && user.id) {
        try {
          console.log("🔔 [App.jsx] Starting notification setup for user:", user.id);
          
          // Run diagnostics first
          console.log("🔔 [App.jsx] Running notification diagnostics...");
          const diagnostics = await notificationService.diagnoseNotifications();
          console.log("🔔 [App.jsx] Diagnostics complete:", diagnostics);
          
          const ok = await notificationService.init();
          console.log("🔔 [App.jsx] Service Worker init result:", ok);
          
          if (ok) {
            console.log("✅ [App.jsx] Service Worker initialized for user:", user.id);
            
            // Check if permission already granted from previous session
            if (Notification.permission === 'granted') {
              console.log("🔔 [App.jsx] Notification permission already granted from previous session");
              const subscribed = await notificationService.subscribe(user.id);
              if (subscribed) {
                console.log("✅ [App.jsx] Already subscribed, resuming notifications");
              }
            } else {
              console.log("🔔 [App.jsx] Notification permission not yet granted - user needs to click enable button");
            }
            
            // Run diagnostics again after setup
            setTimeout(async () => {
              console.log("🔔 [App.jsx] Running post-setup diagnostics...");
              const postDiagnostics = await notificationService.diagnoseNotifications();
              console.log("🔔 [App.jsx] Post-setup diagnostics:", postDiagnostics);
            }, 1000);
          } else {
            console.warn("⚠️ [App.jsx] Push notification setup skipped (unsupported or failed)");
          }
        } catch (error) {
          console.error("❌ [App.jsx] Notification setup error:", error);
        }
      }
    };
    setupNotifications();
  }, [user]);

  // Setup listener for push notifications received
  useEffect(() => {
    const handlePushReceived = (payload) => {
      try {
        console.log("🔔 [App.jsx] PUSH_RECEIVED message handled:", payload);
        // Optional: Show toast notification in app
        if (payload && payload.message) {
          toast.success(payload.message, { 
            duration: 5000,
            icon: '🔔'
          });
        }
      } catch (e) {
        console.error("Error handling push received:", e);
      }
    };

    // Set up the message listener
    notificationService.setupMessageListener(handlePushReceived);
    
    return () => {
      // Cleanup message listener on unmount
      notificationService.removeMessageListener();
    };
  }, []);

  // Handle notification click messages forwarded from the service worker
  const navigate = useNavigate();
  useEffect(() => {
    const handleClick = (payload) => {
      try {
        if (!payload) return;

        // Prefer explicit SPA path (payload.path) when provided
        if (payload.path) {
          navigate(payload.path);
          return;
        }

        // If payload.url is absolute and same-origin, navigate internally
        if (payload.url) {
          try {
            const parsed = new URL(payload.url);
            if (parsed.origin === window.location.origin) {
              navigate(parsed.pathname + parsed.search);
            } else {
              // External URL: perform full navigation
              window.location.href = payload.url;
            }
            return;
          } catch (parseErr) {
            // Not a valid absolute URL — fall back to treating as SPA path
            navigate(payload.url);
            return;
          }
        }

        // Fallback
        navigate('/');
      } catch (e) {
        // Fallback to full navigation
        window.location.href = payload?.url || '/';
      }
    };

    notificationService.setupClickListener(handleClick);
    return () => {
      // no cleanup for service worker message listeners currently
    };
  }, [navigate]);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode ? "bg-[#171717] text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <BorrowingProvider>
        <Navbar />
        
        {/* ✅ Show RightNavbar for all authenticated users (borrower, staff, admin) */}
        {user && (user?.role === "borrower" || user?.role === "staff" || user?.role === "admin") && (
          <RightNavbar />
        )}
        
        {/* ✅ Show left sidebar for borrower users */}
        {user?.role === "borrower" && (
          <SideNavbar role="borrower" />
        )}
        
        {/* ✅ Show floating scanner buttons for borrower users (always visible) */}
        {user?.role === "borrower" && (
          <ScannerSelection />
        )}

        {/* ✅ Test User Switcher - for multi-user testing */}
        <TestUserSwitcher />
        
        <Toaster position="bottom-right" toastOptions={{ duration: 2000 }} />

        <Routes>
          {/* ==============================
              PUBLIC ROUTES
          ============================== */}
          <Route path="/" element={<GetStarted />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* ==============================
              BORROWER ROUTES
          ============================== */}
          <Route path="/available-items" element={<AvailableItems />} />

          <Route
            path="/borrow-cart"
            element={
              user?.role === "borrower" ? (
                <BorrowCart />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          {/* ✅ Staff Borrow Cart */}
          <Route
            path="/staff-borrow-cart"
            element={
              user?.role === "staff" ? (
                <StaffBorrowCart />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          {/* ✅ Borrowed Items Page */}
          <Route
            path="/my-borrowed-items"
            element={
              user?.role === "borrower" ? (
                <MyBorrowedItems />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          {/* ✅ Dedicated Borrower History page */}
          <Route
            path="/borrow-history"
            element={
              user?.role === "borrower" ? (
                <BorrowerHistory />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          <Route
            path="/scan"
            element={
              user?.role === "borrower" ? (
                <ScanQR />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          {/* ✅ NEW: Musical Instrument Image Scanner */}
          <Route
            path="/scanner"
            element={
              user?.role === "borrower" ? (
                <MusicInstrumentScanner />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          {/* ✅ SETTINGS ROUTE */}
          <Route
            path="/settings"
            element={
              user ? (
                <Settings />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Please log in to access Settings
                </div>
              )
            }
          />

          {/* ✅ BORROWER PROFILE ROUTES */}
          <Route
            path="/profile"
            element={
              user?.role === "borrower" ? (
                <BorrowerProfileFacebook />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />



          {/* ==============================
              STAFF DASHBOARD (NESTED)
          ============================== */}
          <Route
            path="/staff"
            element={
              user?.role === "staff" ? (
                <StaffLayout />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          >
            {/* 🟢 Default staff dashboard home (welcome + tiles) */}
            <Route index element={<DashboardStaff />} />

            {/* Other nested staff pages */}
            <Route path="manage-requests" element={<StaffBorrowTimeline />} />
            <Route path="return-items" element={<StaffBorrowTimeline />} />
            <Route path="available-items" element={<AvailableItems />} />
            <Route path="schedule" element={<StaffSchedule />} />
            <Route path="manage-inventory" element={<ManageInventory />} />
            <Route path="borrower-profiles" element={<BorrowerProfiles />} />
            <Route path="master-list" element={<MasterList />} />
            <Route path="profile" element={<StaffAdminProfileFacebook />} />
          </Route>

          {/* ==============================
              ADMIN ROUTES (NESTED)
          ============================== */}
          <Route
            path="/admin"
            element={
              user?.role === "admin" ? (
                <DashboardAdmin />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          >
            {/* 🟢 Default redirect to available-items */}
            <Route
              index
              element={<AvailableItems />}
            />

            {/* Admin nested pages */}
            <Route path="available-items" element={<AvailableItems />} />
            <Route path="manage-requests" element={<StaffBorrowTimeline />} />
            <Route path="return-items" element={<StaffBorrowTimeline />} />
            <Route path="manage-inventory" element={<ManageInventory />} />
            <Route path="users" element={<AdminUserManagement />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="profile" element={<StaffAdminProfileFacebook />} />
          </Route>
        </Routes>
      </BorrowingProvider>
    </div>
  );
}

function App() {
  return (
    <UserContextProvider>
      <LoginModalProvider>
        <SidebarProvider>
          <AppContent />
        </SidebarProvider>
      </LoginModalProvider>
    </UserContextProvider>
  );
}

export default App;
