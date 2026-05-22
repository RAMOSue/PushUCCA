import React, { useContext, useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { BorrowingContext } from "../../../context/borrowingContext";
import { UserContext } from "../../../context/userContext";
import BorrowPhotoCaptureModal from "../../components/modals/BorrowPhotoCaptureModal";
import PageLayout from "../../components/layout/PageLayout";
import { Trash2, ArrowLeft, Calendar, ShoppingBag, Minus, Plus, Package } from "lucide-react";

export default function BorrowCart() {
  const { cart, setCart, removeFromCart, submitBorrowRequest, requestId, refreshAvailableItemsFromServer, saveCartQuantity, unreserveUnits, addToCart } = useContext(BorrowingContext);
  const { user, loading } = useContext(UserContext);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false);
  const [tempUnitCounter, setTempUnitCounter] = useState(0);

  // Redirect non-borrowers to their appropriate page
  useEffect(() => {
    if (!loading && user && user.role !== 'borrower') {
      if (user.role === 'staff') {
        navigate('/staff-borrow-cart');
      } else {
        navigate('/available-items');
      }
    }
  }, [loading, user, navigate]);

  // ✅ PERSIST: Load cart state from localStorage on mount and restore to context
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("borrow_cart");
      if (savedCart && cart.length === 0) {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
        console.log(`📦 Restored cart from localStorage with ${parsedCart.length} units:`, parsedCart);
      }
    } catch (error) {
      console.error("Error loading cart from localStorage:", error);
    }
  }, []);

  // ✅ PERSIST: Watch for cart changes and save to localStorage + backend
  useEffect(() => {
    console.log(`💾 Saving cart to localStorage:`, cart);
    localStorage.setItem("borrow_cart", JSON.stringify(cart));
    
    // ✅ BACKEND: Save quantity to database ONLY if a reserved request exists (debounced)
    const timer = setTimeout(() => {
      if (cart.length > 0 && user?.id && requestId) {
        console.log(`📤 Syncing cart quantity to backend:`, cart.length);
        saveCartQuantity(cart);
      } else if (cart.length > 0 && user?.id && !requestId) {
        console.log(`⏭️ Skipping backend sync - no reserved request yet (cart building)`);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [cart, user?.id, requestId]);

  // Consolidate items by name, showing unit count
  const consolidatedCart = cart.reduce((acc, item) => {
    const existing = acc.find(
      (i) => i.name === item.name && i.category === item.category && i.size === item.size
    );
    if (existing) {
      existing.count += 1;
      existing.units.push(item);
    } else {
      acc.push({
        ...item,
        count: 1,
        units: [item],
      });
    }
    return acc;
  }, []);

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setSubmitting(true);
    try {
      // ✅ FIX: Pass object with skipNavigation property, not boolean
      const result = await submitBorrowRequest({ skipNavigation: true });
      if (result?.request_id) {
        setCurrentRequestId(result.request_id);
      } else if (requestId) {
        setCurrentRequestId(requestId);
      }
      // Refresh available items after successful submission
      await refreshAvailableItemsFromServer();
      // Open camera modal after successful submission
      setPhotoCaptureOpen(true);
      setSubmitting(false);
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Failed to submit request. Please try again.");
      setSubmitting(false);
    }
  };

  const handlePhotosCaptured = (photos) => {
    toast.success(`✅ ${photos.length} photo(s) captured successfully!`);
    // Navigate after photos are captured
    navigate("/my-borrowed-items");
  };

  const handlePhotosSkipped = () => {
    // Allow user to skip photos if needed
    navigate("/my-borrowed-items");
  };

  // ✅ IMPROVED: Update quantity in cart via BACKEND for real persistence
  const handleQuantityChange = (itemKey, newQuantity) => {
    // Prevent multiple clicks while operation is in progress
    if (isUpdatingQuantity) return;
    
    setIsUpdatingQuantity(true);
    
    const releaseGuard = () => {
      setTimeout(() => setIsUpdatingQuantity(false), 0);
    };
    
    try {
      // ✅ CRITICAL: Use functional setState to always read current state
      setCart(prevCart => {
        const itemsForKey = prevCart.filter(unit => 
          unit.name === itemKey.name && unit.category === itemKey.category && unit.size === itemKey.size
        );
        const currentCount = itemsForKey.length;
        
        if (newQuantity <= 0) {
          // ✅ DELETE: Remove all items of this type
          console.log(`🗑️ Removing all units of ${itemKey.name}`);
          toast.success("Item removed from cart");
          const updated = prevCart.filter(unit => 
            !(unit.name === itemKey.name && unit.category === itemKey.category && unit.size === itemKey.size)
          );
          // ✅ PERSIST: Cart will auto-save via useEffect
          return updated;
        } else if (newQuantity > currentCount) {
          // ✅ INCREASE: Add more units to cart
          const diff = newQuantity - currentCount;
          
          // Separate real and temporary units to know how many real units we have
          const realUnits = itemsForKey.filter(u => !u.unitId?.startsWith('temp-'));
          const tempUnits = itemsForKey.filter(u => u.unitId?.startsWith('temp-'));
          
          // If we only have real units from database, create new temp units for additional quantity
          if (realUnits.length === currentCount && tempUnits.length === 0) {
            const newUnits = [];
            
            // Generate proper unit_number for each new temporary unit (works for both sized & no-size)
            const generateUnitNumber = (baseItem, sequenceNum) => {
              if (baseItem.size && baseItem.size !== "nosize") {
                const sizeAbbrv = {"small": "S", "medium": "M", "large": "L"}[baseItem.size.toLowerCase()] || baseItem.size.toUpperCase();
                return `${baseItem.name}-${sizeAbbrv}-${sequenceNum}`;
              } else {
                return `${baseItem.name}-${sequenceNum}`;
              }
            };
            
            // Create new unit objects to add to cart with UNIQUE ids and proper unit_numbers
            for (let i = 0; i < diff; i++) {
              const currentSequence = currentCount + i + 1; // Sequence number for label
              const uniqueId = `temp-${itemsForKey[0].itemId}-${Date.now()}-${tempUnitCounter + i}`;
              newUnits.push({
                ...itemsForKey[0],
                unitId: uniqueId,
                id: uniqueId,
                unit_number: generateUnitNumber(itemsForKey[0], currentSequence), // ✅ Generate proper label
              });
            }
            
            // Update counter for next batch of temporary units
            setTempUnitCounter(prev => prev + diff);
            
            console.log(`➕ Added ${diff} unit(s) to ${itemKey.name}, new quantity: ${newQuantity}`);
            toast.success(`Added ${diff} unit(s) to cart`);
            const updated = [...prevCart, ...newUnits];
            // ✅ PERSIST: Cart will auto-save via useEffect
            return updated;
          } else {
            // Mixed real and temp units, just add more temp units
            const newUnits = [];
            const generateUnitNumber = (baseItem, sequenceNum) => {
              if (baseItem.size && baseItem.size !== "nosize") {
                const sizeAbbrv = {"small": "S", "medium": "M", "large": "L"}[baseItem.size.toLowerCase()] || baseItem.size.toUpperCase();
                return `${baseItem.name}-${sizeAbbrv}-${sequenceNum}`;
              } else {
                return `${baseItem.name}-${sequenceNum}`;
              }
            };
            
            for (let i = 0; i < diff; i++) {
              const currentSequence = currentCount + i + 1;
              const uniqueId = `temp-${itemsForKey[0].itemId}-${Date.now()}-${tempUnitCounter + i}`;
              newUnits.push({
                ...itemsForKey[0],
                unitId: uniqueId,
                id: uniqueId,
                unit_number: generateUnitNumber(itemsForKey[0], currentSequence),
              });
            }
            
            setTempUnitCounter(prev => prev + diff);
            console.log(`➕ Added ${diff} unit(s) to ${itemKey.name}, new quantity: ${newQuantity}`);
            toast.success(`Added ${diff} unit(s) to cart`);
            return [...prevCart, ...newUnits];
          }
        } else if (newQuantity < currentCount) {
          // ✅ DECREASE: Keep EXACTLY newQuantity items (LOCAL ONLY)
          let keptCount = 0;
          const updatedCart = prevCart.filter(unit => {
            // Keep all non-matching items
            if (unit.name !== itemKey.name || unit.category !== itemKey.category || unit.size !== itemKey.size) {
              return true;
            }
            
            // For matching items, keep only up to newQuantity
            if (keptCount < newQuantity) {
              keptCount++;
              return true; // Keep this item
            }
            return false; // Remove this item
          });
          
          console.log(`➖ Decreased ${itemKey.name} to quantity: ${newQuantity}`);
          toast.success(`Quantity updated to ${newQuantity}`);
          // ✅ PERSIST: Cart will auto-save via useEffect
          return updatedCart;
        } else {
          // newQuantity === currentCount, no change
          return prevCart;
        }
      });
      
      releaseGuard();
    } catch (error) {
      console.error("Error updating quantity:", error);
      toast.error("Error updating quantity");
      releaseGuard();
    }
  };

  const handleIncreaseQuantity = (itemKey) => {
    // ✅ FIX: Check guard before proceeding
    if (isUpdatingQuantity) return;
    
    setIsUpdatingQuantity(true);
    
    const releaseGuard = () => {
      setTimeout(() => setIsUpdatingQuantity(false), 0);
    };
    
    try {
      // ✅ CRITICAL: Read current state inside functional setState, not from closure
      setCart(prevCart => {
        const currentCount = prevCart.filter(unit => 
          unit.name === itemKey.name && unit.category === itemKey.category && unit.size === itemKey.size
        ).length;
        
        const newQuantity = currentCount + 1;
        const itemsForKey = prevCart.filter(unit => 
          unit.name === itemKey.name && unit.category === itemKey.category && unit.size === itemKey.size
        );
        
        if (itemsForKey.length === 0) {
          return prevCart;
        }
        
        // ✅ Generate proper unit_number for the new temporary unit (works for both sized & no-size)
        const generateUnitNumber = (baseItem, sequenceNum) => {
          if (baseItem.size && baseItem.size !== "nosize") {
            const sizeAbbrv = {"small": "S", "medium": "M", "large": "L"}[baseItem.size.toLowerCase()] || baseItem.size.toUpperCase();
            return `${baseItem.name}-${sizeAbbrv}-${sequenceNum}`;
          } else {
            return `${baseItem.name}-${sequenceNum}`;
          }
        };
        
        // ✅ FIXED: Create new temporary unit with UNIQUE id and proper unit_number
        const uniqueId = `temp-${itemsForKey[0].itemId}-${Date.now()}-${tempUnitCounter}`;
        const newUnit = {
          ...itemsForKey[0],
          unitId: uniqueId,
          id: uniqueId,
          unit_number: generateUnitNumber(itemsForKey[0], newQuantity), // ✅ Generate label with sequence
        };
        
        // Increment counter for next temporary unit
        setTempUnitCounter(prev => prev + 1);
        
        console.log(`➕ Increased ${itemKey.name} to quantity: ${newQuantity}`);
        toast.success(`Added 1 unit to cart`);
        // ✅ PERSIST: Cart will auto-save via useEffect
        return [...prevCart, newUnit];
      });
      
      releaseGuard();
    } catch (error) {
      console.error("Error increasing quantity:", error);
      toast.error("Error increasing quantity");
      releaseGuard();
    }
  };

  const handleDecreaseQuantity = (itemKey) => {
    // ✅ FIX: Check guard before proceeding
    if (isUpdatingQuantity) return;
    
    setIsUpdatingQuantity(true);
    
    const releaseGuard = () => {
      setTimeout(() => setIsUpdatingQuantity(false), 0);
    };
    
    try {
      // ✅ CRITICAL: Read current state inside functional setState, not from closure
      setCart(prevCart => {
        const itemsForKey = prevCart.filter(unit => 
          unit.name === itemKey.name && unit.category === itemKey.category && unit.size === itemKey.size
        );
        const currentCount = itemsForKey.length;
        
        if (currentCount <= 0) {
          return prevCart; // Nothing to decrease
        }
        
        const newQuantity = currentCount - 1;
        
        if (newQuantity <= 0) {
          // ✅ DELETE: Remove all items of this type
          console.log(`🗑️ Removed all units of ${itemKey.name}`);
          toast.success("Item removed from cart");
          const updated = prevCart.filter(unit => 
            !(unit.name === itemKey.name && unit.category === itemKey.category && unit.size === itemKey.size)
          );
          // ✅ PERSIST: Cart will auto-save via useEffect
          return updated;
        } else {
          // ✅ DECREASE: Keep EXACTLY newQuantity items
          let keptCount = 0;
          const updatedCart = prevCart.filter(unit => {
            // Keep all non-matching items
            if (unit.name !== itemKey.name || unit.category !== itemKey.category || unit.size !== itemKey.size) {
              return true;
            }
            
            // For matching items, keep only up to newQuantity
            if (keptCount < newQuantity) {
              keptCount++;
              return true; // Keep this item
            }
            return false; // Remove this item
          });
          
          console.log(`➖ Decreased ${itemKey.name} to quantity: ${newQuantity}`);
          toast.success(`Quantity updated to ${newQuantity}`);
          // ✅ PERSIST: Cart will auto-save via useEffect
          return updatedCart;
        }
      });
      
      releaseGuard();
    } catch (error) {
      console.error("Error decreasing quantity:", error);
      toast.error("Error decreasing quantity");
      releaseGuard();
    }
  };

  // Handle deleting entire item row (all units of that type) - WITH UNRESERVE
  const handleDeleteItem = async (itemKey) => {
    const removedItems = cart.filter(unit => 
      unit.name === itemKey.name && unit.category === itemKey.category && unit.size === itemKey.size
    );
    
    if (removedItems.length === 0) {
      toast.error("Item not found in cart");
      return;
    }

    try {
      // Collect all unit IDs to unreserve
      const unitIds = removedItems.map(item => item.unitId).filter(Boolean);
      
      if (unitIds.length === 0) {
        // No real units to unreserve (only temporary units) - just remove from cart
        setCart(cart.filter(unit => 
          !(unit.name === itemKey.name && unit.category === itemKey.category && unit.size === itemKey.size)
        ));
        console.log(`🗑️ Removed ${removedItems.length} temporary ${itemKey.name}(s) from cart`);
        toast.success(`Removed ${removedItems.length} ${itemKey.name}(s) from cart`);
        return;
      }

      // Call unreserveUnits to restore units in backend and refresh available items
      const success = await unreserveUnits(unitIds);
      
      if (success) {
        // Update local cart state - ✅ PERSIST: Cart will auto-save via useEffect
        setCart(cart.filter(unit => 
          !(unit.name === itemKey.name && unit.category === itemKey.category && unit.size === itemKey.size)
        ));
        
        console.log(`🗑️ Removed ${removedItems.length} ${itemKey.name}(s) from cart - units restored to available`);
        toast.success(`Removed ${removedItems.length} ${itemKey.name}(s) from cart - units restored to available`);
      } else {
        toast.error("Failed to delete item - please try again");
      }
    } catch (err) {
      console.error("❌ handleDeleteItem error:", err.message);
      toast.error("Error deleting item. Please try again.");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <PageLayout>
      <div className="dark:bg-[#171717]">
        {/* Camera Capture Modal */}
        <BorrowPhotoCaptureModal
          isOpen={photoCaptureOpen}
          requestId={currentRequestId || requestId}
          onClose={() => {
            setPhotoCaptureOpen(false);
            handlePhotosSkipped();
          }}
          onPhotosCaptured={handlePhotosCaptured}
          itemCount={cart.length}
          addToCart={addToCart}
          borrowerId={user?.id}
        />

        {/* ========== Header Section ========== */}
        <div className="px-3 sm:px-6 md:px-8 lg:px-12 pt-4 sm:pt-8 pb-4 sm:pb-6 dark:bg-[#171717]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
            {/* Left Side - Title */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-1 sm:mb-2">Borrowing Cart</h1>
              <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400">Review items before submitting</p>
            </div>

            {/* Right Side - Summary Pills */}
            <div className="flex gap-2 sm:gap-3 flex-wrap items-center justify-start sm:justify-end">
              <div className="px-2.5 sm:px-4 py-1 sm:py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-xs sm:text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Units: <span className="font-bold text-primary dark:text-blue-400">{cart.length}</span>
              </div>
              <div className="px-2.5 sm:px-4 py-1 sm:py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-xs sm:text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Items: <span className="font-bold text-primary dark:text-blue-400">{consolidatedCart.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========== Main Content Area ========== */}
        <div className="px-3 sm:px-6 md:px-8 lg:px-12 space-y-3 sm:space-y-4 dark:bg-[#171717] pb-24 sm:pb-20">

          {/* Empty Cart State */}
          {cart.length === 0 ? (
            <div className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-lg sm:rounded-2xl shadow-sm border border-outline-variant/10 dark:border-gray-700 p-6 sm:p-8 md:p-12 text-center">
              <ShoppingBag className="w-8 h-8 sm:w-12 sm:h-12 text-on-surface-variant/30 dark:text-gray-600 mx-auto mb-3 sm:mb-4" />
              <p className="text-on-surface-variant dark:text-gray-400 text-sm sm:text-base md:text-lg mb-4 sm:mb-6">Your cart is empty</p>
              <button
                onClick={() => navigate('/available-items')}
                className="px-4 sm:px-6 py-1.5 sm:py-2 bg-primary dark:bg-blue-600 hover:bg-primary/90 dark:hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-xs sm:text-base"
              >
                Continue to Borrow
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4">
              {/* Cart Items */}
              <div className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-lg sm:rounded-2xl shadow-sm border border-outline-variant/10 dark:border-gray-700 overflow-hidden">
                {/* Header */}
                <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 border-b border-outline-variant/10 dark:border-gray-700 bg-surface-container-lowest dark:bg-[#222]">
                  <p className="font-semibold text-xs sm:text-sm md:text-base text-on-surface dark:text-white">
                    Units ({cart.length}) • {consolidatedCart.length} Item{consolidatedCart.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Items List */}
                <div className="divide-y divide-outline-variant/10 dark:divide-gray-700">
                  {consolidatedCart.map((item, index) => (
                    <div
                      key={index}
                      className="px-2.5 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a] transition-colors"
                    >
                      {/* Item Header */}
                      <div className="flex items-start sm:items-center justify-between gap-2 mb-2 sm:mb-3">
                        {/* Image Circle */}
                        <div className="w-12 sm:w-14 md:w-16 h-12 sm:h-14 md:h-16 flex-shrink-0 rounded-full overflow-hidden border border-outline-variant/20 dark:border-gray-700">
                          {item.image_url ? (
                            <img
                              src={item.image_url?.startsWith('http') ? item.image_url : `http://localhost:8000${item.image_url}`}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                              <Package className="w-5 sm:w-6 md:w-7 h-5 sm:h-6 md:h-7 text-gray-400 dark:text-gray-600" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="font-medium text-on-surface dark:text-white text-xs sm:text-sm truncate">
                              {item.name}
                            </p>
                            {item.size && item.size !== "nosize" && (
                              <span className="text-xs text-on-surface-variant dark:text-gray-400">
                                ({item.size})
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-on-surface-variant dark:text-gray-400 mt-0.5 sm:mt-1 capitalize">
                            {item.category}
                          </p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                          <button
                            onClick={() =>
                              handleDecreaseQuantity({
                                name: item.name,
                                category: item.category,
                                size: item.size,
                              })
                            }
                            disabled={isUpdatingQuantity}
                            className="p-1 text-on-surface-variant dark:text-gray-400 hover:bg-surface-container-high dark:hover:bg-[#333] rounded-md transition-colors disabled:opacity-50"
                          >
                            <Minus size={12} className="sm:hidden" />
                            <Minus size={14} className="hidden sm:block" />
                          </button>

                          <div className="w-8 sm:w-10">
                            <input
                              type="number"
                              min="1"
                              value={item.count}
                              onChange={(e) => {
                                if (isUpdatingQuantity) return;

                                const newQty = parseInt(e.target.value) || 1;

                                if (newQty !== item.count && newQty > 0) {
                                  handleQuantityChange(
                                    {
                                      name: item.name,
                                      category: item.category,
                                      size: item.size,
                                    },
                                    newQty
                                  );
                                } else if (newQty <= 0) {
                                  e.target.value = item.count;
                                }
                              }}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                if (val !== item.count) {
                                  e.target.value = item.count;
                                }
                              }}
                              disabled={isUpdatingQuantity}
                              className="w-full text-center border border-outline-variant/30 dark:border-gray-600 rounded px-0.5 py-0.5 text-xs font-medium bg-surface-container-low dark:bg-[#333] text-on-surface dark:text-white"
                            />
                          </div>

                          <button
                            onClick={() =>
                              handleIncreaseQuantity({
                                name: item.name,
                                category: item.category,
                                size: item.size,
                              })
                            }
                            disabled={isUpdatingQuantity}
                            className="p-1 text-on-surface-variant dark:text-gray-400 hover:bg-surface-container-high dark:hover:bg-[#333] rounded-md transition-colors disabled:opacity-50"
                          >
                            <Plus size={12} className="sm:hidden" />
                            <Plus size={14} className="hidden sm:block" />
                          </button>

                          <button
                            onClick={() =>
                              handleDeleteItem({
                                name: item.name,
                                category: item.category,
                                size: item.size,
                              })
                            }
                            disabled={isUpdatingQuantity}
                            className="p-1 text-error dark:text-red-500 hover:bg-error/10 dark:hover:bg-red-900/20 rounded-md transition-colors ml-0.5 sm:ml-1 disabled:opacity-50"
                          >
                            <Trash2 size={12} className="sm:hidden" />
                            <Trash2 size={14} className="hidden sm:block" />
                          </button>
                        </div>
                      </div>

                      {/* Units */}
                      <div className="space-y-1 sm:space-y-1.5">
                        <p className="text-[10px] text-on-surface-variant dark:text-gray-400 font-medium uppercase">
                          Units ({item.count})
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 sm:gap-1.5">
                          {item.units.map((unit, unitIdx) => {
                            const displayUnitNumber =
                              unit.unit_number ||
                              (() => {
                                let sizeAbbrv = "";
                                if (item.size && item.size !== "nosize") {
                                  sizeAbbrv = item.size.charAt(0).toUpperCase();
                                }
                                const sequenceNum = unitIdx + 1;
                                return sizeAbbrv
                                  ? `${item.name}-${sizeAbbrv}-${sequenceNum}`
                                  : `${item.name}-${sequenceNum}`;
                              })();

                            return (
                              <div
                                key={unitIdx}
                                className="flex items-center justify-between bg-primary/10 dark:bg-blue-900/20 border border-primary/20 dark:border-blue-800 rounded-md px-1.5 sm:px-2 py-1"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-[9px] sm:text-xs font-medium text-on-surface dark:text-gray-100 truncate">
                                    🏷️ {displayUnitNumber}
                                  </p>
                                  {item.size && item.size !== "nosize" && (
                                    <p className="text-[8px] text-on-surface-variant dark:text-gray-400">
                                      {item.size.charAt(0).toUpperCase()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sticky Action Bar */}
              <div className="fixed bottom-0 left-0 right-0 z-20 flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center justify-between px-3 sm:px-6 md:px-8 lg:px-12 py-2 sm:py-3 bg-surface-container-low dark:bg-[#1a1a1a] border-t border-outline-variant/10 dark:border-gray-700">
                {/* Left: Summary Text */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-[10px] sm:text-xs md:text-sm text-on-surface dark:text-white overflow-hidden">
                  {requestId && (
                    <>
                      <span className="text-on-surface-variant dark:text-gray-400 truncate font-medium">
                        #{requestId}
                      </span>
                      <span className="hidden sm:inline text-on-surface-variant dark:text-gray-400">|</span>
                    </>
                  )}
                  <span className="flex-shrink-0 font-medium">
                    Total Units: <b>{cart.length}</b>
                  </span>
                  <span className="hidden sm:inline text-on-surface-variant dark:text-gray-400">|</span>
                  <span className="flex-shrink-0 font-medium">
                    Items: <b>{consolidatedCart.length}</b>
                  </span>
                </div>

                {/* Right: Action Buttons */}
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => navigate('/available-items')}
                    className="flex items-center justify-center gap-1 flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-surface-container-highest dark:bg-[#222] hover:bg-surface-container dark:hover:bg-[#2a2a2a] text-on-surface dark:text-white rounded-md font-medium transition-colors whitespace-nowrap"
                  >
                    <ArrowLeft size={12} className="sm:hidden" />
                    <ArrowLeft size={14} className="hidden sm:block" />
                    <span className="hidden sm:inline">Shop</span>
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || cart.length === 0}
                    className="flex items-center justify-center gap-1 flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm bg-primary hover:bg-primary/90 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-md font-medium transition-all disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin text-[10px]">⏳</div>
                        <span className="hidden sm:inline">...</span>
                      </>
                    ) : (
                      <>
                        <Calendar size={12} className="sm:hidden" />
                        <Calendar size={14} className="hidden sm:block" />
                        <span className="hidden sm:inline">Submit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}