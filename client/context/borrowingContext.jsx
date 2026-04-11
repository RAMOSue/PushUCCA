import { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { UserContext } from "./userContext";
import { useNavigate } from "react-router-dom";

export const BorrowingContext = createContext({});

export function BorrowingProvider({ children }) {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("borrow_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [requestId, setRequestId] = useState(null); // Track reserved request
  const [availableItems, setAvailableItems] = useState(() => {
    try {
      const saved = localStorage.getItem("available_items");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [refreshAvailableItems, setRefreshAvailableItems] = useState(false);
  const [refreshBorrowHistory, setRefreshBorrowHistory] = useState(false); // ✅ NEW: Trigger refresh for MyBorrowedItems

  // Persist cart & available items
  useEffect(() => {
    localStorage.setItem("borrow_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("available_items", JSON.stringify(availableItems));
  }, [availableItems]);

  // 🔹 Refresh available items from backend
  const refreshAvailableItemsFromServer = async () => {
    try {
      const { data } = await axios.get("/api/inventory/available");
      const itemsMap = {};
      data.forEach((item) => {
        itemsMap[item.uuid] = item.total_available ?? 0;
      });
      setAvailableItems(itemsMap);
    } catch (err) {
      console.error("❌ Failed to refresh available items:", err.message);
    }
  };

  const refreshAfterReturn = async () => {
    await refreshAvailableItemsFromServer();
    setRefreshAvailableItems((prev) => !prev);
  };

  // 🔹 Load existing reserved request on user login
  useEffect(() => {
    if (!user?.id) return;

    const fetchReservedRequest = async () => {
      try {
        const res = await axios.get(`/api/borrow/reserved/${user.id}`);
        if (res.status === 200 && res.data.success && res.data.items?.length) {
          // ✅ CRITICAL FIX: Check if cart has temporary units
          // If it does, DON'T overwrite - preserve local cart (includes user's +/- changes)
          const savedCart = localStorage.getItem("borrow_cart");
          const localCart = savedCart ? JSON.parse(savedCart) : [];
          const hasTemporaryUnits = localCart.some(unit => unit.unitId?.startsWith('temp-'));
          
          if (hasTemporaryUnits) {
            console.log(`✅ PRESERVING local cart with temporary units:`, localCart);
            // Keep local cart as-is, don't overwrite with backend data
            setRequestId(res.data.request_id);
            return;
          }
          
          // Only restore from backend if no temporary units exist
          setCart(
            res.data.items.map((item) => ({
              unitId: item.unit_id,
              itemId: item.item_id,
              name: item.name,
              size: item.size || "nosize",
              image_url: item.image_url,
              category: item.garment_type || item.category || "costume",
              quantity: 1,
              status: "reserved",
              unit_number: item.unit_number  // ✅ Include unit_number from database
            }))
          );
          setRequestId(res.data.request_id);
        } else {
          // 404 or empty reserved request — ensure cart is empty
          setCart([]);
          setRequestId(null);
        }
      } catch (err) {
        if (err.response?.status === 404) {
          // No reserved request found — safe fallback
          setCart([]);
          setRequestId(null);
        } else {
          console.error(
            "❌ Failed to fetch reserved request:",
            err.response?.data || err.message
          );
          setCart([]);
          setRequestId(null);
        }
      }
    };

    fetchReservedRequest();
  }, [user]);

  // ✅ Add to Cart — calls backend to reserve item in borrowing_requests
  // ✅ NOW RETURNS: { success, data } for proper status tracking
  // ✅ SUPPORTS: Bulk operations with suppressToast parameter
  const addToCart = async (itemData, options = {}) => {
    const { suppressToast = false } = options;
    
    if (!user || !itemData) {
      if (!suppressToast) toast.error("You must be logged in to add items to the cart.");
      return { success: false, error: "Not logged in" };
    }

    const itemId = itemData.itemId || itemData.id;
    const unitId = itemData.unitId || itemData.unit_id;
    const { name, size, image_url, garment_type, category, status, unit_number } = itemData;

    if (!itemId || !unitId) {
      if (!suppressToast) toast.error("Invalid item or unit selection.");
      return { success: false, error: "Missing itemId or unitId" };
    }
    if (status && status.toLowerCase() !== "available") {
      if (!suppressToast) toast.error("This item is already reserved or unavailable.");
      return { success: false, error: "Item not available" };
    }

    try {
      const res = await axios.post("/api/borrow/cart", {
        borrower_id: String(user.id),
        request_id: requestId, // pass current reserved request if exists
        items: [{ unit_id: unitId, item_id: itemId, quantity: 1 }],
      });

      if (res.data.success) {
        // Update request id
        setRequestId(res.data.request_id);

        // If the server returned the canonical list of items for this reserved request,
        // use it to update local cart state (prevents race conditions when adding multiple units).
        if (Array.isArray(res.data.items)) {
          const mapped = res.data.items.map((item) => ({
            unitId: item.unit_id,
            itemId: item.item_id,
            name: item.name,
            size: item.size || "nosize",
            image_url: item.image_url,
            category: item.garment_type || item.category || "costume",
            quantity: 1,
            status: item.status || "reserved",
            unit_number: item.unit_number, // ✅ PRESERVE: Include unit_number from database
          }));
          // Append any new units from server to local cart (avoid duplicates)
          setCart((prev) => {
            const existingUnitIds = new Set(prev.map((p) => p.unitId));
            const toAdd = mapped.filter((m) => !existingUnitIds.has(m.unitId));
            return [...prev, ...toAdd];
          });
          if (!suppressToast) toast.success(`${name} reserved and added to cart!`);
          
          // ✅ NEW: Return success response for bulk operations
          return { success: true, data: res.data, name };
        } else {
          const alreadyExists = cart.some((c) => c.unitId === unitId);
          if (!alreadyExists) {
            const newCartItem = {
              unitId,
              itemId,
              name,
              size: size || "nosize",
              image_url,
              category: garment_type || category || "costume",
              quantity: 1,
              status: "reserved",
              unit_number, // ✅ PRESERVE: Include unit_number from itemData
            };
            setCart((prev) => [...prev, newCartItem]);
            if (!suppressToast) toast.success(`${name} reserved and added to cart!`);
            
            // ✅ NEW: Return success response
            return { success: true, data: newCartItem, name };
          } else {
            if (!suppressToast) toast.error("This item is already in your cart.");
            return { success: false, error: "Item already in cart" };
          }
        }
      } else {
        if (!suppressToast) toast.error(res.data.error || "Failed to reserve item.");
        return { success: false, error: res.data.error || "Failed to reserve item" };
      }
    } catch (err) {
      console.error("❌ Add to cart error:", err.response?.data || err.message);
      if (!suppressToast) {
        // Check if it's a 400 Bad Request (unit already reserved) vs 500 error
        if (err.response?.status === 400) {
          toast.error("This item is no longer available. Someone else may have reserved it.");
        } else {
          toast.error(err.response?.data?.error || "Failed to add item to cart.");
        }
      }
      return { success: false, error: err.response?.data?.error || err.message };
    }
  };

  // 🔹 Remove item from local cart
  const removeFromCart = async (unitIdOrItemId) => {
    try {
      // Try unit path first
      const payload = { borrower_id: String(user?.id) };
      if (unitIdOrItemId && unitIdOrItemId.length === 36) {
        payload.unit_id = unitIdOrItemId;
      } else {
        payload.item_id = unitIdOrItemId;
      }

      const res = await axios.post("/api/borrow/cart/remove", payload);
      if (res.data && res.data.success) {
        // Only remove by unitId if it's a UUID (36 chars), otherwise by itemId
        // Don't use AND condition - that could remove unintended items
        if (unitIdOrItemId && unitIdOrItemId.length === 36) {
          // It's a unitId - remove only this specific unit
          setCart((prev) => prev.filter((u) => u.unitId !== unitIdOrItemId));
        } else {
          // It's an itemId - remove all units with this itemId
          setCart((prev) => prev.filter((u) => u.itemId !== unitIdOrItemId));
        }
        toast.success("Item removed from cart.");
        return true;
      } else {
        // Still remove from local cart even if backend fails (optimistic update)
        if (unitIdOrItemId && unitIdOrItemId.length === 36) {
          setCart((prev) => prev.filter((u) => u.unitId !== unitIdOrItemId));
        } else {
          setCart((prev) => prev.filter((u) => u.itemId !== unitIdOrItemId));
        }
        console.warn("Backend removal failed, but removed from local cart:", res.data?.error);
        return true;
      }
    } catch (err) {
      // Still remove from local cart even if backend fails (optimistic update)
      if (unitIdOrItemId && unitIdOrItemId.length === 36) {
        setCart((prev) => prev.filter((u) => u.unitId !== unitIdOrItemId));
      } else {
        setCart((prev) => prev.filter((u) => u.itemId !== unitIdOrItemId));
      }
      console.error("❌ removeFromCart error:", err.response?.data || err.message);
      return true;
    }
  };

  // ✅ NEW: Unreserve multiple units at once (for delete in StaffBorrowCart)
  const unreserveUnits = async (unitIds) => {
    if (!user?.id || !unitIds || unitIds.length === 0) {
      return false;
    }

    try {
      // Don't call removeFromCart which also updates state
      // Instead, do a single batch operation
      
      // Update local cart immediately by removing all specified units
      setCart((prev) => {
        let updated = [...prev];
        for (const unitId of unitIds) {
          // Handle both string unitIds and objects with unit_id property
          const idToMatch = typeof unitId === 'string' ? unitId : unitId.unit_id;
          updated = updated.filter((u) => u.unitId !== idToMatch);
        }
        return updated;
      });

      // Call backend to unreserve each unit
      for (const unitId of unitIds) {
        const payload = { borrower_id: String(user?.id) };
        const idToUse = typeof unitId === 'string' ? unitId : unitId.unit_id;
        
        if (idToUse && idToUse.length === 36) {
          payload.unit_id = idToUse;
        } else {
          payload.item_id = idToUse;
        }
        
        try {
          await axios.post("/api/borrow/cart/remove", payload);
        } catch (err) {
          console.error("Error unreserving unit:", err.message);
          // Continue with other units even if one fails
        }
      }
      
      // Refresh available items from server
      await refreshAvailableItemsFromServer();
      
      return true;
    } catch (err) {
      console.error("❌ unreserveUnits error:", err.message);
      return false;
    }
  };

  // ✅ NEW: Add units to existing cart (for increasing quantity in StaffBorrowCart)
  const addUnitsToCart = async (itemId, quantity = 1, size = "nosize") => {
    if (!user?.id || !itemId || !requestId) {
      toast.error("You must be logged in and have a reserved request.");
      return false;
    }

    try {
      const res = await axios.post("/api/borrow/cart/add-units", {
        borrower_id: String(user.id),
        request_id: requestId,
        item_id: itemId,
        quantity: quantity,
        size: size,
      });

      if (res.data.success) {
        // Update cart with newly added items
        if (Array.isArray(res.data.items)) {
          const mapped = res.data.items.map((item) => ({
            unitId: item.unit_id,
            itemId: item.item_id,
            name: item.name,
            size: item.size || "nosize",
            image_url: item.image_url,
            category: item.garment_type || item.category || "costume",
            quantity: 1,
            status: "reserved",
          }));
          setCart((prev) => [...prev, ...mapped]);
        }
        
        // Refresh available items to reflect changes
        await refreshAvailableItemsFromServer();
        
        toast.success(`Added ${res.data.units_added} unit(s) to cart`);
        return true;
      } else {
        toast.error(res.data.error || "Failed to add units to cart");
        return false;
      }
    } catch (err) {
      console.error("❌ addUnitsToCart error:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to add units to cart");
      return false;
    }
  };

  // 🔹 Clear Cart (local only)
  const clearCart = () => {
    setCart([]);
    setRequestId(null);
    toast.success("Cart cleared.");
  };

  // ✅ Submit Borrow Request — change status from reserved → pending
  // Now handles both real unitIds and temporary unitIds
  // Supports options: { skipNavigation, cartSnapshot, finalQuantity }
  const submitBorrowRequest = async (options = {}) => {
    const skipNavigation = options.skipNavigation || false;
    const cartSnapshot = options.cartSnapshot || cart;
    const finalQuantity = options.finalQuantity || cartSnapshot.length;

    if (!user?.id) {
      toast.error("You must be logged in to submit a borrow request.");
      return;
    }

    if (cartSnapshot.length === 0) {
      toast.error("Your borrow cart is empty.");
      return;
    }

    try {
      // ✅ CRITICAL: Ensure finalQuantity matches cartSnapshot length
      const actualFinalQuantity = Math.max(finalQuantity, cartSnapshot.length);
      
      console.log(`📋 SUBMISSION START:`, {
        cartLength: cartSnapshot.length,
        providedFinalQuantity: finalQuantity,
        actualFinalQuantity: actualFinalQuantity,
        cartItems: cartSnapshot.map(u => ({ itemId: u.itemId, unitId: u.unitId })),
      });

      // ✅ Separate temporary units from real units
      const temporaryUnits = cartSnapshot.filter(u => u.unitId && u.unitId.startsWith('temp-'));
      const realUnits = cartSnapshot.filter(u => u.unitId && !u.unitId.startsWith('temp-'));

      console.log(`📋 Submission Analysis:`, {
        totalUnits: cartSnapshot.length,
        realUnits: realUnits.length,
        temporaryUnits: temporaryUnits.length,
        temporaryUnitIds: temporaryUnits.map(u => u.unitId),
        finalQuantity: actualFinalQuantity,
      });

      // ✅ If we have temporary units, we need to resolve them to real unitIds
      let finalUnitsForSubmission = [...realUnits];

      if (temporaryUnits.length > 0) {
        console.log(`🔄 Resolving ${temporaryUnits.length} temporary units...`);

        // Group temporary units by itemId to know how many we need per item
        const itemQuantityMap = {};
        for (const unit of temporaryUnits) {
          itemQuantityMap[unit.itemId] = (itemQuantityMap[unit.itemId] || 0) + 1;
        }

        console.log(`📦 Items needing real units:`, itemQuantityMap);

        // ✅ For submission, we'll keep temporary units as-is (they represent the extra quantity)
        // The quantity column in borrowing_requests already captures the total quantity
        // so temporary units are just for local display and will be stored as quantity in DB
        
        console.log(`✅ Keeping temporary units (${temporaryUnits.length}) for submission - quantity tracked in DB`);
        finalUnitsForSubmission.push(...temporaryUnits);
      }

      // ✅ No need to validate temp units - they're acceptable for submission
      // The quantity column in borrowing_requests will track them
      console.log(`🏃 Final submission with ${finalUnitsForSubmission.length} units and quantity ${actualFinalQuantity}`);

      // ✅ Submit with final units and quantity information
      const res = await axios.post("/api/borrow/submit-cart", {
        borrower_id: String(user.id),
        request_id: requestId,
        items: finalUnitsForSubmission.map(u => ({
          unit_id: u.unitId,
          item_id: u.itemId,
          quantity: 1,
        })),
        quantity: actualFinalQuantity, // Store final quantity (main field)
        finalQuantity: actualFinalQuantity, // Also send as finalQuantity for compatibility
        item_count: finalUnitsForSubmission.length, // Number of unit items
      });

      if (res.data.success) {
        const submittedQuantity = res.data.quantity || res.data.final_quantity || actualFinalQuantity;
        console.log(`✅ SUBMISSION SUCCESSFUL - Quantity: ${submittedQuantity}`);
        
        toast.success(`✅ Borrow request submitted successfully! (${submittedQuantity} units)`);
        
        // ✅ Store submission details before clearing - THIS PERSISTS THE QUANTITY
        const submissionData = {
          requestId: res.data.request_id,
          quantity: submittedQuantity, // ✅ CRITICAL: Persist the quantity
          itemCount: finalUnitsForSubmission.length,
          cartSnapshot: cartSnapshot, // Keep cart backup
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem('last_borrow_submission', JSON.stringify(submissionData));
        
        console.log(`💾 Saved submission to localStorage:`, submissionData);
        
        // Clear cart state
        setCart([]);
        setRequestId(null);
        setRefreshAvailableItems((prev) => !prev);
        
        // If skipNavigation is false (default), navigate immediately for backward compatibility
        if (!skipNavigation) {
          navigate("/manage-borrow-requests");
        }
        
        return {
          ...res.data,
          quantity: submittedQuantity,
          final_quantity: submittedQuantity,
        };
      } else {
        toast.error(res.data.error || "Failed to submit borrow request.");
      }
    } catch (err) {
      console.error("❌ Submit borrow request error:", err.response?.data || err.message);
      toast.error(
        err.response?.data?.error ||
          "Failed to submit borrow request. Please try again."
      );
    }
  };

  // ✅ Save cart quantity to backend for persistence
  const saveCartQuantity = async (cartData = null) => {
    if (!user?.id) {
      console.warn("⚠️ saveCartQuantity: User not logged in");
      return false;
    }

    const cartToSave = cartData || cart;
    if (cartToSave.length === 0) {
      console.warn("⚠️ saveCartQuantity: Cart is empty");
      return false;
    }

    try {
      const res = await axios.post("/api/borrow/cart/save-quantity", {
        borrower_id: String(user.id),
        quantity: cartToSave.length,
        cart: cartToSave
      });

      if (res.data?.success) {
        console.log(`💾 Cart quantity saved to backend:`, {
          quantity: res.data.quantity,
          item_count: res.data.item_count,
          request_id: res.data.request_id
        });
        
        // ✅ NEW: Trigger refresh for MyBorrowedItems page
        setRefreshBorrowHistory((prev) => !prev);
        console.log(`🔄 Triggered borrow history refresh for MyBorrowedItems`);
        
        return true;
      } else {
        console.error("❌ saveCartQuantity: Server returned unsuccessful", res.data);
        return false;
      }
    } catch (err) {
      console.error("❌ saveCartQuantity error:", err.response?.data || err.message);
      return false;
    }
  };

  // ✅ Add to cart from QR code scan
  const addFromScanner = async (qrCodeText) => {
    if (!qrCodeText) return;
    try {
      const { data } = await axios.get(
        `/api/inventory/scan/text/${encodeURIComponent(qrCodeText)}`
      );

      if (data?.type === "unit" && data.data) {
        await addToCart({
          ...data.data,
          unitId: data.data.unitId || data.data.unit_id,
          itemId: data.data.itemId || data.data.id,
        });
      } else {
        toast.error("QR code did not match a valid unit.");
      }
    } catch (err) {
      console.error("❌ Scanner add failed:", err.response?.data || err.message);
      toast.error("Failed to add item from QR code.");
    }
  };

  return (
    <BorrowingContext.Provider
      value={{
        cart,
        setCart,
        addToCart,
        removeFromCart,
        clearCart,
        unreserveUnits,
        addUnitsToCart,
        submitBorrowRequest,
        saveCartQuantity,
        addFromScanner,
        availableItems,
        refreshAvailableItems,
        setRefreshAvailableItems,
        refreshAvailableItemsFromServer,
        refreshAfterReturn,
        requestId,
        setRequestId,
        refreshBorrowHistory,
        setRefreshBorrowHistory,
      }}
    >
      {children}
    </BorrowingContext.Provider>
  );
}
