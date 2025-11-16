// src/pages/AvailableItems.jsx
import { useEffect, useState, useContext } from "react";
import axios from "axios";
import { UserContext } from "../../context/userContext";
import { BorrowingContext } from "../../context/BorrowingContext";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, X } from "lucide-react";
import NotificationBell from "../components/NotificationBell";

export default function AvailableItems() {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
   const [selectedGroup, setSelectedGroup] = useState("Dulimbay");

  const { user, loading } = useContext(UserContext);
  const { addToCart, refreshAvailableItems } = useContext(BorrowingContext);
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
      } else {
        const availableUnits = selectedItem.units.slice(0, selectedQuantity);
        if (availableUnits.length < selectedQuantity) {
          toast.error("Not enough available units");
          return;
        }

        for (const unit of availableUnits) {
          await addToCart({
            unitId: unit.id,
            itemId: selectedItem.id,
            name: selectedItem.name,
            image_url: selectedItem.image_url,
            garment_type: selectedItem.garment_type,
            category: selectedItem.category,
          });
        }
      }

      toast.success(`${selectedItem.name} added to cart`);
      closeModal();
    } catch (err) {
      console.error("❌ Failed to add to cart:", err.message);
      toast.error("Failed to add to cart");
    }
  };

  if (loading || loadingItems)
    return <div className="text-center mt-10 text-gray-500">Loading...</div>;
  if (!user) return null;
  // For admin and staff show a three-column management view grouped by collection group (Dulimbay, Budjong, Kayam)
   if (user?.role === 'admin' || user?.role === 'staff') {
     const GROUP_TABS = ["Dulimbay", "Budjong", "Kayam"];
 
     const groupFor = (item) => (item.collection_group || item.group || '').toString().trim() || 'Uncategorized';
 
     const itemsInSelectedGroup = items.filter((it) =>
       groupFor(it).toLowerCase() === selectedGroup.toLowerCase()
     );
 
     const instruments = itemsInSelectedGroup.filter(
       (it) => (it.category || '').toString().toLowerCase() === 'instrument'
     );
     const costumes = itemsInSelectedGroup.filter(
       (it) => (it.category || '').toString().toLowerCase() !== 'instrument'
     );
 
     return (
       <div className="bg-gray-50 min-h-screen pb-24">
         <div className="p-3 flex justify-between items-center sticky top-0 bg-white z-10 shadow-sm">
           <h1 className="text-lg font-bold text-blue-600">UCCA Available Items</h1>
           <Link to="/staff/manage-inventory" className="text-sm text-gray-700 underline">Manage Inventory</Link>
         </div>
 
        <div className="max-w-6xl mx-auto p-4">
          {/* Group filter tabs */}
          <div className="flex gap-2 mb-4">
            {GROUP_TABS.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={`px-3 py-1 rounded text-sm ${selectedGroup === g ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                type="button"
              >
                {g}
              </button>
            ))}
          </div>

          {/* For Dulimbay and Budjong show two columns: Costumes | Instruments. For Kayam show instruments only. */}
          {selectedGroup.toLowerCase() === 'kayam' ? (
            <section>
              <h2 className="text-md font-semibold text-gray-800 mb-3">Instruments</h2>
              <div className="bg-white rounded shadow divide-y">
                {instruments.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No instruments in this group.</div>
                ) : (
                  instruments.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3">
                      <img src={item.image_url} alt="" className="w-20 h-20 object-cover rounded" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{item.name}</div>
                        <div className="text-xs text-gray-500">Instrument</div>
                        <div className="text-sm text-gray-600 mt-1">Available: {item.total_available ?? (item.units?.length ?? 0)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openModal(item)} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded">View</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h2 className="text-md font-semibold text-gray-800 mb-3">Costumes</h2>
                <div className="bg-white rounded shadow divide-y">
                  {costumes.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No costumes in this group.</div>
                  ) : (
                    costumes.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3">
                        <img src={item.image_url} alt="" className="w-20 h-20 object-cover rounded" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.category || 'Costume'}</div>
                          <div className="text-sm text-gray-600 mt-1">Available: {item.total_available ?? (item.units?.length ?? 0)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openModal(item)} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded">View</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-md font-semibold text-gray-800 mb-3">Instruments</h2>
                <div className="bg-white rounded shadow divide-y">
                  {instruments.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No instruments in this group.</div>
                  ) : (
                    instruments.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3">
                        <img src={item.image_url} alt="" className="w-20 h-20 object-cover rounded" />
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{item.name}</div>
                          <div className="text-xs text-gray-500">Instrument</div>
                          <div className="text-sm text-gray-600 mt-1">Available: {item.total_available ?? (item.units?.length ?? 0)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openModal(item)} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded">View</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* keep modal */}
          <AnimatePresence>
            {selectedItem && (
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 p-5"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-800">{selectedItem.name}</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
                </div>
                <div className="space-y-3">
                  {selectedItem.image_url && (
                    <img src={selectedItem.image_url} alt={selectedItem.name} className="w-full h-48 object-cover rounded-lg" />
                  )}
                  <div className="text-sm text-gray-700">Category: {selectedItem.category || '—'}</div>
                  <div className="text-sm text-gray-700">Available units: {selectedItem.total_available ?? (selectedItem.units?.length ?? 0)}</div>
                  {selectedItem.description && <div className="text-sm text-gray-700">{selectedItem.description}</div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Default borrower view (unchanged)
  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* Top bar */}
      <div className="p-3 flex justify-between items-center sticky top-0 bg-white z-10 shadow-sm">
        <h1 className="text-lg font-bold text-blue-600">Available Items</h1>
        {user?.role === "borrower" && (
          <NotificationBell />
        )}
      </div>

      {/* Item list */}
      <div className="flex flex-col gap-3 mt-3 px-2">
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
              onClick={() => openModal(item)}
              className="bg-white rounded-xl shadow hover:shadow-md active:scale-95 transition transform overflow-hidden cursor-pointer"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-56 object-cover"
                />
              )}
              <div className="p-3">
                <h2 className="text-lg font-semibold text-gray-800 truncate">
                  {item.name}
                </h2>
                <p className="text-sm text-gray-500 capitalize">
                  {isAccessory
                    ? "Accessory"
                    : isInstrument
                    ? "Instrument"
                    : item.category}
                </p>
                <p
                  className={`mt-1 font-medium ${
                    totalQty > 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {totalQty > 0
                    ? `✅ ${totalQty} Available`
                    : "❌ Out of Stock"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom sheet modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 p-5"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">
                {selectedItem.name}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={22} />
              </button>
            </div>

            <div className="space-y-3">
              {selectedItem.image_url && (
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}

              {/* Size or Quantity */}
              {selectedItem.garment_type?.toLowerCase() === "accessory" ||
              selectedItem.category?.toLowerCase() === "instrument" ? (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Select Quantity:</p>
                  <input
                    type="number"
                    min={1}
                    max={selectedItem.units?.length ?? 1}
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-center"
                  />
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Select Size:</p>
                  <div className="flex justify-around">
                    {["small", "medium", "large"].map((size) => {
                      const available =
                        selectedItem.units?.filter(
                          (u) => u.size?.toLowerCase() === size
                        ).length ?? 0;
                      return (
                        <button
                          key={size}
                          disabled={available === 0}
                          onClick={() => setSelectedSize(size)}
                          className={`px-3 py-2 rounded-lg border text-sm capitalize ${
                            selectedSize === size
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-gray-100 text-gray-700 border-gray-300"
                          } ${
                            available === 0
                              ? "opacity-50 cursor-not-allowed"
                              : "active:scale-95"
                          }`}
                        >
                          {size} ({available})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={handleAddToCartFromModal}
                className="w-full mt-4 bg-blue-600 text-white py-2.5 rounded-lg active:scale-95"
              >
                Add to Cart
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
