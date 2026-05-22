import React, { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { QrCode, Camera } from "lucide-react";
import { SidebarContext } from "../../context/SidebarContext";

export default function ScannerSelection() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSidebarOpen } = useContext(SidebarContext);

  // Check if currently in a scanner page
  const isInScanner = location.pathname === "/scan" || location.pathname === "/scanner";

  const handleQRScannerClick = () => {
    if (isInScanner) {
      // If in scanner, go back to previous page and re-enable sidebars
      setSidebarOpen(true);
      navigate(-1);
    } else {
      // Open QR scanner and close sidebars
      navigate("/scan");
      setSidebarOpen(false);
    }
  };

  const handleInstrumentScannerClick = () => {
    if (isInScanner) {
      // If in scanner, go back to previous page and re-enable sidebars
      setSidebarOpen(true);
      navigate(-1);
    } else {
      // Open instrument scanner and close sidebars
      navigate("/scanner");
      setSidebarOpen(false);
    }
  };

  return (
    <div className="hidden md:flex fixed bottom-6 right-6 flex-col gap-4 z-50">
      {/* QR Code Scanner Button */}
      <button
        onClick={handleQRScannerClick}
        className={`group relative w-16 h-16 rounded-full text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-110 active:scale-95 ${
          location.pathname === "/scan"
            ? "bg-gradient-to-br from-blue-700 to-blue-800 ring-2 ring-blue-400"
            : "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        }`}
        title={isInScanner ? "Exit Scanner" : "QR Code Scanner - Scan barcodes and QR codes"}
      >
        <QrCode size={28} className="group-hover:scale-125 transition-transform" />
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-3 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {location.pathname === "/scan" ? "Exit Scanner" : "QR Scanner"}
          <div className="absolute top-full right-2 w-2 h-2 bg-gray-900 transform rotate-45" />
        </div>
      </button>

      {/* Instrument Scanner Button */}
      <button
        onClick={handleInstrumentScannerClick}
        className={`group relative w-16 h-16 rounded-full text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-110 active:scale-95 ${
          location.pathname === "/scanner"
            ? "bg-gradient-to-br from-purple-700 to-purple-800 ring-2 ring-purple-400"
            : "bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
        }`}
        title={isInScanner ? "Exit Scanner" : "AI Instrument Scanner - Detect by appearance"}
      >
        <Camera size={28} className="group-hover:scale-125 transition-transform" />
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-3 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {location.pathname === "/scanner" ? "Exit Scanner" : "AI Scanner"}
          <div className="absolute top-full right-2 w-2 h-2 bg-gray-900 transform rotate-45" />
        </div>
      </button>
    </div>
  );
}
