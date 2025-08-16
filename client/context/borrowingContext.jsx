// BorrowingContext.jsx
import { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";
import { UserContext } from "./userContext";

export const BorrowingContext = createContext({
  cart: [],
  addToCart: async () => {},
  removeFromCart: async () => {},
  clearCart: async () => {},
  updateQuantity: async () => {},
  addFromScanner: async () => {},
});

export function BorrowingProvider({ children }) {
  const { user } = useContext(UserContext);

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("borrow_cart");
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.error("❌ Failed to load borrow_cart from localStorage:", err);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("borrow_cart", JSON.stringify(cart));
    } catch (err) {
      console.error("❌ Failed to save borrow_cart to localStorage:", err);
    }
  }, [cart]);

  /**
   * Update borrow status in backend
   */
  const sendBorrowStatusUpdate = async (unitId, action) => {
    if (!unitId || !action) return;
    try {
      await axios.post("/api/inventory/borrow/update-borrow-quantity", {
        unitId,
        action,
      });
    } catch (err) {
      console.error(
        "❌ Failed to update borrow status:",
        err.response?.data || err.message
      );
      throw err;
    }
  };

  /**
   * Add a unit to the cart
   */
  const addToCart = async (unitData) => {
    if (!user) return console.warn("⚠️ No user logged in");
    if (!unitData?.id) return console.warn("⚠️ Invalid unitData");

    const exists = cart.find((u) => u.id === unitData.id);
    if (exists) return; // already in cart, do nothing

    try {
      await sendBorrowStatusUpdate(unitData.id, "borrow");

      // Include size for costumes/grouped items
      const isAccessory = unitData.garment_type?.toLowerCase() === "accessory";
      const isInstrument = !!unitData.instrument_category;
      const isGrouped = !isAccessory && !isInstrument;

      const cartItem = {
        ...unitData,
        quantity: unitData.quantity || 1,
      };

      if (isGrouped) {
        cartItem.size = unitData.size || unitData.units?.[0]?.size || "";
      }

      setCart((prev) => [...prev, cartItem]);
    } catch (err) {
      console.error("❌ Failed to borrow unit before adding to cart:", err.message);
    }
  };

  /**
   * Remove a unit from the cart
   */
  const removeFromCart = async (unitId) => {
    const unit = cart.find((u) => u.id === unitId);
    if (!unit) return;

    try {
      await sendBorrowStatusUpdate(unitId, "return");
    } catch (err) {
      console.error(`❌ Failed to return unit ${unitId}:`, err.message);
    } finally {
      setCart((prev) => prev.filter((u) => u.id !== unitId));
    }
  };

  /**
   * Clear the entire cart
   */
  const clearCart = async () => {
    for (const unit of cart) {
      try {
        await sendBorrowStatusUpdate(unit.id, "return");
      } catch (err) {
        console.error(`❌ Failed to return unit ${unit.id}:`, err.message);
      }
    }
    setCart([]);
    localStorage.removeItem("borrow_cart");
  };

  /**
   * Update quantity of a unit in cart (deprecated)
   */
  const updateQuantity = async (unitId, newQuantity) => {
    console.warn("⚠️ updateQuantity is deprecated — each unit is handled individually now");
    return;
  };

  /**
   * Add unit from QR scanner
   */
  const addFromScanner = async (qrCodeText) => {
    if (!qrCodeText) return;
    try {
      const { data } = await axios.get(
        `/api/inventory/scan/text/${encodeURIComponent(qrCodeText)}`
      );
      if (!data) throw new Error("No data returned from scan");

      if (data.type === "unit" && data.data?.id) {
        await addToCart(data.data);
        return;
      }

      throw new Error("Unrecognized scan format");
    } catch (err) {
      console.error("❌ Scanner add failed:", err.response?.data || err.message);
      throw err;
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
      }}
    >
      {children}
    </BorrowingContext.Provider>
  );
}
