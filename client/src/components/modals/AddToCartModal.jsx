// src/components/AddToCartModal.jsx
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * AddToCartModal Component
 * Shows "✓ Added to cart" modal when user adds an item
 * Features:
 * - Dark rounded modal with check icon
 * - "Added to cart" text with item name
 * - "View Cart" button for quick navigation to appropriate cart (based on user role)
 * - Auto-closes after 2 seconds (or on button click)
 */
export default function AddToCartModal({ isOpen, onClose, itemName = "", userRole = "borrower" }) {
  const navigate = useNavigate();

  const handleViewCart = () => {
    onClose();
    // Route to appropriate cart based on user role
    if (userRole === "staff") {
      navigate("/staff-borrow-cart");
    } else if (userRole === "admin") {
      navigate("/staff-borrow-cart"); // Admin also uses staff borrow cart
    } else {
      navigate("/borrow-cart"); // Borrower cart
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />

          {/* Modal Container - Centered on all screen sizes */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
              className="pointer-events-auto"
            >
              <div className="bg-gray-800 px-3 xs:px-4 sm:px-6 md:px-8 py-3 xs:py-4 sm:py-5 md:py-6 rounded-xl xs:rounded-2xl shadow-2xl flex flex-col items-center gap-2 xs:gap-3 sm:gap-4 w-[280px] xs:w-[300px] sm:w-[340px] md:w-[380px] lg:w-[420px]">
              {/* Check Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, duration: 0.3, type: "spring" }}
              >
                <CheckCircle className="w-14 h-14 xs:w-16 xs:h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 text-white" strokeWidth={1.5} />
              </motion.div>

              {/* Text */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="text-center"
              >
                <p className="text-white text-base xs:text-lg sm:text-xl md:text-2xl lg:text-2xl font-bold">Added to cart</p>
                {itemName && (
                  <p className="text-gray-300 text-xs xs:text-sm sm:text-sm md:text-base lg:text-base mt-1 xs:mt-1.5 sm:mt-2 md:mt-2 line-clamp-2">
                    {itemName}
                  </p>
                )}
              </motion.div>

              {/* View Cart Button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                onClick={handleViewCart}
                className="mt-2 xs:mt-3 sm:mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 xs:py-2.5 sm:py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-xs xs:text-sm"
              >
                <ShoppingCart size={16} />
                <span>View Cart</span>
              </motion.button>
            </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
