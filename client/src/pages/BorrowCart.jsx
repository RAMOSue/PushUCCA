// client/src/pages/BorrowCart.jsx
import { useContext, useMemo } from "react";
import { BorrowingContext } from "../../context/BorrowingContext";
import { UserContext } from "../../context/userContext";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function BorrowCart() {
  const { cart, updateQuantity, removeFromCart, clearCart } =
    useContext(BorrowingContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const cartTotalItems = useMemo(
    () => cart.reduce((sum, it) => sum + Number(it.quantity || 0), 0),
    [cart]
  );

  const submitRequest = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    const invalidItem = cart.find((item) => item.quantity <= 0);
    if (invalidItem) {
      toast.error(`❌ Invalid quantity for "${invalidItem.name}"`);
      return;
    }

    if (!user?.id) {
      toast.error("You must be logged in to submit a request.");
      return;
    }

    try {
      const payload = {
        borrower_id: user.id,
        items: cart.map((item) => ({
          item_id: item.id,
          unit_ids: item.unit_ids || [],
          quantity: item.quantity,
        })),
      };

      await axios.post("/api/borrow/request", payload);
      toast.success("✅ Borrow request submitted!");
      clearCart();
      navigate("/dashboard");
    } catch (err) {
      console.error("Submit error:", err.response?.data || err.message);
      toast.error(err?.response?.data?.error || "❌ Failed to submit request.");
    }
  };

  const handleQuantityChange = async (item, newQuantity) => {
    const prevQuantity = item.quantity;
    const diff = newQuantity - prevQuantity;

    if (newQuantity < 1) {
      toast.error("❌ Quantity cannot be less than 1.");
      return;
    }
    if (diff === 0) return;

    try {
      if (diff > 0) {
        await axios.post("/api/inventory/borrow/update-quantity", {
          item_id: item.id,
          unit_ids: item.unit_ids || [],
          quantity: diff,
        });
      } else {
        await axios.post("/api/inventory/borrow/restore-quantity", {
          item_id: item.id,
          unit_ids: item.unit_ids || [],
          quantity: Math.abs(diff),
        });
      }

      updateQuantity(item.id, newQuantity);
    } catch (err) {
      console.error("Quantity update error:", err.response?.data || err.message);
      toast.error("⚠️ Not enough stock or update failed.");
    }
  };

  const increment = (item) => handleQuantityChange(item, item.quantity + 1);
  const decrement = (item) => handleQuantityChange(item, item.quantity - 1);

  return (
    <div className="max-w-3xl mx-auto p-6 mt-10 bg-white shadow rounded">
      <h2 className="text-2xl font-bold mb-1">Borrowing Cart</h2>
      <p className="text-gray-500 mb-4">
        {cartTotalItems} total item{cartTotalItems === 1 ? "" : "s"} selected.
      </p>

      {cart.length === 0 ? (
        <p className="text-gray-600">No items added.</p>
      ) : (
        <>
          <ul className="divide-y">
            {cart.map((item) => {
              const isAccessory = item.garment_type?.toLowerCase() === "accessory";
              const isInstrument = !!item.instrument_category;
              const isGrouped = !isAccessory && !isInstrument;

              return (
                <li
                  key={item.id}
                  className="py-3 flex justify-between items-center gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {item.name}{" "}
                      {isGrouped && item.size ? `(${item.size})` : ""}
                    </p>
                    <p className="text-sm text-gray-500 capitalize">
                      {isGrouped
                        ? item.category || "Costume"
                        : isAccessory
                        ? "Accessory"
                        : isInstrument
                        ? item.instrument_category
                        : item.category || "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => decrement(item)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 text-lg font-bold disabled:opacity-40"
                      disabled={item.quantity <= 1}
                      type="button"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={item.quantity}
                      onChange={(e) =>
                        handleQuantityChange(item, Number(e.target.value))
                      }
                      className="w-16 text-center px-2 py-1 border rounded"
                      style={{ appearance: "auto" }}
                    />
                    <button
                      onClick={() => increment(item)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 text-lg font-bold"
                      type="button"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:underline text-sm ml-2"
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <button
            onClick={submitRequest}
            className="mt-6 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            type="button"
          >
            Submit Borrow Request
          </button>
        </>
      )}
    </div>
  );
}
