import React, { useContext, useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { BorrowingContext } from "../../../context/borrowingContext";
import { UserContext } from "../../../context/userContext";
import BorrowPhotoCaptureModal from "../../components/modals/BorrowPhotoCaptureModal";
import PageLayout from "../../components/layout/PageLayout";
import { Plus, Minus, Trash2, ArrowLeft, Calendar, ShoppingBag } from "lucide-react";
import { getInventoryDivisionInfo } from "../../utils/inventoryDivisionStorage";

export default function StaffBorrowCart() {
  const { cart, setCart, removeFromCart, unreserveUnits, submitBorrowRequest, requestId, refreshAvailableItemsFromServer, saveCartQuantity, addToCart } = useContext(BorrowingContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [photoCaptureOpen, setPhotoCaptureOpen] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [isUpdatingQuantity, setIsUpdatingQuantity] = useState(false);
  const [tempUnitCounter, setTempUnitCounter] = useState(0);

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

  // Only staff can access this page
  if (user && user.role !== 'staff') {
    navigate('/available-items');
    return null;
  }

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
      // ✅ CRITICAL: Capture final cart state before submission
      const cartSnapshot = [...cart];
      const finalQuantity = cartSnapshot.length;
      
      console.log(`📋 Final Cart State Before Submit:`, {
        totalUnits: finalQuantity,
        cartItems: cartSnapshot.length,
        snapshot: cartSnapshot
      });

      // Submit with complete cart information
      const result = await submitBorrowRequest({
        skipNavigation: true,
        cartSnapshot: cartSnapshot,
        finalQuantity: finalQuantity
      });

      if (result?.request_id) {
        setCurrentRequestId(result.request_id);
      } else if (requestId) {
        setCurrentRequestId(requestId);
      }

      console.log(`✅ Submit Successful - Quantity: ${finalQuantity}`);

      // Refresh available items after successful submission
      await refreshAvailableItemsFromServer();
      
      // ✅ Cart is automatically cleared in submitBorrowRequest
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
    // ✅ Navigate to staff schedule after photos captured
    navigate("/staff/schedule");
  };

  const handlePhotosSkipped = () => {
    // ✅ Navigate to staff schedule when photos skipped
    navigate("/staff/schedule");
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

  return (
    <div className="min-h-screen dark:bg-[#171717]">
      {/* Main content with dynamic responsive margins */}
      <PageLayout>
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
      />

      {/* ========== Header Section ========== */}
      <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6 dark:bg-[#171717]">
        <div className="flex items-start justify-between gap-6">
          {/* Left Side - Title */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">Staff Borrowing Cart</h1>
            <p className="text-on-surface-variant dark:text-gray-400 text-sm">Review items before submitting</p>
          </div>

          {/* Right Side - Summary Pills */}
          <div className="flex gap-3 flex-wrap items-center justify-end">
            <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
              Items: <span className="font-bold text-black-600 dark:text-black-400">{consolidatedCart.length}</span>
            </div>
            <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
              Units: <span className="font-bold text-black-600 dark:text-black-400">{cart.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========== Main Content Area ========== */}
      <div className="px-6 md:px-8 lg:px-12 space-y-4 dark:bg-[#171717]">

        {/* Content */}
        {cart.length === 0 ? (
          <div className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-2xl shadow-sm border border-outline-variant/10 dark:border-gray-700 p-8 sm:p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-on-surface-variant dark:text-gray-400 text-base sm:text-lg mb-6">Your cart is empty</p>
            <button
              onClick={() => navigate('/available-items')}
              className="px-2 py-1 bg-green-900 hover:bg-green-950 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
            >
              Continue to Borrow
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Cart Items */}
            <div className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-xl sm:rounded-2xl shadow-sm border border-outline-variant/10 dark:border-gray-700 overflow-hidden">
              {/* Header */}
              

              {/* Items List */}
<div className="divide-y divide-outline-variant/10 dark:divide-gray-700">
  {consolidatedCart.map((item, index) => (
    <div
      key={index}
      className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a] transition-colors"
    >
      {/* Item Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-on-surface dark:text-white text-xs sm:text-sm truncate">
              {item.name}
            </p>
            {item.size && item.size !== "nosize" && (
              <span className="text-xs text-on-surface-variant dark:text-gray-400">
                ({item.size})
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-xs text-on-surface-variant dark:text-gray-400 mt-0.5 capitalize">
            {item.category}
          </p>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center gap-1">
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
            <Minus size={14} />
          </button>

          <div className="w-10">
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
              className="w-full text-center border border-outline-variant/30 dark:border-gray-600 rounded px-1 py-0.5 text-xs font-medium bg-surface-container-low dark:bg-[#333] text-on-surface dark:text-white"
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
            <Plus size={14} />
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
            className="p-1 text-error dark:text-red-500 hover:bg-error/10 dark:hover:bg-red-900/20 rounded-md transition-colors ml-1 disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Units */}
      <div className="space-y-1">
        <p className="text-[10px] text-on-surface-variant dark:text-gray-400 font-medium uppercase">
          Units ({item.count})
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
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
                className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md px-2 py-1"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-on-surface dark:text-gray-100 truncate">
                    🏷️ {displayUnitNumber}
                  </p>
                  {item.size && item.size !== "nosize" && (
                    <p className="text-[9px] text-on-surface-variant dark:text-gray-400">
                      Size: {item.size.charAt(0).toUpperCase()}
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

          {/* Compact Summary Bar */}
<div className="flex items-center justify-between gap-3 px-3 py-2 bg-surface-container-low dark:bg-[#1a1a1a] border border-outline-variant/10 dark:border-gray-700 rounded-md">
  
  {/* Left: Summary */}
  <div className="flex items-center gap-3 text-xs sm:text-sm text-on-surface dark:text-white">
    <span>
      Total: <b>{cart.length}</b>
    </span>
    <span className="text-on-surface-variant dark:text-gray-400">|</span>
    <span>
      Items: <b>{consolidatedCart.length}</b>
    </span>
    {requestId && (
      <>
        <span className="text-on-surface-variant dark:text-gray-400">|</span>
        <span className="text-on-surface-variant dark:text-gray-400 truncate max-w-[100px]">
          #{requestId}
        </span>
      </>
    )}
  </div>

  {/* Right: Submit */}
  <button
    onClick={handleSubmit}
    disabled={submitting || cart.length === 0}
    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900 hover:bg-green-950 disabled:bg-on-surface-variant dark:disabled:bg-gray-600 text-white rounded-md text-xs sm:text-sm font-medium transition-colors"
  >
    {submitting ? (
      <>
        <div className="animate-spin text-xs">⏳</div>
        <span>Submitting</span>
      </>
    ) : (
      <>
        <Calendar size={14} />
        <span>Submit</span>
      </>
    )}
  </button>

</div>
            </div>
          )}
        </div>
      </PageLayout>
    </div>
  );
}
