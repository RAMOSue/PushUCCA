  
  // ManageInventory.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import UnitModal from "./UnitModal"; // ✅ CORRECT



/* -------------------------------------------------------------- */
/* Static Dropdown Option Values                                  */
/* -------------------------------------------------------------- */
const genderOptions = ["Male", "Female", "Unisex"];
const garmentTypeOptions = [
  "Upper",
  "Lower",
  "Full-body",
  "Headwear",
  "Footwear",
  "Outerwear",
  "Accessory",
];

/* Instrument dropdown options */
const classificationOptions = [
  "Aerophones",
  "Chordophones",
  "Idiophones",
  "Membranophones",
  "Electrophones",
];
const instrumentCategoryOptions = ["Classical", "Indigenous"];

/* -------------------------------------------------------------- */
/* Field definitions (raw lists; will be filtered per group)      */
/* -------------------------------------------------------------- */
const costumeFieldDefsAll = [
  { key: "cultural_group", label: "Cultural Group" },
  { key: "dance_type", label: "Dance Type" },
  { key: "garment_type", label: "Garment Type", dropdown: garmentTypeOptions },
  { key: "gender", label: "Gender", dropdown: genderOptions },
  { key: "color", label: "Color" },
  { key: "date_acquired", label: "Date Acquired", type: "date" },
  { key: "image_url", label: "Upload Image", type: "file" },
];

/* Instrument fields */
const instrumentFields = [
  { key: "instrument_classification", label: "Classification", dropdown: classificationOptions },
  { key: "instrument_category", label: "Instrument Category", dropdown: instrumentCategoryOptions },
  { key: "date_acquired", label: "Date Acquired", type: "date" },
  { key: "image_url", label: "Upload Image", type: "file" },
];

/* -------------------------------------------------------------- */
const GROUP_TABS = ["Dulimbay", "Budjong", "Kayam"];

/* -------------------------------------------------------------- */
function buildEmptyItem(group = "") {
  return {
    name: "",
    collection_group: group,
    category: "",
    quantity: "",
    cultural_group: "",
    dance_type: "",
    garment_type: "",
    gender: "",
    color: "",
    date_acquired: "",
    instrument_classification: "",
    instrument_category: "",
    qty_small: "",
    qty_medium: "",
    qty_large: "",
    image_url: "",
  };
}

function normalize(str) {
  return (str || "").toString().trim().toLowerCase();
}

function mapItem(row) {
  return {
    ...row,
    units: row.units ?? [],  // ✅ ADD THIS LINE
    collection_group: row.collection_group || row.group || "",
    qty_small: Number.isFinite(row.qty_small) ? row.qty_small : Number(row.qty_small) || 0,
    qty_medium: Number.isFinite(row.qty_medium) ? row.qty_medium : Number(row.qty_medium) || 0,
    qty_large: Number.isFinite(row.qty_large) ? row.qty_large : Number(row.qty_large) || 0,
  };
}



function categoryOptionsForGroup(grp) {
  return normalize(grp) === "kayam" ? ["instrument"] : ["costume", "instrument"];
}

/* -------------------------------------------------------------- */
export default function ManageInventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedGroup, setSelectedGroup] = useState("Dulimbay");
  const [newItem, setNewItem] = useState(buildEmptyItem("Dulimbay"));
  const [editingItem, setEditingItem] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const [culturalGroups, setCulturalGroups] = useState([]);
  const [danceTypesByGroup, setDanceTypesByGroup] = useState({});
  const [openQRItemId, setOpenQRItemId] = useState(null);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [selectedItemForQR, setSelectedItemForQR] = useState(null);


  /* ------------------------------------------------------------ */
  const rebuildCulturalAndDanceMaps = useCallback((data) => {
    const cSet = new Set();
    const dMap = {};
    data.forEach((i) => {
      if (i.category !== "costume") return;
      const cg = i.cultural_group?.trim();
      if (!cg) return;
      cSet.add(cg);
      if (!dMap[cg]) dMap[cg] = new Set();
      if (i.dance_type?.trim()) dMap[cg].add(i.dance_type.trim());
    });
    setCulturalGroups([...cSet]);
    const obj = {};
    Object.keys(dMap).forEach((cg) => {
      obj[cg] = [...dMap[cg]];
    });
    setDanceTypesByGroup(obj);
  }, []);

  /* ------------------------------------------------------------ */
