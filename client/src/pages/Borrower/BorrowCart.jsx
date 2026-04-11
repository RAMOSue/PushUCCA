import React, { useContext, useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { BorrowingContext } from "../../../context/borrowingContext";
import { UserContext } from "../../../context/userContext";
import BorrowPhotoCaptureModal from "../../components/modals/BorrowPhotoCaptureModal";
import PageLayout from "../../components/layout/PageLayout";
import { Trash2, ArrowLeft, Calendar, ShoppingBag, Minus, Plus } from "lucide-react";

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
      <div className="min-h-screen bg-gray-50 lg:bg-white dark:bg-[#171717] dark:lg:bg-[#171717] pb-24">
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-center mb-6 sm:mb-8 relative">
          <button
            onClick={() => navigate(-1)}
            className="absolute left-0 p-2 hover:bg-gray-100 dark:hover:bg-[#222] rounded-full transition-colors"
            title="Go back"
          >
            <ArrowLeft size={20} className="text-emerald-700" />
          </button>
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Borrowing Cart</h1>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">Review items before submitting</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#222] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 font-medium transition-colors text-sm sm:text-base"
          >
            <ArrowLeft size={18} /> Back
          </button>
        </div>

        {/* Content */}
        {cart.length === 0 ? (
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 sm:p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg mb-6">Your cart is empty</p>
            <button
              onClick={() => navigate('/available-items')}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors text-sm sm:text-base"
            >
              Continue to Borrow
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Cart Items */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* Header */}
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-[#222]">
                <p className="font-semibold text-gray-900 dark:text-white">
                  Units ({cart.length}) • {consolidatedCart.length} Item{consolidatedCart.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Items List */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {consolidatedCart.map((item, index) => (
                  <div key={index} className="px-4 sm:px-6 py-4 sm:py-5 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                    {/* Item Header */}
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{item.name}</p>
                          {item.size && item.size !== "nosize" && (
                            <span className="text-sm text-gray-500">({item.size})</span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 capitalize">
                          {item.category}
                        </p>
                      </div>
                      
                      {/* Quantity Controls - Consolidated */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDecreaseQuantity({
                            name: item.name,
                            category: item.category,
                            size: item.size
                          })}
                          disabled={isUpdatingQuantity}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#333] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Decrease quantity"
                        >
                          <Minus size={16} />
                        </button>
                        <div className="w-12 flex items-center justify-center">
                          <input
                            type="number"
                            min="1"
                            value={item.count}
                            onChange={(e) => {
                              // Prevent updates while already updating
                              if (isUpdatingQuantity) return;
                              
                              const newQty = parseInt(e.target.value) || 1;
                              
                              // Only update if value actually changed
                              if (newQty !== item.count && newQty > 0) {
                                handleQuantityChange({
                                  name: item.name,
                                  category: item.category,
                                  size: item.size
                                }, newQty);
                              } else if (newQty <= 0) {
                                // Reset to 1 if user tries to go below 1
                                e.target.value = item.count;
                              }
                            }}
                            onBlur={(e) => {
                              // Ensure valid value on blur
                              const val = parseInt(e.target.value) || 1;
                              if (val !== item.count) {
                                e.target.value = item.count;
                              }
                            }}
                            disabled={isUpdatingQuantity}
                            className="w-full text-center border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm font-semibold bg-white dark:bg-[#333] text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          />
                        </div>
                        <button
                          onClick={() => handleIncreaseQuantity({
                            name: item.name,
                            category: item.category,
                            size: item.size
                          })}
                          disabled={isUpdatingQuantity}
                          className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#333] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Increase quantity"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem({
                            name: item.name,
                            category: item.category,
                            size: item.size
                          })}
                          disabled={isUpdatingQuantity}
                          className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove all units of this item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Individual Units Display */}
                    <div className="space-y-2 pl-0 sm:pl-4">
                      <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Units in cart ({item.count})</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {item.units.map((unit, unitIdx) => {
                          // ✅ CRITICAL: Use unit_number from database FIRST, fallback to generated format
                          // unit_number is set from database when item is added to cart via BorrowingContext
                          const displayUnitNumber = unit.unit_number || (() => {
                            // Fallback for temporary units created via +/- buttons (rare case)
                            let sizeAbbrv = '';
                            if (item.size && item.size !== "nosize") {
                              sizeAbbrv = item.size.charAt(0).toUpperCase();
                            }
                            // Generate format: "ItemName-S-1" or "ItemName-1" if no size
                            const sequenceNum = unitIdx + 1;
                            return sizeAbbrv ? `${item.name}-${sizeAbbrv}-${sequenceNum}` : `${item.name}-${sequenceNum}`;
                          })();
                          
                          return (
                            <div
                              key={unitIdx}
                              className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2 sm:p-3"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  🏷️ {displayUnitNumber}
                                </p>
                                {item.size && item.size !== "nosize" && (
                                  <p className="text-2xs text-gray-600 dark:text-gray-400">
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

            {/* Summary Card */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6 transition-colors">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600 dark:text-gray-400">Total Units in Cart:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{cart.length}</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="text-gray-600 dark:text-gray-400">Unique Items:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{consolidatedCart.length}</span>
                </div>
                {requestId && (
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-600">Request ID:</span>
                    <span className="font-semibold text-gray-900">{requestId}</span>
                  </div>
                )}
              </div>

              {/* Info Message */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                <p className="text-xs sm:text-sm text-blue-900">
                  <span className="font-semibold">ℹ️ Note:</span> Items will be reserved upon submission. Staff will review and approve your request.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/available-items')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  <ArrowLeft size={18} />
                  <span>Continue Shopping</span>
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || cart.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin">⏳</div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Calendar size={18} />
                      <span>Submit Request</span>
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
