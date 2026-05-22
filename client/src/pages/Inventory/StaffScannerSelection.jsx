import React, { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { QrCode, Camera } from "lucide-react";
import { SidebarContext } from "../../context/SidebarContext";
import { UserContext } from "../../../context/userContext";

export default function StaffScannerSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSidebarOpen } = useContext(SidebarContext);
  const { user } = useContext(UserContext);

  // Check if currently in a staff scanner page
  const isInStaffScanner = location.pathname === "/staff/scan" || location.pathname === "/staff/scanner";
  
  // Hide scanner buttons on manage-inventory page
  const isManageInventory = location.pathname === "/staff/manage-inventory";
  if (isManageInventory) {
    return null;
  }

  const handleQRScannerClick = () => {
    if (isInStaffScanner) {
      // If in scanner, go back to staff dashboard and re-enable sidebars
      setSidebarOpen(true);
      navigate("/staff");
    } else {
      // Open QR scanner and close sidebars
      navigate("/staff/scan");
      setSidebarOpen(false);
    }
  };

  const handleInstrumentScannerClick = () => {
    if (isInStaffScanner) {
      // If in scanner, go back to staff dashboard and re-enable sidebars
      setSidebarOpen(true);
      navigate("/staff");
    } else {
      // Open instrument scanner and close sidebars
      navigate("/staff/scanner");
      setSidebarOpen(false);
    }
  };

  // Only show for staff role
  if (user?.role !== "staff") {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-4 z-50">
      {/* QR Code Scanner Button */}
      <button
        onClick={handleQRScannerClick}
        className={`group relative w-16 h-16 rounded-full text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-110 active:scale-95 ${
          location.pathname === "/staff/scan"
            ? "bg-gradient-to-br from-blue-700 to-blue-800 ring-2 ring-blue-400"
            : "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        }`}
        title={isInStaffScanner ? "Back to Staff Dashboard" : "QR Code Scanner - Scan barcodes and QR codes"}
      >
        <QrCode size={28} className="group-hover:scale-125 transition-transform" />
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-3 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {location.pathname === "/staff/scan" ? "Back to Dashboard" : "QR Scanner"}
          <div className="absolute top-full right-2 w-2 h-2 bg-gray-900 transform rotate-45" />
        </div>
      </button>

      {/* Instrument Scanner Button */}
      <button
        onClick={handleInstrumentScannerClick}
        className={`group relative w-16 h-16 rounded-full text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-110 active:scale-95 ${
          location.pathname === "/staff/scanner"
            ? "bg-gradient-to-br from-purple-700 to-purple-800 ring-2 ring-purple-400"
            : "bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
        }`}
        title={isInStaffScanner ? "Back to Staff Dashboard" : "AI Instrument Scanner - Detect by appearance"}
      >
        <Camera size={28} className="group-hover:scale-125 transition-transform" />
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-3 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {location.pathname === "/staff/scanner" ? "Back to Dashboard" : "AI Scanner"}
          <div className="absolute top-full right-2 w-2 h-2 bg-gray-900 transform rotate-45" />
        </div>
      </button>
    </div>
  );
}
