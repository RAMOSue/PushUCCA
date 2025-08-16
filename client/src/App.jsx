// client/src/App.jsx
import { Routes, Route } from "react-router-dom";
import { useContext } from "react";
import axios from "axios";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GetStarted from "./pages/GetStarted";
import AvailableItems from "./pages/AvailableItems";
import BorrowCart from "./pages/BorrowCart";
import ScanQR from "./pages/ScanQR";
import AdminUserManagement from "./pages/AdminUserManagement";
import DashboardStaff from "./pages/DashboardStaff";
import ManageBorrowRequests from "./pages/ManageBorrowRequests";
import ManageInventory from "./pages/ManageInventory";
import AdminReports from "./pages/AdminReports"; 
import ReturnItems from "./pages/ReturnItems"; // ✅ NEW RETURN ITEMS PAGE

import { UserContextProvider } from "../context/userContext";
import { BorrowingProvider } from "../context/BorrowingContext";
import { UserContext } from "../context/userContext";
import "./index.css";

// Axios config
axios.defaults.baseURL = "http://localhost:8000";
axios.defaults.withCredentials = true;

function AppContent() {
  const { user } = useContext(UserContext);

  return (
    <BorrowingProvider>
      <Navbar />
      <Toaster position="bottom-right" toastOptions={{ duration: 2000 }} />
      <Routes>
        <Route path="/" element={<GetStarted />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/available-items" element={<AvailableItems />} />
        <Route path="/manage-requests" element={<ManageBorrowRequests />} />

        {/* Staff-only pages */}
        <Route
          path="/staff/dashboard"
          element={
            user?.role === "staff" ? (
              <DashboardStaff />
            ) : (
              <div className="text-center mt-10 text-red-500 text-xl">
                ❌ Access Denied
              </div>
            )
          }
        />

        <Route
          path="/manage-inventory"
          element={
            user?.role === "staff" ? (
              <ManageInventory />
            ) : (
              <div className="text-center mt-10 text-red-500 text-xl">
                ❌ Access Denied
              </div>
            )
          }
        />

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

        {/* Admin-only Reports Page */}
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

        {/* ✅ NEW: Return Items Page (for staff & admin) */}
        <Route
          path="/return-items"
          element={
            user?.role === "staff" || user?.role === "admin" ? (
              <ReturnItems />
            ) : (
              <div className="text-center mt-10 text-red-500 text-xl">
                ❌ Access Denied
              </div>
            )
          }
        />
      </Routes>
    </BorrowingProvider>
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
