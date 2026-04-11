// src/components/ImagePreviewModal.jsx
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";

export default function ImagePreviewModal({ isOpen, onClose, imageUrl, fileName = "Document" }) {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = fileName || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className={`fixed z-50 transition-all ${
              isMaximized
                ? "inset-0 flex items-center justify-center"
                : "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-h-[90vh] max-w-[90vw]"
            }`}
          >
            <div
              className={`bg-gray-900 rounded-lg overflow-hidden flex flex-col ${
                isMaximized ? "w-full h-full" : "max-w-2xl"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between bg-gray-800 px-4 py-3 border-b border-gray-700">
                <h3 className="text-white font-semibold text-sm sm:text-base truncate">
                  {fileName}
                </h3>
                <div className="flex items-center gap-2">
                  {/* Maximize Button */}
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-2 hover:bg-gray-700 rounded-lg transition text-gray-300 hover:text-white"
                    title={isMaximized ? "Exit fullscreen" : "Fullscreen"}
                  >
                    {isMaximized ? (
                      <Minimize2 size={18} />
                    ) : (
                      <Maximize2 size={18} />
                    )}
                  </button>

                  {/* Download Button */}
                  <button
                    onClick={handleDownload}
                    className="p-2 hover:bg-gray-700 rounded-lg transition text-gray-300 hover:text-white"
                    title="Download"
                  >
                    <Download size={18} />
                  </button>

                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-700 rounded-lg transition text-gray-300 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Image Container */}
              <div className={`bg-black flex items-center justify-center overflow-auto ${
                isMaximized ? "flex-1" : "max-h-[calc(90vh-60px)]"
              }`}>
                <img
                  src={imageUrl}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
