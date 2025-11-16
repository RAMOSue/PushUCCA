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
          setCart(
            res.data.items.map((item) => ({
              unitId: item.unit_id,
              itemId: item.item_id,
              name: item.name,
              size: item.size || "nosize", // size comes from inventory_units
              image_url: item.image_url,
              category: item.garment_type || item.category || "costume",
              quantity: 1,
              status: "reserved",
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
  const addToCart = async (itemData) => {
    if (!user || !itemData) {
      toast.error("You must be logged in to add items to the cart.");
      return;
    }

    const itemId = itemData.itemId || itemData.id;
    const unitId = itemData.unitId || itemData.unit_id;
    const { name, size, image_url, garment_type, category, status } = itemData;

    if (!itemId || !unitId) {
      toast.error("Invalid item or unit selection.");
      return;
    }
    if (status && status.toLowerCase() !== "available") {
      toast.error("This item is already reserved or unavailable.");
      return;
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
          }));
          // Append any new units from server to local cart (avoid duplicates)
          setCart((prev) => {
            const existingUnitIds = new Set(prev.map((p) => p.unitId));
            const toAdd = mapped.filter((m) => !existingUnitIds.has(m.unitId));
            return [...prev, ...toAdd];
          });
          toast.success(`${name} reserved and added to cart!`);
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
            };
            setCart((prev) => [...prev, newCartItem]);
            toast.success(`${name} reserved and added to cart!`);
          } else {
            toast.error("This item is already in your cart.");
          }
        }
      } else {
        toast.error(res.data.error || "Failed to reserve item.");
      }
    } catch (err) {
      console.error("❌ Add to cart error:", err.response?.data || err.message);
      toast.error(err.response?.data?.error || "Failed to add item to cart.");
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
        // Remove from local cart state
        setCart((prev) => prev.filter((u) => u.unitId !== unitIdOrItemId && u.itemId !== unitIdOrItemId));
        toast.success("Item removed from cart.");
      } else {
        toast.error(res.data?.error || "Failed to remove item from cart.");
      }
    } catch (err) {
      console.error("❌ removeFromCart error:", err.response?.data || err.message);
      toast.error("Failed to remove item from cart.");
    }
  };

  // 🔹 Clear Cart (local only)
  const clearCart = () => {
    setCart([]);
    setRequestId(null);
    toast.success("Cart cleared.");
  };

  // ✅ Submit Borrow Request — change status from reserved → pending
  const submitBorrowRequest = async () => {
    if (!user?.id) {
      toast.error("You must be logged in to submit a borrow request.");
      return;
    }

    if (cart.length === 0) {
      toast.error("Your borrow cart is empty.");
      return;
    }

    try {
      const res = await axios.post("/api/borrow/submit-cart", {
        borrower_id: String(user.id),
        request_id: requestId, // submit the existing reserved request
      });

      if (res.data.success) {
        toast.success("Borrow request submitted successfully!");
        setCart([]);
        setRequestId(null);
        setRefreshAvailableItems((prev) => !prev);
        navigate("/manage-borrow-requests");
        return res.data;
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
        addToCart,
        removeFromCart,
        clearCart,
        submitBorrowRequest,
        addFromScanner,
        availableItems,
        refreshAvailableItems,
        setRefreshAvailableItems,
        refreshAvailableItemsFromServer,
        refreshAfterReturn,
        requestId,
        setRequestId,
      }}
    >
      {children}
    </BorrowingContext.Provider>
  );
}
