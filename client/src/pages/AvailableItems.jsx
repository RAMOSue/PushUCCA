import { useEffect, useState, useContext } from "react";
import axios from "axios";
import { UserContext } from "../../context/userContext";
import { BorrowingContext } from "../../context/BorrowingContext";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";

export default function AvailableItems() {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  const { user, loading } = useContext(UserContext);
  const { cart, addToCart, availableItems, refreshAvailableItems } =
    useContext(BorrowingContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const res = await axios.get("/api/inventory");
      const mappedItems = res.data.map((item) => {
        const isInstrument = item.category?.toLowerCase() === "instrument";
        const isAccessory = item.garment_type?.toLowerCase() === "accessory";
        const isGrouped = !isAccessory && !isInstrument;

        return {
          ...item,
          total_available: isGrouped
            ? undefined
            : item.units?.filter((u) => u.status === "available").length ??
              item.quantity ??
              item.available_quantity ??
              0,
          units: item.units?.filter((u) => u.status === "available") || [],
        };
      });
      setItems(mappedItems);
    } catch (err) {
      console.error("❌ Failed to fetch items:", err.message);
      toast.error("Failed to load available items");
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [refreshAvailableItems]);

  const openModal = (item) => {
    setSelectedItem(item);
    setSelectedSize("");
    setSelectedQuantity(1);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setSelectedSize("");
    setSelectedQuantity(1);
  };

  const handleAddToCartFromModal = async () => {
    if (!selectedItem) return;

    const isAccessory = selectedItem.garment_type?.toLowerCase() === "accessory";
    const isInstrument = selectedItem.category?.toLowerCase() === "instrument";
    const isGrouped = !isAccessory && !isInstrument;

    try {
      if (isGrouped) {
        if (!selectedSize) {
          toast.error("Please select a size");
          return;
        }
        const unit = selectedItem.units.find(
          (u) => u.size?.toLowerCase() === selectedSize.toLowerCase()
        );
        if (!unit) {
          toast.error("No available unit for this size");
          return;
        }

        await addToCart({
          unitId: unit.id,
          itemId: selectedItem.id,
          name: selectedItem.name,
          size: selectedSize,
          image_url: selectedItem.image_url,
          garment_type: selectedItem.garment_type,
          category: selectedItem.category,
          total_available: selectedItem.total_available,
        });

        setItems((prev) =>
          prev.map((it) =>
            it.id === selectedItem.id
              ? { ...it, units: it.units.filter((u) => u.id !== unit.id) }
              : it
          )
        );
      } else {
        // Accessories & Instruments: pick first N available units
        const availableUnits = selectedItem.units.slice(0, selectedQuantity);
        if (availableUnits.length < selectedQuantity) {
          toast.error("Not enough available units to fulfill quantity");
          return;
        }

        for (const unit of availableUnits) {
          await addToCart({
            unitId: unit.id,
            itemId: selectedItem.id,
            name: selectedItem.name,
            size: "", 
            image_url: selectedItem.image_url,
            garment_type: selectedItem.garment_type,
            category: selectedItem.category,
            total_available: selectedItem.total_available,
          });
        }

        setItems((prev) =>
          prev.map((it) =>
            it.id === selectedItem.id
              ? {
                  ...it,
                  units: it.units.filter((u) => !availableUnits.some((sel) => sel.id === u.id)),
                }
              : it
          )
        );
      }

      toast.success(
        `${selectedItem.name}${isGrouped ? ` (${selectedSize})` : ""} added to cart`
      );
      closeModal();
    } catch (err) {
      console.error("❌ Failed to add to cart:", err.message);
      toast.error("Failed to add to cart");
    }
  };

  if (loading || loadingItems) return <div className="text-center mt-10">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-600">Available Items</h1>
        <Link
          to="/scan"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          📷 Scan to Borrow
        </Link>
      </div>

      {items.length === 0 ? (
        <p>No items found in inventory.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const isInstrument = item.category?.toLowerCase() === "instrument";
              const isAccessory = item.garment_type?.toLowerCase() === "accessory";
              const isGrouped = !isAccessory && !isInstrument;

              const qtySmall =
                item.units?.filter((u) => u.size?.toLowerCase() === "small").length ?? 0;
              const qtyMedium =
                item.units?.filter((u) => u.size?.toLowerCase() === "medium").length ?? 0;
              const qtyLarge =
                item.units?.filter((u) => u.size?.toLowerCase() === "large").length ?? 0;

              const totalQty = isGrouped
                ? qtySmall + qtyMedium + qtyLarge
                : item.units?.length ?? item.total_available ?? 0;

              return (
                <div
                  key={item.id}
                  className="bg-white p-4 shadow-md rounded border border-gray-200 cursor-pointer"
                  onClick={() => openModal(item)}
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-40 object-cover mb-2 rounded"
                    />
                  )}
                  <h2 className="text-lg font-bold text-gray-800">{item.name}</h2>
                  <p className="text-gray-600 capitalize">Group: {item.collection_group}</p>
                  <p className="text-gray-600 capitalize mb-1">
                    Category: {isAccessory ? "Accessory" : isInstrument ? "Instrument" : item.category || "N/A"}
                  </p>
                  <div className="text-sm text-gray-700">
                    {isGrouped ? (
                      <>
                        <p>Small: {qtySmall}</p>
                        <p>Medium: {qtyMedium}</p>
                        <p>Large: {qtyLarge}</p>
                      </>
                    ) : (
                      <p>Quantity: {totalQty}</p>
                    )}
                  </div>
                  <p className={`mt-1 font-medium ${totalQty > 0 ? "text-green-700" : "text-red-600"}`}>
                    {totalQty > 0 ? "✅ Available" : "❌ Out of Stock"}
                  </p>
                </div>
              );
            })}
          </div>

          <Link
            to="/borrow-cart"
            className="mt-6 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            🛒 View Cart
          </Link>
        </>
      )}

      {selectedItem &&
        (() => {
          const isAccessory = selectedItem.garment_type?.toLowerCase() === "accessory";
          const isInstrument = selectedItem.category?.toLowerCase() === "instrument";

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
              <div className="bg-white rounded p-6 w-80 relative">
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
                  onClick={closeModal}
                >
                  ✖
                </button>
                <h2 className="text-xl font-bold mb-4">{selectedItem.name}</h2>

                {isAccessory || isInstrument ? (
                  <>
                    <p className="mb-2">Select quantity:</p>
                    <input
                      type="number"
                      min={1}
                      max={selectedItem.units?.length ?? selectedItem.total_available ?? 0}
                      value={selectedQuantity}
                      onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                      className="w-full border px-2 py-1 rounded mb-4"
                    />
                  </>
                ) : (
                  <>
                    <p className="mb-2">Select size:</p>
                    <div className="flex gap-2 mb-4">
                      {["small", "medium", "large"].map((size) => {
                        const available = selectedItem.units?.filter(
                          (u) => u.size?.toLowerCase() === size
                        ).length ?? 0;
                        return (
                          <button
                            key={size}
                            disabled={available === 0}
                            className={`px-3 py-1 rounded border ${selectedSize === size ? "bg-blue-600 text-white" : "bg-gray-100"} ${
                              available === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-200"
                            }`}
                            onClick={() => setSelectedSize(size)}
                          >
                            {size.charAt(0).toUpperCase() + size.slice(1)} ({available})
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                <button
                  onClick={handleAddToCartFromModal}
                  className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
