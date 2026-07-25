// ManageInventory.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import UnitModal from "./UnitModal";
import PageLayout from "../../components/layout/PageLayout";
import { Package, GridIcon, Music, AlertTriangle, Search, Filter, Plus, QrCode, ChevronRight, ChevronDown, Edit2, Trash2 } from "lucide-react";

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

const classificationOptions = [
  "Aerophones",
  "Chordophones",
  "Idiophones",
  "Membranophones",
  "Electrophones",
];
const instrumentCategoryOptions = ["Classical", "Indigenous"];

/* -------------------------------------------------------------- */
/* Indigenous Dance Data with Groups and Regions                  */
/* -------------------------------------------------------------- */
const indigenousDanceData = [
  { dance: "Pangalay", group: "Tausug, Sama, Yakan", region: "Southern Philippines" },
  { dance: "Linggisan", group: "Sama-Bajau, Tausug", region: "Sulu Archipelago" },
  { dance: "Tutup", group: "Tausug", region: "Sulu" },
  { dance: "Singkil", group: "Maranao", region: "Lanao, Mindanao" },
  { dance: "Kinugsik Kugsik", group: "Manobo (Bukidnon)", region: "Mindanao" },
  { dance: "Amaemaeyatok", group: "Manobo (Agusan)", region: "Mindanao" },
  { dance: "Taming", group: "Subanen", region: "Zamboanga Peninsula" },
  { dance: "Dumendingan", group: "Subanen", region: "Zamboanga Peninsula" },
  { dance: "B'laan Dance", group: "B'laan", region: "South Cotabato" },
  { dance: "Tboli Dances", group: "Tboli", region: "Sarangani" },
  { dance: "Uyaoy", group: "Ifugao", region: "Cordillera" },
  { dance: "Manmanok", group: "Bago / Itneg", region: "Northern Luzon" },
];

/* -------------------------------------------------------------- */
/* Field definitions                                              */
/* -------------------------------------------------------------- */
const costumeFieldDefsAll = [
  { key: "indigenous_dance", label: "Indigenous Dance" },
  { key: "indigenous_group", label: "Indigenous Group" },
  { key: "region", label: "Region" },
  { key: "garment_type", label: "Garment Type", dropdown: garmentTypeOptions },
  { key: "gender", label: "Gender", dropdown: genderOptions },
  { key: "color", label: "Color" },
  { key: "date_acquired", label: "Date Acquired", type: "date" },
  { key: "description", label: "Description", type: "textarea" }, // ✅ ADDED: Description field
  { key: "image_url", label: "Upload Image", type: "file" },
];

const instrumentFields = [
  { key: "instrument_classification", label: "Classification", dropdown: classificationOptions },
  { key: "instrument_type", label: "Instrument Category", dropdown: instrumentCategoryOptions },
  { key: "date_acquired", label: "Date Acquired", type: "date" },
  { key: "description", label: "Description", type: "textarea" }, // ✅ ADDED: Description field
  { key: "image_url", label: "Upload Image", type: "file" },
];

const GROUP_TABS = ["Dulimbay", "Budjong", "Kayam"];

