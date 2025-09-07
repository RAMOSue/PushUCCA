import { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { UserContext } from "./userContext";

// Create the context
const BorrowingContext = createContext(null);

// Provider component
const BorrowingProvider = ({ children }) => {
  const { user } = useContext(UserContext);

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("borrow_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [availableItems, setAvailableItems] = useState(() => {
    try {
      const saved = localStorage.getItem("available_items");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [refreshAvailableItems, setRefreshAvailableItems] = useState(false);
  const [currentBorrowingId, setCurrentBorrowingId] = useState(null);

  useEffect(() => {
    localStorage.setItem("borrow_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("available_items", JSON.stringify(availableItems));
  }, [availableItems]);
  
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

  // 🆕 Start borrowing session
  const startBorrowingSession = async () => {
    if (!user?.id) {
      toast.error("You must be logged in to start a borrowing session.");
      return null;
    }
    try {
      const res = await axios.post("/api/borrow/start", {
        borrower_id: user.id,
      });

      // ✅ Handle both possible backend response shapes
      const borrowingId =
        res.data?.borrowingId ||
        res.data?.borrowRequest?.id ||
        res.data?.id;

      if (borrowingId) {
        setCurrentBorrowingId(borrowingId);
        toast.success("Borrowing session started!");
        return borrowingId;
      }

      throw new Error("Invalid response from server (no borrowingId)");
    } catch (err) {
      console.error(
        "❌ Failed to start borrowing session:",
        err.response?.data || err.message
      );
      toast.error("Failed to start borrowing session.");
      return null;
    }
  };

  const reserveUnit = async (unitId, borrowingId) => {
    try {
      if (!borrowingId) {
        throw new Error("❌ borrowingId is required to reserve a unit.");
      }

      const res = await axios.post("/api/inventory/borrow/reserve-unit", {
        unitId,
        borrowing_id: borrowingId,
      });

      return res.data;
    } catch (err) {
      console.error(
        `❌ Failed to reserve unit ${unitId}:`,
        err.response?.data || err.message
      );
      throw err;
    }
  };

  const releaseUnit = async (unitId) => {
    try {
      await axios.post("/api/inventory/borrow/release-unit", { unitId });
    } catch (err) {
      console.error(
        `❌ Failed to release unit ${unitId}:`,
        err.response?.data || err.message
      );
      throw err;
    }
  };

  // -----------------------
  // Add item/unit to cart
  // -----------------------
  const addToCart = async (itemData) => {
    if (!user || !itemData) return;

    const itemId = itemData.itemId || itemData.id;
    const unitId = itemData.unitId || itemData.unit_id;
    const { name, size, image_url, garment_type, category, total_available } =
      itemData;

    if (!itemId) {
      console.error("❌ Missing itemId in addToCart payload", itemData);
      toast.error("Unable to add item. Missing item identifier.");
      return;
    }

    if (!unitId) {
      console.error("❌ Missing unitId in addToCart payload", itemData);
      toast.error("Please select a specific unit before adding to cart.");
      return;
    }

    // ⚡ Ensure borrowing session exists
    let borrowingId = currentBorrowingId;
    if (!borrowingId) {
      console.warn("⚠️ No borrowing session found. Starting a new one...");
      borrowingId = await startBorrowingSession();
      if (!borrowingId) {
        toast.error("Cannot add item: borrowing session not initialized.");
        return;
      }
      // update context with new ID
      setCurrentBorrowingId(borrowingId);
    }

    // ✅ Avoid duplicate items
    const exists = cart.find((c) => c.unitId === unitId);
    if (exists) {
      toast.error("This item is already in your cart.");
      return;
    }

    try {
      // reserve unit in backend
      await reserveUnit(unitId, borrowingId);

      const normalizedCategory = (garment_type || category || "costume").toLowerCase();

      const cartItem = {
        unitId,
        itemId,
        name,
        size: size || "nosize",
        image_url,
        category: normalizedCategory,
        quantity: 1,
      };

      setCart((prev) => [...prev, cartItem]);

      setAvailableItems((prev) => {
        const currentQty = prev[itemId] ?? total_available ?? 0;
        return { ...prev, [itemId]: Math.max(currentQty - 1, 0) };
      });

      toast.success("Item added to cart!");
    } catch (err) {
      console.error("❌ Failed to add to cart:", err.message, err);
      toast.error("Failed to reserve this item.");
    }
  };

  const removeFromCart = async (unitIdOrItemId) => {
    let item = cart.find((u) => u.unitId === unitIdOrItemId);
    if (!item) item = cart.find((u) => u.itemId === unitIdOrItemId);
    if (!item) return;

    setCart((prev) =>
      prev.filter((u) => u.unitId !== item.unitId && u.itemId !== item.itemId)
    );
    setAvailableItems((prev) => ({
      ...prev,
      [item.itemId]: (prev[item.itemId] ?? 0) + 1,
    }));

    try {
      if (item.unitId) await releaseUnit(item.unitId);
    } catch {
      toast.error("Failed to release unit on server.");
    }
  };

  const clearCart = async () => {
    const snapshot = [...cart];
    setCart([]);
    setAvailableItems((prev) => {
      const updated = { ...prev };
      for (const item of snapshot) {
        updated[item.itemId] = (updated[item.itemId] ?? 0) + 1;
      }
      return updated;
    });

    try {
      await Promise.all(snapshot.map((item) => item.unitId && releaseUnit(item.unitId)));
    } catch (err) {
      console.error("❌ Failed to release some units during clearCart:", err);
    }
  };

  const updateQuantity = () => {
    console.warn("⚠️ updateQuantity ignored: unit-based items always have quantity = 1");
  };

  // -----------------------
  // Add via QR Scanner
  // -----------------------
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

  const decrementAvailable = (itemId, qty = 1) =>
    setAvailableItems((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) - qty }));

  const incrementAvailable = (itemId, qty = 1) =>
    setAvailableItems((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + qty }));

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
      const items = cart
        .map(({ unitId, itemId, size, quantity }) => {
          if (unitId) return { unitId: String(unitId) };
          if (size)
            return {
              itemId: String(itemId),
              size,
              quantity: parseInt(quantity, 10) || 1,
            };
          return { itemId: String(itemId), quantity: parseInt(quantity, 10) || 1 };
        })
        .filter(Boolean);

      const res = await axios.post("/api/borrow/submit", {
        borrower_id: String(user.id),
        items,
      });

      if (res.data.success) {
        toast.success(res.data.message);

        cart.forEach(({ itemId }) => {
          decrementAvailable(itemId, 1);
        });

        setCart([]);
        setRefreshAvailableItems((prev) => !prev);

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

return (
    <BorrowingContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        updateQuantity,
        addFromScanner,
        availableItems,
        decrementAvailable,
        incrementAvailable,
        submitBorrowRequest,
        refreshAvailableItems,
        setRefreshAvailableItems,
        refreshAvailableItemsFromServer,
        refreshAfterReturn,
        currentBorrowingId,
        startBorrowingSession,
        setCurrentBorrowingId,
      }}
    >
      {children}
    </BorrowingContext.Provider>
  );
};

// ✅ Export consistently
export { BorrowingContext };
export default BorrowingProvider;