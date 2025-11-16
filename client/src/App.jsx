// client/src/App.jsx
import { Routes, Route } from "react-router-dom";
import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GetStarted from "./pages/GetStarted";
import AvailableItems from "./pages/AvailableItems";
import BorrowCart from "./pages/BorrowCart";
import MyBorrowedItems from "./pages/MyBorrowedItems"; // ✅ Newly added page
import BorrowerHistory from "./pages/BorrowerHistory"; // ✅ New dedicated borrow history page
import PersonalInformation from "./pages/PersonalInformation"; // ✅ Personal Information page
import ScanQR from "./pages/ScanQR";
import MusicInstrumentScanner from "./pages/MusicInstrumentScanner"; // ✅ New image scanner
import AdminUserManagement from "./pages/AdminUserManagement";
import DashboardStaff from "./pages/DashboardStaff";
import StaffSchedule from "./pages/StaffSchedule";
import DashboardAdmin from "./pages/DashboardAdmin";
import ManageBorrowRequests from "./pages/ManageBorrowRequests";
import ManageInventory from "./pages/ManageInventory";
import AdminReports from "./pages/AdminReports";
import ReturnItems from "./pages/ReturnItems";
import BorrowerProfiles from "./pages/BorrowerProfiles";
import Settings from "./pages/Settings"; // ✅ Settings page

import { UserContextProvider, UserContext } from "../context/userContext";
import { BorrowingProvider } from "../context/borrowingContext";
import { notificationService } from "./services/notifications"; // ✅ Import notification service
import "./index.css";

// ✅ Global axios configuration
axios.defaults.baseURL = "http://localhost:8000";
axios.defaults.withCredentials = true;

function AppContent() {
  const { user, isDarkMode } = useContext(UserContext);

  // ✅ Automatically toggle Tailwind’s dark mode globally
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // ✅ Initialize push notifications after user logs in
  useEffect(() => {
    const setupNotifications = async () => {
      if (user && user.id) {
        try {
          console.log("🔔 [App.jsx] Starting notification setup for user:", user.id);
          
          const ok = await notificationService.init();
          console.log("🔔 [App.jsx] Service Worker init result:", ok);
          
          if (ok) {
            // Always request permission (will show prompt if not granted)
            const permissionGranted = await notificationService.requestPermission(user.id);
            console.log("🔔 [App.jsx] Permission granted:", permissionGranted);
            
            if (permissionGranted) {
              console.log("✅ Push notifications initialized for user:", user.id);
            } else {
              console.warn("⚠️ Push notifications permission not granted");
            }
          } else {
            console.warn("⚠️ Push notification setup skipped (unsupported or failed)");
          }
        } catch (error) {
          console.error("❌ Notification setup error:", error);
        }
      }
    };
    setupNotifications();
  }, [user]);

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
        isDarkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <BorrowingProvider>
        <Navbar />
        <Toaster position="bottom-right" toastOptions={{ duration: 2000 }} />

        <Routes>
          {/* ==============================
              PUBLIC ROUTES
          ============================== */}
          <Route path="/" element={<GetStarted />} />
          <Route path="/register" element={<Register />} />
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

          {/* ✅ Personal Information page */}
          <Route
            path="/personal-information"
            element={
              user?.role === "borrower" ? (
                <PersonalInformation />
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

          {/* ==============================
              STAFF DASHBOARD (NESTED)
          ============================== */}
          <Route
            path="/staff"
            element={
              user?.role === "staff" ? (
                <DashboardStaff />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          >
            {/* 🟢 Default dashboard welcome screen */}
            <Route
              index
              element={
                <div className="p-10 text-center text-purple-400">
                  <h1 className="text-3xl font-bold mb-2">
                    Welcome to the Staff Dashboard!
                  </h1>
                  <p className="text-gray-400">
                    Use the menu on the left to manage requests, inventory, and borrower profiles.
                  </p>
                </div>
              }
            />

            {/* Other nested staff pages */}
            <Route path="manage-requests" element={<ManageBorrowRequests />} />
            <Route path="return-items" element={<ReturnItems />} />
            <Route path="available-items" element={<AvailableItems />} />
            <Route path="schedule" element={<StaffSchedule />} />
            <Route path="manage-inventory" element={<ManageInventory />} />
            <Route path="borrower-profiles" element={<BorrowerProfiles />} />
          </Route>

          {/* ==============================
              ADMIN ROUTES
          ============================== */}
          <Route
            path="/admin/dashboard"
            element={
              user?.role === "admin" ? (
                <DashboardAdmin />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          <Route
            path="/admin/users"
            element={
              user?.role === "admin" ? (
                <AdminUserManagement />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          <Route
            path="/admin/reports"
            element={
              user?.role === "admin" ? (
                <AdminReports />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          {/* ✅ Admin can also access these management pages */}
          <Route
            path="/admin/manage-requests"
            element={
              user?.role === "admin" ? (
                <ManageBorrowRequests />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          <Route
            path="/admin/return-items"
            element={
              user?.role === "admin" ? (
                <ReturnItems />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          <Route
            path="/admin/manage-inventory"
            element={
              user?.role === "admin" ? (
                <ManageInventory />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />

          <Route
            path="/admin/available-items"
            element={
              user?.role === "admin" ? (
                <AvailableItems />
              ) : (
                <div className="text-center mt-10 text-red-500 text-xl">
                  ❌ Access Denied
                </div>
              )
            }
          />
        </Routes>
      </BorrowingProvider>
    </div>
  );
}

function App() {
  return (
    <UserContextProvider>
      <AppContent />
    </UserContextProvider>
  );
}

export default App;