/* -------------------------------------------------------------- */
function buildEmptyItem(group = "") {
  return {
    name: "",
    collection_group: group,
    category: "",
    quantity: "",
    indigenous_group: "",
    indigenous_dance: "",
    region: "",
    garment_type: "",
    gender: "",
    color: "",
    date_acquired: "",
    description: "", // ✅ ADDED: Description field
    instrument_classification: "",
    instrument_type: "",
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
    units: row.units ?? [],
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
  const [indigenousGroups, setIndigenousGroups] = useState([]);
  const [dancesByGroup, setDancesByGroup] = useState({});
  const [openQRItemId, setOpenQRItemId] = useState(null);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [selectedItemForQR, setSelectedItemForQR] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState(null);
  const [formPanelOpen, setFormPanelOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

  /* ------------------------------------------------------------ */
  const rebuildIndigenousAndDanceMaps = useCallback((data) => {
    const gSet = new Set();
    const dMap = {};
    data.forEach((i) => {
      if (i.indigenous_group) gSet.add(i.indigenous_group);
      if (i.indigenous_group && i.indigenous_dance) {
        if (!dMap[i.indigenous_group]) dMap[i.indigenous_group] = new Set();
        dMap[i.indigenous_group].add(i.indigenous_dance);
      }
    });
    setIndigenousGroups([...gSet]);
    const obj = {};
    Object.keys(dMap).forEach((g) => {
      obj[g] = [...dMap[g]];
    });
    setDancesByGroup(obj);
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
      rebuildIndigenousAndDanceMaps(mapped);
    } catch (err) {
      console.error("❌ Failed to fetch inventory:", err.message);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [rebuildIndigenousAndDanceMaps]);

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
        f = f.filter((x) => x.key !== "indigenous_group" && x.key !== "indigenous_dance");
      }
      return f;
    }
    if (newItem.category === "instrument") return instrumentFields;
    return [];
  }, [newItem.category, selectedGroup]);

  const filteredItems = useMemo(() => {
    const sg = normalize(selectedGroup);
    return items.filter((i) => {
      const groupMatch = normalize(i.collection_group) === sg;
      const categoryMatch = !filterCategory || i.category === filterCategory;
      const searchMatch = !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase());
      return groupMatch && categoryMatch && searchMatch;
    });
  }, [items, selectedGroup, filterCategory, searchQuery]);


  const upsertIndigenousGroup = (gRaw) => {
    const g = gRaw?.trim();
    if (!g) return;
    setIndigenousGroups((prev) => (prev.includes(g) ? prev : [...prev, g]));
    setDancesByGroup((prev) => ({ ...prev, [g]: prev[g] || [] }));
  };

  const upsertIndigenousDance = (gRaw, dRaw) => {
    const g = gRaw?.trim();
    const d = dRaw?.trim();
    if (!g || !d) return;
    setDancesByGroup((prev) => {
      const arr = prev[g] || [];
      return { ...prev, [g]: arr.includes(d) ? arr : [...arr, d] };
    });
  };

  const handleIndigenousGroupChange = (val) => {
    upsertIndigenousGroup(val);
    setNewItem((ni) => ({ ...ni, indigenous_group: val }));
  };

  // ✅ NEW: Handler for indigenous dance selection with auto-sync
  const handleIndigenousDanceChange = (danceValue) => {
    const danceData = indigenousDanceData.find(d => d.dance === danceValue);
    
    if (danceData) {
      // Auto-populate group and region
      setNewItem((ni) => ({
        ...ni,
        indigenous_dance: danceValue,
        indigenous_group: danceData.group,
        region: danceData.region
      }));
      
      // Also update the state for indigenous groups and dances
      upsertIndigenousGroup(danceData.group);
      upsertIndigenousDance(danceData.group, danceValue);
    } else {
      // Manual entry - just update dance
      setNewItem((ni) => ({ ...ni, indigenous_dance: danceValue }));
      upsertIndigenousDance(newItem.indigenous_group, danceValue);
    }
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
    // ✅ Build payload WITHOUT image_file (File objects can't be serialized to JSON)
    const { image_file, ...newItemWithoutFile } = newItem;
    let payload = { ...newItemWithoutFile, collection_group: grp };

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

    // ✅ Clean up payload: convert empty strings to null for optional fields
    payload.date_acquired = payload.date_acquired?.trim() || null;
    payload.description = payload.description?.trim() || null;
    payload.indigenous_group = payload.indigenous_group?.trim() || null;
    payload.indigenous_dance = payload.indigenous_dance?.trim() || null;
    payload.region = payload.region?.trim() || null;
    payload.instrument_classification = payload.instrument_classification?.trim() || null;
    payload.instrument_type = payload.instrument_type?.trim() || null;
    payload.color = payload.color?.trim() || null;
    payload.gender = payload.gender?.trim() || null;
    payload.garment_type = payload.garment_type?.trim() || null; // ✅ ADDED: Sanitize garment_type
    payload.collection_group = payload.collection_group?.trim() || payload.collection_group; // ✅ FIX: Don't set to null if empty
    
    // ✅ Ensure quantities are numbers, not strings
    payload.quantity = parseQty(payload.quantity);
    payload.qty_small = parseQty(payload.qty_small);
    payload.qty_medium = parseQty(payload.qty_medium);
    payload.qty_large = parseQty(payload.qty_large);

    // ✅ Remove read-only/derived fields that shouldn't be sent to backend
    delete payload.id;
    delete payload.uuid;
    delete payload.units;
    delete payload.image_file;
    delete payload.qr_code_text;
    delete payload.qr_code_url;
    delete payload.created_at;
    delete payload.updated_at;

    // Image Upload
    if (newItem.image_file) {
      const formData = new FormData();
      formData.append("image", newItem.image_file);

      try {
        const uploadRes = await axios.post("/api/inventory/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true, // ✅ ADDED: Send cookies with request
        });
        payload.image_url = uploadRes.data.imageUrl;
      } catch (err) {
        console.error("Image upload failed:", err);
        toast.error("Image upload failed. Please try again.");
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
            }, { withCredentials: true });
          } else {
            await axios.put(`/api/inventory/${existingItem.id}`, {
              ...existingItem,
              quantity: (existingItem.quantity || 0) + totalQty,
              qty_small: (existingItem.qty_small || 0) + payload.qty_small,
              qty_medium: (existingItem.qty_medium || 0) + payload.qty_medium,
              qty_large: (existingItem.qty_large || 0) + payload.qty_large,
            }, { withCredentials: true });
          }
        } else {
          await axios.put(`/api/inventory/${existingItem.id}`, {
            ...existingItem,
            quantity: (existingItem.quantity || 0) + totalQty,
          }, { withCredentials: true });
        }

        toast.success(`Updated quantity for ${existingItem.name}`);

        // ✅ Always use UUID (server ensures this is the `id` field)
        await axios.post(`/api/inventory/${existingItem.id}/generate-units`, {
          newQty: totalQty,
          garment_type: newItem.garment_type || null,
        }, { withCredentials: true });

      } else if (editingItem) {
        // Edit existing item
        console.log("🔍 DEBUG - Sending payload to backend:", {
          item_id: editingItem.uuid,
          payload_keys: Object.keys(payload),
          payload: payload
        });
        await axios.put(`/api/inventory/${editingItem.uuid}`, payload, { withCredentials: true });
        toast.success("Item updated successfully");

        // ✅ Generate units for edited item (if quantities changed)
        if (category === "costume" || category === "instrument") {
          await axios.post(`/api/inventory/${editingItem.uuid}/generate-units`, {
            newQty: totalQty,
            garment_type: newItem.garment_type || null,
          }, { withCredentials: true });
        }

      } else {
        // Create new item
        const res = await axios.post("/api/inventory", payload, { withCredentials: true });

        // ✅ Use standardized UUID from server
        const newItemId = res?.data?.newItemId;
        if (!newItemId) {
          throw new Error("Invalid newItemId received from server");
        }

        toast.success("Item added successfully");

        // ✅ DO NOT call generate-units here - addInventoryItem already creates all units
        // Calling it again would double the units (10 small qty becomes 20 units)
      }

      // Reset form
      setNewItem(buildEmptyItem(selectedGroup));
      setPreviewImage(null);
      setEditingItem(null);
      setShowAdvanced(false);
      setFormPanelOpen(false);
      fetchItems();
    } catch (err) {
      console.error("❌ Save error - Full Error:", err);
      console.error("❌ Response data:", err.response?.data);
      console.error("❌ Response status:", err.response?.status);
      console.error("❌ Error message:", err.message);
      
      // ✅ Professional error handling - pass through backend's error message if available
      let errorMessage = "Failed to save item";
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error; // Use backend's professional error message
      } else if (err.message?.includes("Network")) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (err.message?.includes("timeout")) {
        errorMessage = "Request timed out. Please try again.";
      }
      
      toast.error(errorMessage);
    }
  };


  const handleDelete = async (uuid) => {
    if (!window.confirm("Are you sure you want to delete this item and ALL its units?")) return;
    try {
      // ✅ CRITICAL: Use UUID to ensure correct item + cascade delete of all units
      console.log(`🗑️ Deleting item with UUID: ${uuid}`);
      await axios.delete(`/api/inventory/${uuid}`, { withCredentials: true });
      toast.success("Item and all associated units deleted successfully");
      fetchItems();
    } catch (err) {
      console.error("❌ Delete error:", err.message);
      toast.error(err?.response?.data?.error || "Failed to delete item");
    }
  };

  const handleEdit = (item) => {
    const grp = item.collection_group ?? item.group ?? "";
    setEditingItem(item);
    setSelectedGroup(grp || "Dulimbay");

    if (item.category === "costume" && grp !== "Budjong") {
      upsertIndigenousGroup(item.indigenous_group);
      upsertIndigenousDance(item.indigenous_group, item.indigenous_dance);
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
      indigenous_group: item.indigenous_group || "",
      indigenous_dance: item.indigenous_dance || "",
      region: item.region || "",
      description: item.description || "", // ✅ ADDED: Include description
    });
    setPreviewImage(item.image_url || null);
    setShowAdvanced(true);
    setFormPanelOpen(true);
  };

  const downloadQRCode = async (qrCodeUrl, name) => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const resolvedUrl = qrCodeUrl?.startsWith("http")
        ? qrCodeUrl
        : `${apiBase}${qrCodeUrl}`;

      const downloadUrl = resolvedUrl?.includes("/qr_codes/") || resolvedUrl?.includes("/uploads/")
        ? `${apiBase}/api/files/download?path=${encodeURIComponent(new URL(resolvedUrl).pathname.replace(/^\/+/, ""))}`
        : resolvedUrl;

      const response = await fetch(downloadUrl, { credentials: "include" });
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `QR-${name}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("❌ Error downloading QR code:", error);
      toast.error("Failed to download QR code");
    }
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
      setFormPanelOpen(false);
    }
  };

  const categoryOptions = categoryOptionsForGroup(selectedGroup);

  const genericDetailOptions = (fieldKey) => {
    const values = items.map((i) => i[fieldKey]).filter(Boolean);
    return [...new Set(values)];
  };

  const currentDanceOptions = dancesByGroup[newItem.indigenous_group] || [];

  // if (loading) return <div className="text-center mt-10">Loading inventory...</div>;
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-on-surface-variant">Loading inventory...</p>
      </div>
    </div>
  );

  return (
    <PageLayout>
      <div className="dark:bg-[#171717]">
        {/* Header Section */}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">Manage Inventory</h1>
          <p className="text-on-surface-variant dark:text-gray-400 text-sm"> You’re doing a great job keeping everything organized!</p>
        </div>

        {/* Main Content Area */}
        <div className="px-6 md:px-8 lg:px-12 space-y-4 pb-8">
          {/* Search Bar */}
          <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-4 py-3 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-blue-600 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition shadow-sm dark:shadow-black/40">
            <Search className="w-5 text-on-surface-variant dark:text-gray-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-sm text-on-surface dark:text-white dark:placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-2 text-on-surface-variant dark:text-gray-500 hover:text-on-surface dark:hover:text-white transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters Section */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* Group Chips */}
            {GROUP_TABS.map((grp) => (
              <button
                key={grp}
                onClick={() => handleSelectGroup(grp)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedGroup === grp
                    ? 'bg-primary text-on-primary shadow-sm dark:bg-blue-600'
                    : 'bg-surface-container-low dark:bg-[#222] text-on-surface dark:text-white border border-outline-variant/30 dark:border-gray-700 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a]'
                }`}
              >
                {grp}
              </button>
            ))}

            {/* Category Select */}
            <div className="ml-auto">
              <select
                value={filterCategory || 'all'}
                onChange={(e) => setFilterCategory(e.target.value === 'all' ? null : e.target.value)}
                className="px-4 py-2 bg-surface-container-low dark:bg-[#222] border border-outline-variant/30 dark:border-gray-700 rounded-lg text-sm font-medium text-on-surface dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent dark:focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="costume">Costume</option>
                <option value="instrument">Instrument</option>
                <option value="accessories">Accessories</option>
              </select>
            </div>
          </div>

          {/* Inventory List - Row Layout */}
          <div className="max-w-5xl mx-auto">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-700 mx-auto mb-4" />
                <p className="text-on-surface-variant dark:text-gray-400">
                  {searchQuery ? "No items match your search" : "No items found"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => {
                  const isExpanded = expandedItems[item.uuid];
                  const itemImage = item.image_url?.startsWith('http') ? item.image_url : item.image_url ? `${import.meta.env.VITE_API_URL || "http://localhost:8000"}${item.image_url}` : null;
                  const totalQty = item.category === "costume" && item.garment_type?.toLowerCase() !== "accessory"
                    ? (item.qty_small || 0) + (item.qty_medium || 0) + (item.qty_large || 0)
                    : item.quantity || 0;
                  const status = (item.units?.length || 0) > 0 ? "In Stock" : "Out";

                  return (
                    <div
                      key={item.uuid}
                      className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-lg border border-outline-variant/20 dark:border-gray-700 shadow-sm hover:shadow-md dark:hover:shadow-black/40 overflow-hidden transition-all duration-200"
                    >
                      {/* Row Header - Clickable */}
                      <button
                        onClick={() => setExpandedItems({
                          ...expandedItems,
                          [item.uuid]: !isExpanded
                        })}
                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-surface-container-high dark:hover:bg-[#222] transition-colors text-left"
                      >
                        {/* Item Thumbnail */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-primary/30 dark:border-blue-500/30 bg-surface-container-high dark:bg-[#222]">
                          {itemImage ? (
                            <img src={itemImage} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-on-surface-variant dark:text-gray-400">
                              {item.category === 'instrument' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                              ) : (
                                <Package className="w-5 h-5" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Item Info - Two Lines */}
                        <div className="flex-1 min-w-0">
                          {/* Line 1: Name + Status Badges */}
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="text-xs font-semibold truncate text-on-surface dark:text-white">{item.name}</p>
                            <div className="flex gap-1 flex-shrink-0">
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                                {item.category?.charAt(0).toUpperCase() + item.category?.slice(1)}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                status === 'In Stock'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                              }`}>
                                {status}
                              </span>
                            </div>
                          </div>

                          {/* Line 2: Dance + Qty Info */}
                          <div className="flex items-center gap-2 text-[10px] text-on-surface-variant dark:text-gray-400">
                            {item.indigenous_dance && (
                              <>
                                <span className="font-medium text-on-surface dark:text-white">{item.indigenous_dance}</span>
                                <span>•</span>
                              </>
                            )}
                            {item.category === "costume" && item.garment_type?.toLowerCase() !== "accessory" ? (
                              <span className="truncate">
                                {item.qty_small > 0 ? `S:${item.qty_small} ` : ''}
                                {item.qty_medium > 0 ? `M:${item.qty_medium} ` : ''}
                                {item.qty_large > 0 ? `L:${item.qty_large} ` : ''}
                                Total: {totalQty}
                              </span>
                            ) : (
                              <span>Qty: {totalQty}</span>
                            )}
                          </div>
                        </div>

                        {/* Expand Chevron */}
                        <ChevronRight
                          className={`w-4 h-4 text-on-surface-variant dark:text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-outline-variant/20 dark:border-gray-700 px-3 py-3 bg-surface-container-lowest/50 dark:bg-[#1a1a1a]/50 text-xs space-y-3">
                          {/* Item Details */}
                          <div className="space-y-2">
                            <p className="text-[10px] text-on-surface-variant dark:text-gray-500 uppercase font-medium">Details</p>
                            {item.indigenous_group && (
                              <p className="text-sm text-on-surface dark:text-white">Group: <span className="font-medium">{item.indigenous_group}</span></p>
                            )}
                            {item.region && (
                              <p className="text-sm text-on-surface dark:text-white">Region: <span className="font-medium">{item.region}</span></p>
                            )}
                            {item.garment_type && (
                              <p className="text-sm text-on-surface dark:text-white">Type: <span className="font-medium">{item.garment_type}</span></p>
                            )}
                            {item.gender && (
                              <p className="text-sm text-on-surface dark:text-white">Gender: <span className="font-medium">{item.gender}</span></p>
                            )}
                            {item.color && (
                              <p className="text-sm text-on-surface dark:text-white">Color: <span className="font-medium">{item.color}</span></p>
                            )}
                            {item.date_acquired && (
                              <p className="text-sm text-on-surface dark:text-white">Acquired: <span className="font-medium">{item.date_acquired}</span></p>
                            )}
                            {item.description && (
                              <p className="text-sm text-on-surface dark:text-white">Notes: <span className="font-medium">{item.description}</span></p>
                            )}
                            {item.instrument_classification && (
                              <p className="text-sm text-on-surface dark:text-white">Classification: <span className="font-medium">{item.instrument_classification}</span></p>
                            )}
                            {item.instrument_type && (
                              <p className="text-sm text-on-surface dark:text-white">Instrument Type: <span className="font-medium">{item.instrument_type}</span></p>
                            )}
                          </div>

                          {/* Action Buttons - Icon Only */}
                          <div className="flex gap-2 pt-2 border-t border-outline-variant/10 dark:border-gray-700">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 bg-primary/10 dark:bg-blue-900/30 text-primary dark:text-blue-400 rounded hover:bg-primary/20 dark:hover:bg-blue-900/50 transition"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedItemForQR(item);
                                setUnitModalOpen(true);
                              }}
                              className="p-1.5 bg-primary/10 dark:bg-blue-900/30 text-primary dark:text-blue-400 rounded hover:bg-primary/20 dark:hover:bg-blue-900/50 transition"
                              title="View QR Codes"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.uuid)}
                              className="p-1.5 bg-error/10 dark:bg-red-900/30 text-error dark:text-red-400 rounded hover:bg-error/20 dark:hover:bg-red-900/50 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Form Panel */}
        {formPanelOpen && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30"
              onClick={() => {
                setFormPanelOpen(false);
                setEditingItem(null);
                setNewItem(buildEmptyItem(selectedGroup));
                setPreviewImage(null);
                setShowAdvanced(false);
              }}
            />

            {/* Form Panel */}
            <div className="fixed right-0 top-0 h-screen w-[420px] bg-surface-container-lowest dark:bg-[#1a1a1a] border-l border-outline-variant/20 dark:border-gray-700 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] dark:shadow-[-10px_0_30px_rgba(0,0,0,0.4)] z-40 overflow-y-auto flex flex-col">
              <form onSubmit={handleSave} className="flex-1 flex flex-col p-8">
                <div className="mb-8">
                  <h4 className="font-headline text-2xl font-bold text-primary dark:text-blue-400">
                    {editingItem ? "Edit Item" : "Add Item"}
                  </h4>
                  <p className="text-[11px] text-outline dark:text-gray-500 font-medium uppercase tracking-wide">Manage archival records</p>
                </div>

                <div className="space-y-6 flex-1 overflow-y-auto">
                  {/* Image Upload */}
                  <div className="space-y-2">
                    <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Asset Image</label>
                    <div className="h-40 border-2 border-dashed border-outline-variant/30 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center bg-surface-container-high dark:bg-[#222] group hover:border-primary/50 dark:hover:border-blue-600 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="absolute opacity-0 cursor-pointer w-full h-40"
                      />
                      <Package className="w-8 text-outline dark:text-gray-600 mb-2 group-hover:text-primary dark:group-hover:text-blue-400 transition-colors" />
                      <span className="text-[10px] text-outline dark:text-gray-500 font-bold uppercase">Upload Media</span>
                    </div>
                    {previewImage && (
                      <img src={previewImage} alt="Preview" className="w-full h-24 object-cover rounded-lg border border-outline-variant/20 dark:border-gray-700" />
                    )}
                  </div>

                  {/* Basic Fields */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Item Name *</label>
                      <input
                        value={newItem.name}
                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                        placeholder="e.g. Traditional Sarong"
                        className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Category *</label>
                        <select
                          value={newItem.category}
                          onChange={(e) => setNewItem({ ...newItem, category: e.target.value, garment_type: e.target.value === "costume" ? "" : null })}
                          className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-3 py-2.5 text-xs dark:text-white focus:ring-1 focus:ring-primary"
                          required
                          disabled={normalize(selectedGroup) === "kayam"}
                        >
                          <option value="">Select</option>
                          {categoryOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                          ))}
                        </select>
                      </div>

                      {newItem.category === "costume" && (
                        <div className="space-y-1">
                          <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Type *</label>
                          <select
                            value={newItem.garment_type || ""}
                            onChange={(e) => setNewItem({ ...newItem, garment_type: e.target.value })}
                            className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-3 py-2.5 text-xs dark:text-white focus:ring-1 focus:ring-primary"
                            required
                          >
                            <option value="">Select Type</option>
                            {garmentTypeOptions.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Quantity Fields */}
                    {newItem.category === "costume" && newItem.garment_type?.toLowerCase() !== "accessory" ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-on-surface dark:text-gray-300">Small</label>
                          <input
                            type="number"
                            min="0"
                            value={newItem.qty_small}
                            onChange={(e) => setNewItem({ ...newItem, qty_small: e.target.value })}
                            className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded px-3 py-2 text-sm dark:text-white focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-on-surface dark:text-gray-300">Medium</label>
                          <input
                            type="number"
                            min="0"
                            value={newItem.qty_medium}
                            onChange={(e) => setNewItem({ ...newItem, qty_medium: e.target.value })}
                            className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded px-3 py-2 text-sm dark:text-white focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-on-surface dark:text-gray-300">Large</label>
                          <input
                            type="number"
                            min="0"
                            value={newItem.qty_large}
                            onChange={(e) => setNewItem({ ...newItem, qty_large: e.target.value })}
                            className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded px-3 py-2 text-sm dark:text-white focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    ) : newItem.category ? (
                      <div className="space-y-1">
                        <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Quantity *</label>
                        <input
                          type="number"
                          min="0"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                          className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white focus:ring-1 focus:ring-primary"
                          required
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* Advanced Toggle */}
                  {newItem.category === "costume" && (
                    <div className="border-t border-outline-variant/10 dark:border-gray-700 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAdvanced((v) => !v)}
                        className="flex items-center justify-between w-full group"
                      >
                        <span className="text-[10px] font-bold text-outline dark:text-gray-500 group-hover:text-primary dark:group-hover:text-blue-400 transition-colors uppercase tracking-widest">
                          Advanced Metadata
                        </span>
                        <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
                      </button>

                      {showAdvanced && (
                        <div className="mt-4 space-y-4">
                          <div className="space-y-1">
                            <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Indigenous Dance</label>
                            <select
                              value={newItem.indigenous_dance || ""}
                              onChange={(e) => handleIndigenousDanceChange(e.target.value)}
                              className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white focus:ring-1 focus:ring-primary"
                            >
                              <option value="">Select Dance</option>
                              {indigenousDanceData.map((danceItem) => (
                                <option key={danceItem.dance} value={danceItem.dance}>{danceItem.dance}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Region</label>
                            <input
                              value={newItem.region || ""}
                              onChange={(e) => setNewItem({ ...newItem, region: e.target.value })}
                              readOnly={!!newItem.indigenous_dance && indigenousDanceData.some(d => d.dance === newItem.indigenous_dance)}
                              className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                              placeholder="Auto-filled from dance"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Gender</label>
                            <select
                              value={newItem.gender || ""}
                              onChange={(e) => setNewItem({ ...newItem, gender: e.target.value })}
                              className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white focus:ring-1 focus:ring-primary"
                            >
                              <option value="">Select</option>
                              {genderOptions.map((g) => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Color</label>
                            <input
                              value={newItem.color || ""}
                              onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                              className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Description</label>
                            <textarea
                              value={newItem.description || ""}
                              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                              rows={3}
                              className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {newItem.category === "instrument" && (
                    <div className="space-y-4 border-t border-outline-variant/10 dark:border-gray-700 pt-4">
                      <div className="space-y-1">
                        <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Classification</label>
                        <select
                          value={newItem.instrument_classification || ""}
                          onChange={(e) => setNewItem({ ...newItem, instrument_classification: e.target.value })}
                          className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white focus:ring-1 focus:ring-primary"
                        >
                          <option value="">Select</option>
                          {classificationOptions.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Type</label>
                        <select
                          value={newItem.instrument_type || ""}
                          onChange={(e) => setNewItem({ ...newItem, instrument_type: e.target.value })}
                          className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white focus:ring-1 focus:ring-primary"
                        >
                          <option value="">Select</option>
                          {instrumentCategoryOptions.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-headline text-sm font-semibold text-primary dark:text-blue-400">Description</label>
                        <textarea
                          value={newItem.description || ""}
                          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                          rows={3}
                          className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-6 border-t border-outline-variant/10 dark:border-gray-700 sticky bottom-0 bg-surface-container-lowest dark:bg-[#1a1a1a]">
                  <button
                    type="submit"
                    className="flex-1 bg-primary dark:bg-blue-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-primary-container dark:hover:bg-blue-700 transition-colors shadow-lg shadow-primary/10 dark:shadow-blue-600/20"
                  >
                    {editingItem ? "Update" : "Add Item"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormPanelOpen(false);
                      setEditingItem(null);
                      setNewItem(buildEmptyItem(selectedGroup));
                      setPreviewImage(null);
                      setShowAdvanced(false);
                    }}
                    className="px-5 py-3 border border-outline-variant/30 dark:border-gray-700 text-outline dark:text-gray-400 font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-surface dark:hover:bg-[#222] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Floating Action Button */}
        {!formPanelOpen && (
          <button
            onClick={() => {
              setNewItem(buildEmptyItem(selectedGroup));
              setEditingItem(null);
              setPreviewImage(null);
              setShowAdvanced(false);
              setFormPanelOpen(true);
            }}
            className="fixed bottom-10 right-10 w-14 h-14 bg-primary dark:bg-blue-600 text-white rounded-full shadow-2xl dark:shadow-blue-600/40 flex items-center justify-center hover:scale-110 dark:hover:bg-blue-700 transition-transform z-40 group"
            title="Add new item"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Unit Modal for QR display */}
      {unitModalOpen && selectedItemForQR && (
        <UnitModal
          isOpen={unitModalOpen}
          onClose={() => setUnitModalOpen(false)}
          selectedItem={selectedItemForQR}
          onUnitDeleted={(deletedUnitId) => {
            // Refresh the inventory after unit deletion
            fetchItems();
          }}
        />
      )}
    </PageLayout>
  );
}