const fetchItems = useCallback(async () => {
  try {
    const res = await axios.get("/api/inventory");

    const mapped = Array.isArray(res.data)
      ? res.data.map((item) => {
          const mappedItem = mapItem(item);

          // Sort units by size order (Small → Medium → Large → Accessory) then by unit number
          const sizeOrder = { small: 1, medium: 2, large: 3, accessory: 4 };

          if (Array.isArray(mappedItem.units)) {
            mappedItem.units.sort((a, b) => {
              const sizeA = sizeOrder[a.size?.toLowerCase()] || 99;
              const sizeB = sizeOrder[b.size?.toLowerCase()] || 99;

              if (sizeA !== sizeB) return sizeA - sizeB;

              // If both sizes are the same, compare by unit number (numeric)
              const numA = parseInt(a.unit_number, 10) || 0;
              const numB = parseInt(b.unit_number, 10) || 0;
              return numA - numB;
            });
          }

          return mappedItem;
        })
      : [];

    setItems(mapped);
    rebuildCulturalAndDanceMaps(mapped);
  } catch (err) {
    console.error("❌ Failed to fetch inventory:", err.message);
    toast.error("Failed to load inventory");
  } finally {
    setLoading(false);
  }
}, [rebuildCulturalAndDanceMaps]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /* ------------------------------------------------------------ */
  const activeFieldDefs = useMemo(() => {
    if (newItem.category === "costume") {
      let f = costumeFieldDefsAll;
      if (selectedGroup === "Dulimbay") {
        f = f.filter((x) => x.key !== "color");
      }
      if (selectedGroup === "Budjong") {
        f = f.filter((x) => x.key !== "cultural_group" && x.key !== "dance_type");
      }
      return f;
    }
    if (newItem.category === "instrument") return instrumentFields;
    return [];
  }, [newItem.category, selectedGroup]);

  const filteredItems = useMemo(() => {
    const sg = normalize(selectedGroup);
    return items.filter((i) => normalize(i.collection_group) === sg);
  }, [items, selectedGroup]);

  
  const upsertCulturalGroup = (cgRaw) => {
    const cg = cgRaw?.trim();
    if (!cg) return;
    setCulturalGroups((prev) => (prev.includes(cg) ? prev : [...prev, cg]));
    setDanceTypesByGroup((prev) => ({ ...prev, [cg]: prev[cg] || [] }));
  };

  const upsertDanceType = (cgRaw, dtRaw) => {
    const cg = cgRaw?.trim();
    const dt = dtRaw?.trim();
    if (!cg || !dt) return;
    setDanceTypesByGroup((prev) => {
      const existing = prev[cg] || [];
      return existing.includes(dt)
        ? prev
        : { ...prev, [cg]: [...existing, dt] };
    });
  };

  const handleCulturalGroupChange = (val) => {
    upsertCulturalGroup(val);
    setNewItem((ni) => {
      const cgPrev = ni.cultural_group;
      const cgNew = val;
      let dance_type = ni.dance_type;
      if (cgPrev !== cgNew) {
        const allowed = danceTypesByGroup[cgNew] || [];
        if (!allowed.includes(dance_type)) dance_type = "";
      }
      return { ...ni, cultural_group: cgNew, dance_type };
    });
  };

  const handleDanceTypeChange = (val) => {
    upsertDanceType(newItem.cultural_group, val);
    setNewItem((ni) => ({ ...ni, dance_type: val }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const previewURL = URL.createObjectURL(file);
      setPreviewImage(previewURL);
      setNewItem((ni) => ({ ...ni, image_file: file }));
    }
  };

  const parseQty = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const costumeTotal = (ni) =>
  parseQty(ni.qty_small) + parseQty(ni.qty_medium) + parseQty(ni.qty_large);

const handleSave = async (e) => {
  e.preventDefault();
  const grp = newItem.collection_group || selectedGroup;
  const category = newItem.category;

  if (!grp || !category) {
    toast.error("Please choose group & category.");
    return;
  }

  if (normalize(grp) === "kayam" && category !== "instrument") {
    toast.error("Kayam items must be Instruments.");
    return;
  }

  if (!newItem.name?.trim()) {
    toast.error("Item name required.");
    return;
  }

  let totalQty;
  let payload = { ...newItem, collection_group: grp };

  if (category === "costume") {
    if (newItem.garment_type?.toLowerCase() === "accessory") {
      const q = parseQty(newItem.quantity);
      if (q <= 0) {
        toast.error("Quantity required for accessories.");
        return;
      }
      totalQty = q;
      payload = {
        ...payload,
        quantity: q,
        qty_small: 0,
        qty_medium: 0,
        qty_large: 0,
      };
    } else {
      const s = parseQty(newItem.qty_small);
      const m = parseQty(newItem.qty_medium);
      const l = parseQty(newItem.qty_large);
      totalQty = s + m + l;
      if (totalQty <= 0) {
        toast.error("At least one size quantity required.");
        return;
      }
      payload = {
        ...payload,
        quantity: totalQty,
        qty_small: s,
        qty_medium: m,
        qty_large: l,
      };
    }
  } else {
    const q = parseQty(newItem.quantity);
    if (q <= 0) {
      toast.error("Quantity is required.");
      return;
    }
    totalQty = q;
    payload = {
      ...payload,
      quantity: q,
      qty_small: 0,
      qty_medium: 0,
      qty_large: 0,
    };
  }

  // Image Upload
  if (newItem.image_file) {
    const formData = new FormData();
    formData.append("image", newItem.image_file);

    try {
      const uploadRes = await axios.post("/api/inventory/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      payload.image_url = uploadRes.data.imageUrl;
    } catch (err) {
      console.error("Image upload failed:", err);
      toast.error("Image upload failed.");
      return;
    }
  }

  const existingItem = items.find(
    (i) =>
      normalize(i.name) === normalize(newItem.name) &&
      normalize(i.collection_group) === normalize(grp)
  );

  try {
    if (existingItem && !editingItem) {
      // Update existing item
      if (category === "costume") {
        if (newItem.garment_type?.toLowerCase() === "accessory") {
          await axios.put(`/api/inventory/${existingItem.id}`, {
            ...existingItem,
            quantity: (existingItem.quantity || 0) + totalQty,
          });
        } else {
          await axios.put(`/api/inventory/${existingItem.id}`, {
            ...existingItem,
            quantity: (existingItem.quantity || 0) + totalQty,
            qty_small: (existingItem.qty_small || 0) + payload.qty_small,
            qty_medium: (existingItem.qty_medium || 0) + payload.qty_medium,
            qty_large: (existingItem.qty_large || 0) + payload.qty_large,
          });
        }
      } else {
        await axios.put(`/api/inventory/${existingItem.id}`, {
          ...existingItem,
          quantity: (existingItem.quantity || 0) + totalQty,
        });
      }

      toast.success(`Updated quantity for ${existingItem.name}`);

      // ✅ Always use UUID (server ensures this is the `id` field)
      await axios.post(`/api/inventory/${existingItem.id}/generate-units`, {
        newQty: totalQty,
        garment_type: newItem.garment_type || null,
      });

    } else if (editingItem) {
      // Edit existing item
      await axios.put(`/api/inventory/${editingItem.id}`, payload);
      toast.success("Item updated successfully");

    } else {
      // Create new item
      const res = await axios.post("/api/inventory", payload);

      // ✅ Use standardized UUID from server
      const newItemId = res?.data?.newItemId;
      if (!newItemId) {
        throw new Error("Invalid newItemId received from server");
      }

      toast.success("Item added successfully");

      // Generate units for new item
      await axios.post(`/api/inventory/${newItemId}/generate-units`, {
        newQty: totalQty,
        garment_type: newItem.garment_type || null,
      });
    }

    // Reset form
    setNewItem(buildEmptyItem(selectedGroup));
    setPreviewImage(null);
    setEditingItem(null);
    setShowAdvanced(false);
    fetchItems();
  } catch (err) {
    console.error("❌ Save error:", err.response?.data || err.message);
    toast.error(err?.response?.data?.error || "Failed to save item");
  }
};








  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      await axios.delete(`/api/inventory/${id}`);
      toast.success("Item deleted");
      fetchItems();
    } catch (err) {
      console.error("❌ Delete error:", err.message);
      toast.error("Failed to delete item");
    }
  };

  const handleEdit = (item) => {
    const grp = item.collection_group ?? item.group ?? "";
    setEditingItem(item);
    setSelectedGroup(grp || "Dulimbay");

    if (item.category === "costume" && grp !== "Budjong") {
      upsertCulturalGroup(item.cultural_group);
      upsertDanceType(item.cultural_group, item.dance_type);
    }

    const coercedCategory =
      normalize(grp) === "kayam" && item.category !== "instrument"
        ? "instrument"
        : item.category;

    setNewItem({
      ...buildEmptyItem(grp),
      ...item,
      collection_group: grp,
      category: coercedCategory,
      quantity: item.quantity ?? "",
      qty_small: item.qty_small ?? "",
      qty_medium: item.qty_medium ?? "",
      qty_large: item.qty_large ?? "",
      date_acquired: item.date_acquired ? item.date_acquired.slice(0, 10) : "",
      image_url: item.image_url || "",
    });
    setPreviewImage(item.image_url || null);
    setShowAdvanced(true);
  };

  const downloadQRCode = (qrCodeUrl, name) => {
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `QR-${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelectGroup = (grp) => {
    setSelectedGroup(grp);
    if (!editingItem) {
      const fresh = buildEmptyItem(grp);
      if (normalize(grp) === "kayam") {
        fresh.category = "instrument";
      }
      setNewItem(fresh);
      setShowAdvanced(false);
    }
  };

  const categoryOptions = categoryOptionsForGroup(selectedGroup);

  const genericDetailOptions = (fieldKey) => {
    const values = items.map((i) => i[fieldKey]).filter(Boolean);
    return [...new Set(values)];
  };

  const currentDanceOptions = danceTypesByGroup[newItem.cultural_group] || [];

  if (loading) return <div className="text-center mt-10">Loading inventory...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white shadow rounded mt-6">
      <h1 className="text-3xl font-bold text-purple-600 mb-6">Manage Inventory</h1>

      {/* Group Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {GROUP_TABS.map((grp) => (
          <button
            key={grp}
            onClick={() => handleSelectGroup(grp)}
            className={`px-4 py-2 rounded text-sm ${
              selectedGroup === grp
                ? "bg-purple-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            type="button"
          >
            {grp}
          </button>
        ))}
      </div>

      

      {/* Add/Edit Form */}
