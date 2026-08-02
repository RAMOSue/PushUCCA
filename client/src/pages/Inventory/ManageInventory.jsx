// ManageInventory.jsx
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import UnitModal from "./UnitModal";
import PageLayout from "../../components/layout/PageLayout";
import { Package, GridIcon, Music, AlertTriangle, Search, Filter, Plus, QrCode, Edit2, Trash2, ChevronRight, RotateCw, FlipHorizontal2, ZoomIn, ZoomOut, X, Check } from "lucide-react";
import { getInventoryDivisionInfo, setInventoryDivisionAssignment } from "../../utils/inventoryDivisionStorage";
import { useSidebarStore } from "../../../context/sidebarStore";

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
    description: "",
    condition: "",
    status: "",
    material: "",
    size: "",
    tribe: "",
    cultural_origin: "",
    accessories: "",
    storage_location: "",
    usage: "",
    acquisition_details: "",
    notes: "",
    instrument_classification: "",
    instrument_type: "",
    qty_small: "",
    qty_medium: "",
    qty_large: "",
    image_url: "",
    division_id: "",
    division_name: "",
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

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });

const createImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });

const IMAGE_CARD_ASPECT_RATIO = 1;
const getInitialCrop = () => ({
  unit: "%",
  width: 90,
  height: 90,
  x: 5,
  y: 5,
});

const getFitZoomForImage = (image, containerSize) => {
  if (!containerSize || !image) return 1;

  const width = containerSize.width || 420;
  const height = containerSize.height || 420;
  const imageAspect = image.naturalWidth / image.naturalHeight;
  const containerAspect = width / height;
  const fitByWidth = width / image.naturalWidth;
  const fitByHeight = height / image.naturalHeight;
  const zoom = imageAspect > containerAspect ? fitByWidth : fitByHeight;

  return Math.max(0.6, Math.min(1.4, zoom * 0.95));
};

const getCroppedImageFile = async (imageSrc, { frameSize, zoom, rotation, flipHorizontal, offsetX, offsetY }, fileName) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Unable to create image canvas");
  }

  const size = frameSize || 320;
  canvas.width = size;
  canvas.height = size;

  const rotRad = (rotation * Math.PI) / 180;
  const scaleX = flipHorizontal ? -1 : 1;

  ctx.translate(size / 2 + offsetX, size / 2 + offsetY);
  ctx.scale(zoom, zoom);
  ctx.rotate(rotRad);
  ctx.scale(scaleX, 1);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to generate cropped image"));
        return;
      }

      const file = new File([blob], fileName || "inventory-image.jpg", {
        type: blob.type || "image/jpeg",
      });
      resolve(file);
    }, "image/jpeg", 0.95);
  });
};

