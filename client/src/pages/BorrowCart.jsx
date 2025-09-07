import { useContext, useMemo } from "react";
import { BorrowingContext } from "../../context/BorrowingContext";
import { UserContext } from "../../context/userContext";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function BorrowCart() {
  const { cart, updateQuantity, removeFromCart, submitBorrowRequest } =
    useContext(BorrowingContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const cartTotalItems = useMemo(
    () => cart.reduce((sum, it) => sum + Number(it.quantity ?? 0), 0),
    [cart]
  );

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error("You must be logged in to submit a request.");
      return;
    }

    if (cart.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }

    const invalidItem = cart.find((item) => (item.quantity ?? 0) <= 0);
    if (invalidItem) {
      toast.error(`❌ Invalid quantity for "${invalidItem.name}"`);
      return;
    }

    try {
      const result = await submitBorrowRequest(user.id, cart);
      if (result?.success) {
        toast.success("✅ Borrow request submitted successfully!");
        navigate("/dashboard");
      } else {
        toast.error(result?.error || "Failed to submit borrow request.");
      }
    } catch (err) {
      console.error("Borrow request error:", err);
      toast.error("An error occurred while submitting request.");
    }
  };

  const handleQuantityChange = (item, newQuantity) => {
    if (item.unitId) return; // Costume units (specific unit) cannot change quantity

    if ((newQuantity ?? 0) < 1) {
      toast.error("❌ Quantity cannot be less than 1.");
      return;
    }

    updateQuantity(item.id, item.size, item.unitId, newQuantity);
  };

  const increment = (item) =>
    handleQuantityChange(item, (item.quantity ?? 0) + 1);
  const decrement = (item) =>
    handleQuantityChange(item, (item.quantity ?? 0) - 1);

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
              const isAccessory =
                item.garment_type?.toLowerCase() === "accessory";
              const isInstrument = item.category?.toLowerCase() === "instrument";
              const isCostume = !!item.unitId; // specific unit

              return (
                <li
                  key={`${item.id}-${item.unitId || "gen"}`}
                  className="py-3 flex justify-between items-center gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {item.name} {isCostume && item.size ? `(${item.size})` : ""}
                    </p>
                    <p className="text-sm text-gray-500 capitalize">
                      {isCostume
                        ? item.category || "Costume"
                        : isAccessory
                        ? "Accessory"
                        : isInstrument
                        ? "Instrument"
                        : item.category || "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isCostume && (
                      <>
                        <button
                          onClick={() => decrement(item)}
                          className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 text-lg font-bold disabled:opacity-40"
                          disabled={(item.quantity ?? 0) <= 1}
                          type="button"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity ?? 1}
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
                      </>
                    )}
                    <button
                      onClick={() =>
                        isCostume
                          ? removeFromCart(item.unitId) // ✅ correct for unit-based
                          : removeFromCart(item.id) // ✅ correct for quantity-based
                      }
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
            onClick={handleSubmit}
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