<form onSubmit={handleSave} className="mb-6 space-y-4">
  <div className="flex flex-wrap gap-4 items-end">
    {/* Category */}
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-600">Category</label>
      <select
        value={newItem.category}
        onChange={(e) =>
          setNewItem({
            ...newItem,
            category: e.target.value,
            garment_type: e.target.value === "costume" ? "" : null,
          })
        }
        className="border rounded px-3 py-2 w-40"
        required
        disabled={normalize(selectedGroup) === "kayam"}
      >
        <option value="">Select Category</option>
        {categoryOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </option>
        ))}
      </select>
    </div>

    {/* Item Name */}
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-600">Item Name</label>
      <input
        list="item-name-options"
        value={newItem.name}
        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
        placeholder="Type or select item"
        className="border rounded px-3 py-2 w-48"
        required
      />
      <datalist id="item-name-options">
        {[...new Set(items.map((i) => i.name).filter(Boolean))].map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </div>

    {/* Garment Type (only for costume category) */}
    {newItem.category === "costume" && (
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600">Garment Type</label>
        <select
  value={newItem.garment_type || ""}
  onChange={(e) => {
    const newType = e.target.value;
    setNewItem({
      ...newItem,
      garment_type: newType,
      ...(newType === "accessory"
        ? { quantity: "", qty_small: null, qty_medium: null, qty_large: null }
  : { quantity: "", qty_small: 0, qty_medium: 0, qty_large: 0 })
    });
  }}
  className="border rounded px-3 py-2 w-40"
  required
>
          <option value="">Select Type</option>
          {garmentTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
    )}

    {/* Quantity / Size Fields */}
    {newItem.category === "costume" ? (
       newItem.garment_type?.toLowerCase() === "accessory" ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600">Quantity</label>
          <input
            type="number"
            min="0"
            value={newItem.quantity}
            onChange={(e) =>
              setNewItem({ ...newItem, quantity:parseInt(e.target.value) || 0 })
            }
            className="border rounded px-3 py-2 w-24"
            required
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">Small Qty</label>
            <input
              type="number"
              min="0"
              value={newItem.qty_small}
              onChange={(e) =>
                setNewItem({ ...newItem, qty_small: e.target.value })
              }
              className="border rounded px-3 py-2 w-24"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">Medium Qty</label>
            <input
              type="number"
              min="0"
              value={newItem.qty_medium}
              onChange={(e) =>
                setNewItem({ ...newItem, qty_medium: e.target.value })
              }
              className="border rounded px-3 py-2 w-24"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600">Large Qty</label>
            <input
              type="number"
              min="0"
              value={newItem.qty_large}
              onChange={(e) =>
                setNewItem({ ...newItem, qty_large: e.target.value })
              }
              className="border rounded px-3 py-2 w-24"
            />
          </div>
        </>
      )
    ) : newItem.category === "instrument" ? (
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600">Quantity</label>
        <input
          type="number"
          min="0"
          value={newItem.quantity}
          onChange={(e) =>
            setNewItem({ ...newItem, quantity:parseInt(e.target.value) || 0 })
          }
          className="border rounded px-3 py-2 w-24"
          required
        />
      </div>
    ) : null}

    {/* Edit Group */}
    {editingItem && (
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600">Group</label>
        <select
          value={newItem.group}
          onChange={(e) => {
            const grp = e.target.value;
            const forced =
              normalize(grp) === "kayam" ? { category: "instrument" } : {};
            setNewItem((ni) => ({ ...ni, group: grp, ...forced }));
          }}
          className="border rounded px-3 py-2 w-40"
          required
        >
          <option value="">Select Group</option>
          {GROUP_TABS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
    )}
  </div>

  {/* Buttons */}
  <div className="flex flex-wrap gap-3">
    <button
      type="button"
      onClick={() => setShowAdvanced((v) => !v)}
      className="bg-gray-200 text-gray-700 px-3 py-2 rounded hover:bg-gray-300 text-sm"
    >
      {showAdvanced ? "Hide Details" : "Show Details"}
    </button>

    <button
      type="submit"
      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
    >
      {editingItem ? "Update" : "Add"}
    </button>

    {editingItem && (
      <button
        type="button"
        onClick={() => {
          setEditingItem(null);
          const fresh = buildEmptyItem(selectedGroup);
          if (normalize(selectedGroup) === "kayam")
            fresh.category = "instrument";
          setNewItem(fresh);
          setPreviewImage(null);
          setShowAdvanced(false);
        }}
        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
      >
        Cancel
      </button>
    )}
  </div>
</form>

      {/* Advanced Fields */}
      {showAdvanced && (
        <div className="mb-8 p-4 border rounded bg-gray-50 w-full">
          <h2 className="font-semibold mb-3 text-gray-700">
            {newItem.category === "costume"
              ? "Costume Details"
              : newItem.category === "instrument"
              ? "Instrument Details"
              : "Additional Details"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {activeFieldDefs.filter((f) => f.key !== "garment_type").map((f) => {
              if (f.key === "image_url") {
                return (
                  <div key="image_upload" className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">{f.label}</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="border rounded px-2 py-1"
                    />
                    {previewImage && (
                      <img
                        src={previewImage}
                        alt="Preview"
                        className="mt-2 w-24 h-24 object-cover border"
                      />
                    )}
                  </div>
                );
              }

              if (f.key === "cultural_group") {
                return (
                  <div key={f.key} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">{f.label}</label>
                    <input
                      list="cultural-group-options"
                      value={newItem.cultural_group || ""}
                      onChange={(e) => handleCulturalGroupChange(e.target.value)}
                      placeholder="Type or select"
                      className="border rounded px-2 py-1"
                    />
                    <datalist id="cultural-group-options">
                      {culturalGroups.map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </div>
                );
              }
              if (f.key === "dance_type") {
                return (
                  <div key={f.key} className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">{f.label}</label>
                    <input
                      list="dance-type-options"
                      value={newItem.dance_type || ""}
                      onChange={(e) => handleDanceTypeChange(e.target.value)}
                      placeholder={
                        newItem.cultural_group ? "Type or select" : "Select cultural group first"
                      }
                      disabled={!newItem.cultural_group}
                      className="border rounded px-2 py-1 disabled:bg-gray-100"
                    />
                    <datalist id="dance-type-options">
                      {currentDanceOptions.map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </div>
                );
              }

              return (
                <div key={f.key} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">{f.label}</label>
                  {f.type === "date" ? (
                    <input
                      type="date"
                      value={newItem[f.key] || ""}
                      onChange={(e) => setNewItem({ ...newItem, [f.key]: e.target.value })}
                      className="border rounded px-2 py-1"
                    />
                  ) : f.dropdown ? (
                    <select
                      value={newItem[f.key] || ""}
                      onChange={(e) => setNewItem({ ...newItem, [f.key]: e.target.value })}
                      className="border rounded px-2 py-1"
                    >
                      <option value="">Select {f.label}</option>
                      {f.dropdown.map((val) => (
                        <option key={val} value={val}>
                          {val}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      list={`${f.key}-options`}
                      value={newItem[f.key] || ""}
                      onChange={(e) => setNewItem({ ...newItem, [f.key]: e.target.value })}
                      className="border rounded px-2 py-1"
                    />
                  )}
                  {!f.dropdown && !f.type && (
                    <datalist id={`${f.key}-options`}>
                      {genericDetailOptions(f.key).map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inventory Table */}
<div className="overflow-x-auto">
  <table className="w-full border text-sm">
  <thead>
    <tr className="bg-gray-100 text-xs uppercase tracking-wide">
      <th className="p-2 border text-center">Image</th>
      <th className="p-2 border text-center">Group</th>
      <th className="p-2 border text-center">Category</th>
      <th className="p-2 border text-center">Name</th>
      <th className="p-2 border text-center">Cultural Group</th>
      <th className="p-2 border text-center">Dance Type</th>
      <th className="p-2 border text-center">Qty</th>
      <th className="p-2 border text-center">S</th>
      <th className="p-2 border text-center">M</th>
      <th className="p-2 border text-center">L</th>
      <th className="p-2 border text-center">QR</th>
      <th className="p-2 border text-center">Actions</th>
      <th className="p-2 border text-center">Unit</th>
    </tr>
  </thead>
  <tbody>
    {filteredItems.length === 0 ? (
      <tr>
        <td colSpan={13} className="p-4 text-center text-gray-500">
          No inventory items.
        </td>
      </tr>
    ) : (
      filteredItems
        .map((item) => ({
          ...item,
          units: Array.isArray(item.units) ? item.units : [],
        }))
        .map((item) => {
          const isSizeCostume =
            item.category === "costume" && item.garment_type?.toLowerCase() !== "accessory";
          const grp = item.group ?? item.collection_group ?? "";

          const totalQty = (() => {
            if (!item) return 0;

            if (item.category === "costume") {
              return item.garment_type?.toLowerCase() === "accessory"
                ? item.units.length ?? 0
                : (item.qty_small || 0) + (item.qty_medium || 0) + (item.qty_large || 0);
            }

            // For instruments and other items
            return item.units.length ?? 0;
          })();

          return (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="p-2 border text-center">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt="Item"
                    className="mx-auto w-12 h-12 object-cover border"
                  />
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </td>
              <td className="p-2 border capitalize">{grp || "—"}</td>
              <td className="p-2 border capitalize">{item.category}</td>
              <td className="p-2 border max-w-[12rem] truncate" title={item.description || ""}>
                {item.name}
              </td>
              <td className="p-2 border">{item.cultural_group || "—"}</td>
              <td className="p-2 border">{item.dance_type || "—"}</td>
              <td className="p-2 border text-center">{totalQty}</td>
              <td className="p-2 border text-center">{isSizeCostume ? item.qty_small ?? 0 : 0}</td>
              <td className="p-2 border text-center">{isSizeCostume ? item.qty_medium ?? 0 : 0}</td>
              <td className="p-2 border text-center">{isSizeCostume ? item.qty_large ?? 0 : 0}</td>
              <td className="p-2 border text-center">
                {item.qr_code_url ? (
                  <>
                    <img
                      src={item.qr_code_url}
                      alt="QR Code"
                      className="mx-auto mb-1 w-10 h-10 border"
                    />
                    <button
                      onClick={() => downloadQRCode(item.qr_code_url, item.name)}
                      className="text-blue-500 text-xs underline"
                      type="button"
                    >
                      Download
                    </button>
                  </>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </td>
              <td className="p-2 border text-center space-x-1 whitespace-nowrap">
                <button
                  onClick={() => handleEdit(item)}
                  className="bg-yellow-500 text-white px-2 py-1 rounded text-xs"
                  type="button"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded text-xs"
                  type="button"
                >
                  Del
                </button>
              </td>
              <td className="p-2 border text-center">
                {(item.units.length > 0 ||
                  item.category === "instrument" ||
                  item.garment_type?.toLowerCase() === "accessory") ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItemForQR(item);
                      setUnitModalOpen(true);
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-1 px-2 rounded transition-colors duration-200"
                  >
                    View {item.units.length ?? 0} QR
                  </button>
                ) : (
                  <span className="text-gray-400 text-xs">0</span>
                )}
              </td>
            </tr>
          );
        })
    )}
  </tbody>
</table>


  <UnitModal
    isOpen={unitModalOpen}
    onClose={() => setUnitModalOpen(false)}
    selectedItem={selectedItemForQR}
    onUnitDeleted={fetchItems}
  />
</div>
</div>
  );
}