/* -------------------------------------------------------------- */
export default function ManageInventory({ filterCategory, registerAddItemHandler }) {
  const { selectedDivision, globalSearchQuery } = useSidebarStore();
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
  const [formPanelOpen, setFormPanelOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [divisionLoading, setDivisionLoading] = useState(false);
  const [imageEditorSource, setImageEditorSource] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [crop, setCrop] = useState(getInitialCrop());
  const [completedCrop, setCompletedCrop] = useState(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [imageFlipHorizontal, setImageFlipHorizontal] = useState(false);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [editorFrameSize, setEditorFrameSize] = useState(320);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const cropEditorViewportRef = useRef(null);

  const activeItem = useMemo(
    () => items.find((item) => (item.uuid || item.id) === activeItemId),
    [activeItemId, items]
  );

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

  const fetchDivisions = useCallback(async () => {
    try {
      setDivisionLoading(true);
      const res = await axios.get("/api/master-list/units");
      const activeDivisions = Array.isArray(res.data)
        ? res.data.filter((d) => d.status?.toLowerCase() === "active")
        : [];
      setDivisions(activeDivisions);
    } catch (err) {
      console.error("❌ Failed to fetch divisions:", err.message);
    } finally {
      setDivisionLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchDivisions();
  }, [fetchItems, fetchDivisions]);

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

  const resolvedFilterCategory = filterCategory || null;
  const filteredItems = useMemo(() => {
    const normalizedSelectedDivision = normalize(selectedDivision);
    return items.filter((i) => {
      const divisionMatch = normalizedSelectedDivision === "all" || normalize(i.collection_group) === normalizedSelectedDivision;
      const categoryMatch = !resolvedFilterCategory || i.category === resolvedFilterCategory;
      const searchMatch = !globalSearchQuery || i.name.toLowerCase().includes(globalSearchQuery.toLowerCase());
      return divisionMatch && categoryMatch && searchMatch;
    });
  }, [items, selectedDivision, resolvedFilterCategory, globalSearchQuery]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setActiveItemId(null);
      return;
    }

    const selectedIds = filteredItems.map((item) => item.uuid || item.id);
    if (!selectedIds.includes(activeItemId)) {
      setActiveItemId(selectedIds[0]);
    }
  }, [filteredItems, activeItemId]);

  useEffect(() => {
    if (editingItem) return;

    if (normalize(selectedDivision) === "all") {
      setSelectedGroup("Dulimbay");
      setNewItem((prev) => ({ ...prev, collection_group: "Dulimbay" }));
      return;
    }

    setSelectedGroup(selectedDivision);
    setNewItem((prev) => ({ ...prev, collection_group: selectedDivision }));
  }, [editingItem, selectedDivision]);

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

  useEffect(() => {
    if (!cropEditorViewportRef.current) return;

    const updateFrameSize = () => {
      const rect = cropEditorViewportRef.current.getBoundingClientRect();
      const size = Math.max(240, Math.min(rect.width || 320, rect.height || 320));
      setEditorFrameSize(size);
    };

    updateFrameSize();
    const observer = new ResizeObserver(updateFrameSize);
    observer.observe(cropEditorViewportRef.current);
    return () => observer.disconnect();
  }, [imageEditorSource]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageEditorSource(dataUrl);
      setWizardStep(1);
      setCrop(getInitialCrop());
      setCompletedCrop(null);
      setImageZoom(1);
      setImageRotation(0);
      setImageFlipHorizontal(false);
      setImageOffset({ x: 0, y: 0 });
      setNewItem((ni) => ({ ...ni, image_file: file, image_url: "" }));
    } catch (error) {
      console.error("Image load failed:", error);
      toast.error("Unable to load image for editing.");
    }
  };

  const handleCropChange = useCallback((nextCrop) => {
    setCrop((prev) => ({
      ...prev,
      ...nextCrop,
      unit: nextCrop.unit || prev.unit,
    }));
  }, []);

  const handleCropComplete = useCallback((cropPixel) => {
    setCompletedCrop(cropPixel);
  }, []);

  const handleImageLoaded = useCallback((image) => {
    const zoom = getFitZoomForImage(image, {
      width: editorFrameSize,
      height: editorFrameSize,
    });
    setImageZoom(zoom);
    setCrop(getInitialCrop());
    setCompletedCrop(null);
    setImageOffset({ x: 0, y: 0 });
  }, [editorFrameSize]);

  const handleResetImageTransform = async () => {
    if (!imageEditorSource) return;

    try {
      const image = await createImage(imageEditorSource);
      const zoom = getFitZoomForImage(image, {
        width: editorFrameSize,
        height: editorFrameSize,
      });
      setImageZoom(zoom);
      setImageRotation(0);
      setImageFlipHorizontal(false);
      setImageOffset({ x: 0, y: 0 });
      setCompletedCrop(null);
    } catch (error) {
      console.error("Image reset failed:", error);
      toast.error("Unable to reset the image view.");
    }
  };

  const handleSavePreview = async () => {
    if (!imageEditorSource) {
      toast.error("Please select an image before saving a preview.");
      return;
    }

    try {
      setIsApplyingCrop(true);

      const croppedFile = await getCroppedImageFile(
        imageEditorSource,
        {
          frameSize: editorFrameSize,
          zoom: imageZoom,
          rotation: imageRotation,
          flipHorizontal: imageFlipHorizontal,
          offsetX: imageOffset.x,
          offsetY: imageOffset.y,
        },
        newItem.image_file?.name || "inventory-image.jpg"
      );
      const croppedDataUrl = await readFileAsDataUrl(croppedFile);

      setPreviewImage(croppedDataUrl);
      setImageEditorSource(null);
      setCrop(getInitialCrop());
      setCompletedCrop(null);
      setImageZoom(1);
      setImageRotation(0);
      setImageFlipHorizontal(false);
      setImageOffset({ x: 0, y: 0 });
      setNewItem((ni) => ({ ...ni, image_file: croppedFile, image_url: "" }));
      toast.success("Preview saved");
    } catch (error) {
      console.error("Image crop failed:", error);
      toast.error("Unable to save the preview image.");
    } finally {
      setIsApplyingCrop(false);
    }
  };

  const handleCloseCropEditor = () => {
    setImageEditorSource(null);
    setCrop(getInitialCrop());
    setCompletedCrop(null);
    setImageZoom(1);
    setImageRotation(0);
    setImageFlipHorizontal(false);
    setImageOffset({ x: 0, y: 0 });
    setPreviewImage(null);
    setWizardStep(1);
    setNewItem((ni) => ({ ...ni, image_file: null, image_url: "" }));
  };

  const handleReEditImage = () => {
    if (!previewImage) return;
    setImageEditorSource(previewImage);
    setWizardStep(1);
    setCrop(getInitialCrop());
    setCompletedCrop(null);
    setImageZoom(1);
    setImageRotation(0);
    setImageFlipHorizontal(false);
    setImageOffset({ x: 0, y: 0 });
  };

  const handleRemoveImage = () => {
    setPreviewImage(null);
    setImageEditorSource(null);
    setWizardStep(1);
    setCrop(getInitialCrop());
    setCompletedCrop(null);
    setImageZoom(1);
    setImageRotation(0);
    setImageFlipHorizontal(false);
    setImageOffset({ x: 0, y: 0 });
    setNewItem((ni) => ({ ...ni, image_file: null, image_url: "" }));
  };

  const handleEditorPointerDown = (event) => {
    if (!imageEditorSource) return;
    setIsDraggingImage(true);
    setDragStart({
      x: event.clientX,
      y: event.clientY,
      offsetX: imageOffset.x,
      offsetY: imageOffset.y,
    });
  };

  const handleEditorPointerMove = (event) => {
    if (!isDraggingImage || !dragStart) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    setImageOffset({
      x: dragStart.offsetX + dx,
      y: dragStart.offsetY + dy,
    });
  };

  const handleEditorPointerUp = () => {
    setIsDraggingImage(false);
    setDragStart(null);
  };

  const parseQty = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const resetFormState = () => {
    setNewItem(buildEmptyItem(selectedGroup));
    setPreviewImage(null);
    setImageEditorSource(null);
    setWizardStep(1);
    setCrop(getInitialCrop());
    setCompletedCrop(null);
    setImageZoom(1);
    setImageRotation(0);
    setImageFlipHorizontal(false);
    setEditingItem(null);
    setShowAdvanced(false);
    setFormPanelOpen(false);
  };

  const costumeTotal = (ni) =>
    parseQty(ni.qty_small) + parseQty(ni.qty_medium) + parseQty(ni.qty_large);

  const handleSave = async (e) => {
    e.preventDefault();
    const grp = newItem.collection_group || selectedGroup;
    const category = newItem.category;

    if (normalize(selectedDivision) === "all") {
      toast.error("Please select Dulimbay, Budjong, or Kayam before creating an item.");
      return;
    }

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

    const divisionLookupName = editingItem ? (newItem.division_name || newItem.collection_group || grp) : (selectedDivision || grp);
    const matchedDivision =
      divisions.find((d) => normalize(d.name) === normalize(divisionLookupName)) ||
      divisions.find((d) => String(d.id) === String(newItem.division_id)) ||
      divisions.find((d) => String(d.id) === String(editingItem?.division_id)) ||
      null;

    if (!matchedDivision) {
      toast.error("Unable to resolve the selected division for this item.");
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

    payload.division_id = matchedDivision.id;
    payload.division_name = matchedDivision.name;
    payload.collection_group = matchedDivision.name;

    // ✅ Clean up payload: convert empty strings to null for optional fields
    payload.date_acquired = payload.date_acquired?.trim() || null;
    payload.description = payload.description?.trim() || null;
    payload.condition = payload.condition?.trim() || null;
    payload.status = payload.status?.trim() || null;
    payload.material = payload.material?.trim() || null;
    payload.size = payload.size?.trim() || null;
    payload.tribe = payload.tribe?.trim() || null;
    payload.cultural_origin = payload.cultural_origin?.trim() || null;
    payload.accessories = payload.accessories?.trim() || null;
    payload.storage_location = payload.storage_location?.trim() || null;
    payload.usage = payload.usage?.trim() || null;
    payload.acquisition_details = payload.acquisition_details?.trim() || null;
    payload.notes = payload.notes?.trim() || null;
    payload.indigenous_group = payload.indigenous_group?.trim() || null;
    payload.indigenous_dance = payload.indigenous_dance?.trim() || null;
    payload.region = payload.region?.trim() || null;
    payload.instrument_classification = payload.instrument_classification?.trim() || null;
    payload.instrument_type = payload.instrument_type?.trim() || null;
    payload.color = payload.color?.trim() || null;
    payload.gender = payload.gender?.trim() || null;
    payload.garment_type = payload.garment_type?.trim() || null;
    payload.collection_group = payload.collection_group?.trim() || payload.collection_group;
    
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
    delete payload.condition;
    delete payload.status;
    delete payload.material;
    delete payload.size;
    delete payload.tribe;
    delete payload.cultural_origin;
    delete payload.accessories;
    delete payload.storage_location;
    delete payload.usage;
    delete payload.acquisition_details;
    delete payload.notes;
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
        setInventoryDivisionAssignment(existingItem.uuid || existingItem.id, {
          division_id: matchedDivision.id,
          division_name: matchedDivision.name,
        });

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
        setInventoryDivisionAssignment(editingItem.uuid || editingItem.id, {
          division_id: matchedDivision.id,
          division_name: matchedDivision.name,
        });

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
        setInventoryDivisionAssignment(newItemId, {
          division_id: matchedDivision.id,
          division_name: matchedDivision.name,
        });

        // ✅ DO NOT call generate-units here - addInventoryItem already creates all units
        // Calling it again would double the units (10 small qty becomes 20 units)
      }

      // Reset form
      resetFormState();
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

    const savedDivision = getInventoryDivisionInfo(item);

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
      division_id: savedDivision?.division_id || item.division_id || "",
      division_name: savedDivision?.division_name || item.division_name || "",
    });
    setPreviewImage(item.image_url || null);
    setWizardStep(1);
    setShowAdvanced(true);
    setFormPanelOpen(true);
  };

  const downloadQRCode = async (qrCodeUrl, name) => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || window.location.origin;
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

  const categoryOptions = categoryOptionsForGroup(selectedGroup);

  const genericDetailOptions = (fieldKey) => {
    const values = items.map((i) => i[fieldKey]).filter(Boolean);
    return [...new Set(values)];
  };

  const currentDanceOptions = dancesByGroup[newItem.indigenous_group] || [];

  // if (loading) return <div className="text-center mt-10">Loading inventory...</div>;
  useEffect(() => {
    if (typeof registerAddItemHandler === 'function') {
      registerAddItemHandler(() => {
        if (normalize(selectedDivision) === "all") {
          toast.error("Please select Dulimbay, Budjong, or Kayam before creating an item.");
          return;
        }

        const nextGroup = normalize(selectedDivision) === "all" ? "Dulimbay" : selectedDivision;
        setSelectedGroup(nextGroup);
        setNewItem(buildEmptyItem(nextGroup));
        setEditingItem(null);
        setPreviewImage(null);
        setImageEditorSource(null);
        setWizardStep(1);
        setCrop({ unit: "%", width: 90, height: 90, x: 5, y: 5 });
        setCompletedCrop(null);
        setImageZoom(1);
        setImageRotation(0);
        setImageFlipHorizontal(false);
        setShowAdvanced(false);
        setFormPanelOpen(true);
      });
    }
  }, [registerAddItemHandler, selectedDivision, selectedGroup]);

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
        <div className="pb-6">
          <div className="grid gap-4 xl:grid-cols-[38%_62%]">
            <div className="rounded-3xl overflow-hidden border border-outline-variant/20 dark:border-gray-700 bg-surface-container-low dark:bg-[#1a1a1a] shadow-sm shadow-black/5 xl:max-h-[calc(100vh-220px)] xl:overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="py-16 text-center">
                  <Package className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-700 mx-auto mb-4" />
                  <p className="text-on-surface-variant dark:text-gray-400">
                    {globalSearchQuery ? "No items match your search" : "No items found"}
                  </p>
                </div>
              ) : (
                <>
                  {filteredItems.map((item) => {
                    const itemKey = item.uuid || item.id;
                    const itemImage = item.image_url?.startsWith('http') ? item.image_url : item.image_url ? `${import.meta.env.VITE_API_URL || window.location.origin}${item.image_url}` : null;
                    const totalQty = item.category === "costume" && item.garment_type?.toLowerCase() !== "accessory"
                      ? (item.qty_small || 0) + (item.qty_medium || 0) + (item.qty_large || 0)
                      : item.quantity || 0;
                    const isActiveRow = activeItemId === itemKey;
                    const sizeLabel = item.category === "costume" && item.garment_type?.toLowerCase() !== "accessory"
                      ? [item.qty_small > 0 ? `S:${item.qty_small}` : null, item.qty_medium > 0 ? `M:${item.qty_medium}` : null, item.qty_large > 0 ? `L:${item.qty_large}` : null].filter(Boolean).join(', ') || 'No sizes available'
                      : `Qty: ${totalQty}`;

                    return (
                      <button
                        key={itemKey}
                        type="button"
                        onClick={() => setActiveItemId(itemKey)}
                        className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${isActiveRow ? 'bg-primary/5 dark:bg-blue-500/10' : 'bg-transparent hover:bg-surface-container-high dark:hover:bg-[#222]'}`}
                      >
                        <div className="flex-shrink-0 w-12 h-12 rounded-2xl overflow-hidden border border-outline-variant/20 dark:border-gray-700 bg-surface-container-high dark:bg-[#222]">
                          {itemImage ? (
                            <img src={itemImage} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-on-surface-variant dark:text-gray-400">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-on-surface dark:text-white truncate">{item.name}</p>
                          <p className="mt-1 text-xs text-on-surface-variant dark:text-gray-400 truncate">{sizeLabel}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-on-surface-variant dark:text-gray-400" />
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div className="space-y-4">
            <div className="relative rounded-3xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-low dark:bg-[#1a1a1a] p-6 min-h-[420px]">
              {activeItem ? (
                <>
                  <div className="absolute right-6 top-6 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(activeItem)}
                      title="Edit"
                      className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary dark:bg-blue-900/30 dark:text-blue-400 hover:bg-primary/20 dark:hover:bg-blue-900/50 transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemForQR(activeItem);
                        setUnitModalOpen(true);
                      }}
                      title="View QR Codes"
                      className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary dark:bg-blue-900/30 dark:text-blue-400 hover:bg-primary/20 dark:hover:bg-blue-900/50 transition"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(activeItem.uuid)}
                      title="Delete"
                      className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-error/10 text-error dark:bg-red-900/30 dark:text-red-400 hover:bg-error/20 dark:hover:bg-red-900/50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                    <div className="w-full lg:w-44 h-44 rounded-3xl overflow-hidden bg-surface-container-high dark:bg-[#222] border border-outline-variant/20 dark:border-gray-700">
                      {activeItem.image_url ? (
                        <img
                          src={activeItem.image_url?.startsWith('http') ? activeItem.image_url : `${import.meta.env.VITE_API_URL || window.location.origin}${activeItem.image_url}`}
                          alt={activeItem.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-on-surface-variant dark:text-gray-400">
                          <Package className="w-10 h-10" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pt-1 lg:pt-0">
                      <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant mb-2">Selected item</p>
                      <h2 className="text-2xl font-semibold text-on-surface dark:text-white mb-2 line-clamp-2">{activeItem.name}</h2>
                      <div className="flex flex-wrap gap-2 items-center text-sm text-on-surface-variant dark:text-gray-400">
                        <span>{activeItem.category?.charAt(0).toUpperCase() + activeItem.category?.slice(1) || 'Item'}</span>
                        <span className="h-1 w-1 rounded-full bg-on-surface-variant/40"></span>
                        <span>{activeItem.units?.length ? 'In Stock' : 'Out of stock'}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {getInventoryDivisionInfo(activeItem)?.division_name ? (
                          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">
                            {getInventoryDivisionInfo(activeItem).division_name}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 mt-6 sm:grid-cols-2">
                    <div className="rounded-3xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-high dark:bg-[#222] p-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant mb-2">Quantity</p>
                      <p className="text-lg font-semibold text-on-surface dark:text-white">{activeItem.quantity ?? costumeTotal(activeItem) ?? 0}</p>
                    </div>
                    <div className="rounded-3xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-high dark:bg-[#222] p-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant mb-2">Garment Type</p>
                      <p className="text-lg font-semibold text-on-surface dark:text-white">{activeItem.garment_type || '—'}</p>
                    </div>
                    <div className="rounded-3xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-high dark:bg-[#222] p-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant mb-2">Region</p>
                      <p className="text-lg font-semibold text-on-surface dark:text-white">{activeItem.region || '—'}</p>
                    </div>
                    <div className="rounded-3xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-high dark:bg-[#222] p-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-on-surface-variant mb-2">Gender</p>
                      <p className="text-lg font-semibold text-on-surface dark:text-white">{activeItem.gender || '—'}</p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-5 text-sm text-on-surface dark:text-white">
                    {activeItem.description && (
                      <div className="rounded-3xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-high dark:bg-[#222] p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mb-2">Notes</p>
                        <p>{activeItem.description}</p>
                      </div>
                    )}
                    {(activeItem.instrument_classification || activeItem.instrument_type) && (
                      <div className="rounded-3xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-high dark:bg-[#222] p-4">
                        {activeItem.instrument_classification && (
                          <div className="mb-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mb-2">Classification</p>
                            <p>{activeItem.instrument_classification}</p>
                          </div>
                        )}
                        {activeItem.instrument_type && (
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant mb-2">Instrument Type</p>
                            <p>{activeItem.instrument_type}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-on-surface-variant dark:text-gray-400">
                  <Package className="w-12 h-12 mb-3" />
                  <p className="text-sm font-semibold mb-2">Select an item to view details</p>
                  <p className="text-xs">Use the list on the left to inspect inventory details and actions.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Centered Wizard Modal */}
        {formPanelOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xl"
              onClick={resetFormState}
            />

            <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4">
              <div
                className="w-full max-w-[720px] max-h-[88vh] overflow-hidden rounded-[24px] border border-outline-variant/20 bg-surface-container-lowest shadow-2xl dark:border-gray-700 dark:bg-[#121212]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-outline-variant/10 px-3 py-2 dark:border-gray-700">
                  <div className="min-w-[70px]">
                    {wizardStep > 1 ? (
                      <button
                        type="button"
                        onClick={() => setWizardStep((step) => Math.max(1, step - 1))}
                        className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant transition hover:text-primary dark:text-gray-400 dark:hover:text-blue-400"
                      >
                        Previous
                      </button>
                    ) : null}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-on-surface-variant dark:text-gray-400">
                    Add Item
                  </div>
                  <button
                    type={wizardStep === 3 ? "submit" : "button"}
                    form={wizardStep === 3 ? "inventory-add-item-form" : undefined}
                    onClick={wizardStep < 3 ? () => setWizardStep((step) => Math.min(3, step + 1)) : undefined}
                    className="min-w-[70px] text-right text-[10px] font-semibold uppercase tracking-[0.24em] text-primary transition hover:text-primary-container dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {wizardStep === 3 ? "Add Item" : "Next"}
                  </button>
                </div>

                <div className="h-[calc(88vh-56px)] overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
                  <form id="inventory-add-item-form" onSubmit={handleSave} className="flex h-full flex-col gap-3">
                    {normalize(selectedDivision) === "all" && !editingItem && (
                      <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-primary dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                        Select a specific division from the global filter before creating a new item.
                      </div>
                    )}

                    {wizardStep === 1 ? (
                      <div className="flex-1 min-h-0">
                        <div className="flex h-full flex-col rounded-[22px] border border-outline-variant/20 bg-surface-container-high p-3 dark:border-gray-700 dark:bg-[#1f1f1f] sm:p-4">
                          {previewImage && !imageEditorSource ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3">
                              <div className="w-full max-w-[360px] flex-1 overflow-hidden rounded-[20px] border border-outline-variant/20 bg-black/95 dark:border-gray-700">
                                <img src={previewImage} alt="Image preview" className="h-full w-full object-contain" />
                              </div>
                              <div className="flex flex-wrap justify-center gap-2">
                                <button type="button" onClick={handleReEditImage} className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary transition hover:bg-surface-container-high dark:border-gray-700 dark:bg-[#1d1d1d] dark:text-blue-400">
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Edit Preview
                                </button>
                                <button type="button" onClick={handleRemoveImage} className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-error transition hover:bg-surface-container-high dark:border-gray-700 dark:bg-[#1d1d1d] dark:text-red-400">
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : imageEditorSource ? (
                            <div className="flex h-full flex-col gap-3">
                              <div
                                ref={cropEditorViewportRef}
                                className="relative flex-1 min-h-0 overflow-hidden rounded-[20px] border border-outline-variant/20 bg-black/95 dark:border-gray-700"
                                onPointerMove={handleEditorPointerMove}
                                onPointerUp={handleEditorPointerUp}
                                onPointerLeave={handleEditorPointerUp}
                                onPointerCancel={handleEditorPointerUp}
                              >
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_44%,rgba(0,0,0,0.55)_44%,rgba(0,0,0,0.55)_100%)]" />
                                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                                  <div
                                    className="rounded-[24px] border-[3px] border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
                                    style={{ width: editorFrameSize || 260, height: editorFrameSize || 260 }}
                                  />
                                </div>
                                <div
                                  className="absolute inset-0 cursor-grab active:cursor-grabbing"
                                  onPointerDown={handleEditorPointerDown}
                                >
                                  <img
                                    src={imageEditorSource}
                                    alt="Crop editor"
                                    onLoad={(event) => handleImageLoaded(event.currentTarget)}
                                    className="absolute left-1/2 top-1/2 block max-w-none max-h-none"
                                    style={{
                                      transform: `translate(-50%, -50%) translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageZoom}) rotate(${imageRotation}deg) scaleX(${imageFlipHorizontal ? -1 : 1})`,
                                      transformOrigin: "center center",
                                      pointerEvents: "none",
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-outline-variant/20 bg-surface-container-low p-2.5 dark:border-gray-700 dark:bg-[#1d1d1d]">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button type="button" onClick={() => setImageZoom((value) => Math.max(0.6, value - 0.1))} className="rounded-full border border-outline-variant/30 bg-surface-container-low px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-[#1d1d1d]">
                                    <ZoomOut className="h-4 w-4" />
                                  </button>
                                  <button type="button" onClick={() => setImageZoom((value) => Math.min(2.5, value + 0.1))} className="rounded-full border border-outline-variant/30 bg-surface-container-low px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-[#1d1d1d]">
                                    <ZoomIn className="h-4 w-4" />
                                  </button>
                                  <button type="button" onClick={() => setImageRotation((value) => (value + 90) % 360)} className="rounded-full border border-outline-variant/30 bg-surface-container-low px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-[#1d1d1d]">
                                    <RotateCw className="h-4 w-4" />
                                  </button>
                                  <button type="button" onClick={() => setImageFlipHorizontal((value) => !value)} className="rounded-full border border-outline-variant/30 bg-surface-container-low px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-[#1d1d1d]">
                                    <FlipHorizontal2 className="h-4 w-4" />
                                  </button>
                                  <button type="button" onClick={handleResetImageTransform} className="rounded-full border border-outline-variant/30 bg-surface-container-low px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface dark:border-gray-700 dark:bg-[#1d1d1d] dark:text-gray-300">
                                    Reset
                                  </button>
                                  <label className="cursor-pointer rounded-full border border-outline-variant/30 bg-surface-container-low px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface dark:border-gray-700 dark:bg-[#1d1d1d] dark:text-gray-300">
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                    Replace
                                  </label>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button type="button" onClick={handleRemoveImage} className="rounded-xl border border-outline-variant/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant transition hover:bg-surface-container-high dark:border-gray-700 dark:text-gray-400">
                                    Clear
                                  </button>
                                  <button type="button" onClick={handleSavePreview} disabled={isApplyingCrop} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white transition disabled:cursor-not-allowed disabled:opacity-60">
                                    <Check className="h-4 w-4" />
                                    {isApplyingCrop ? "Processing..." : "Save Preview"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <label className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-outline-variant/30 bg-surface-container-low transition hover:border-primary/50 dark:border-gray-700 dark:bg-[#1d1d1d] dark:hover:border-blue-600">
                              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                              <Package className="mb-2 h-8 w-8 text-outline dark:text-gray-600" />
                              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-outline dark:text-gray-500">Upload & Edit Image</span>
                              <span className="mt-2 text-center text-[11px] text-on-surface-variant dark:text-gray-400">Drag the image, zoom in, rotate, or flip it before saving your preview</span>
                            </label>
                          )}
                        </div>
                      </div>
                    ) : wizardStep === 2 ? (
                      <div className="flex-1 space-y-4">
                        <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-high p-4 dark:border-gray-700 dark:bg-[#1f1f1f]">
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Step 2 • Primary details</p>
                            <h5 className="mt-1 text-base font-semibold text-on-surface dark:text-white">Capture the core information for this item</h5>
                          </div>

                          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Item Name *</label>
                                <input
                                  value={newItem.name}
                                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                  placeholder="e.g. Traditional Sarong"
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                  required
                                />
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Category *</label>
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
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Type *</label>
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

                              {divisionLoading && <p className="text-[10px] text-on-surface-variant dark:text-gray-400">Loading divisions…</p>}

                              {newItem.category === "costume" && newItem.garment_type?.toLowerCase() !== "accessory" ? (
                                <div className="grid gap-2 sm:grid-cols-3">
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
                                  <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Quantity *</label>
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

                            <div className="space-y-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Date Acquired</label>
                                <input
                                  type="date"
                                  value={newItem.date_acquired || ""}
                                  onChange={(e) => setNewItem({ ...newItem, date_acquired: e.target.value })}
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Condition</label>
                                <input
                                  value={newItem.condition || ""}
                                  onChange={(e) => setNewItem({ ...newItem, condition: e.target.value })}
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                  placeholder="Good / Fair / Needs repair"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Status</label>
                                <input
                                  value={newItem.status || ""}
                                  onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                  placeholder="Available / On loan"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Description</label>
                                <textarea
                                  value={newItem.description || ""}
                                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                  rows={4}
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="flex-1 space-y-4">
                        <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-high p-4 dark:border-gray-700 dark:bg-[#1f1f1f]">
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Step 3 • Additional metadata</p>
                            <h5 className="mt-1 text-base font-semibold text-on-surface dark:text-white">Finish with the supporting details for recordkeeping</h5>
                          </div>

                          <div className="grid gap-3 xl:grid-cols-2">
                            <div className="space-y-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-3 dark:border-gray-700 dark:bg-[#1d1d1d]">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Cultural & identity</p>
                              {newItem.category === "costume" ? (
                                <>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Indigenous Group</label>
                                    <input
                                      value={newItem.indigenous_group || ""}
                                      onChange={(e) => setNewItem({ ...newItem, indigenous_group: e.target.value })}
                                      className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                      placeholder="e.g. B'laan"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Indigenous Dance</label>
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
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Region</label>
                                    <input
                                      value={newItem.region || ""}
                                      onChange={(e) => setNewItem({ ...newItem, region: e.target.value })}
                                      readOnly={!!newItem.indigenous_dance && indigenousDanceData.some((d) => d.dance === newItem.indigenous_dance)}
                                      className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                      placeholder="Auto-filled from dance"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Gender</label>
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
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Color</label>
                                    <input
                                      value={newItem.color || ""}
                                      onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                                      className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                    />
                                  </div>
                                </>
                              ) : newItem.category === "instrument" ? (
                                <>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Classification</label>
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
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Type</label>
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
                                </>
                              ) : (
                                <p className="text-sm text-on-surface-variant dark:text-gray-400">Choose a category to unlock this section.</p>
                              )}
                            </div>

                            <div className="space-y-3 rounded-2xl border border-outline-variant/20 bg-surface-container-low p-3 dark:border-gray-700 dark:bg-[#1d1d1d]">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Storage & logistics</p>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Storage Location</label>
                                <input
                                  value={newItem.storage_location || ""}
                                  onChange={(e) => setNewItem({ ...newItem, storage_location: e.target.value })}
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                  placeholder="Shelf / Cabinet"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Material</label>
                                <input
                                  value={newItem.material || ""}
                                  onChange={(e) => setNewItem({ ...newItem, material: e.target.value })}
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Size</label>
                                <input
                                  value={newItem.size || ""}
                                  onChange={(e) => setNewItem({ ...newItem, size: e.target.value })}
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Usage</label>
                                <input
                                  value={newItem.usage || ""}
                                  onChange={(e) => setNewItem({ ...newItem, usage: e.target.value })}
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Acquisition Details</label>
                                <textarea
                                  value={newItem.acquisition_details || ""}
                                  onChange={(e) => setNewItem({ ...newItem, acquisition_details: e.target.value })}
                                  rows={3}
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant dark:text-gray-400">Notes</label>
                                <textarea
                                  value={newItem.notes || ""}
                                  onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                                  rows={3}
                                  className="w-full bg-surface-container-low dark:bg-[#222] border-none rounded-lg px-4 py-2.5 text-sm dark:text-white dark:placeholder-gray-500 focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Floating action moved into filter row above */}
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

