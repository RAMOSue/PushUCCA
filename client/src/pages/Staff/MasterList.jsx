// client/src/pages/Staff/MasterList.jsx
import { useState, useEffect, useContext, useRef } from "react";
import { UserContext } from "../../../context/userContext";
import axios from "axios";
import toast from "react-hot-toast";
import PageLayout from "../../components/layout/PageLayout";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  Settings,
  Database,
  Package,
  Layers,
  Clock,
  BookOpen,
  Shield,
  Tag,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Image,
  Upload,
  Users,
  GripVertical,
} from "lucide-react";

export default function MasterList() {
  const { user } = useContext(UserContext);
  const [activeTab, setActiveTab] = useState("units"); // units, positions, terms, rules, events, categories, settings, slideshow
  const [loading, setLoading] = useState(false);
  const [dataList, setDataList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [imageBaseSize, setImageBaseSize] = useState({ width: 0, height: 0 });
  const [fitByHeight, setFitByHeight] = useState(false);
  const [homepageAspect, setHomepageAspect] = useState(null);

  // Measure the actual homepage slideshow aspect ratio by creating a temporary full-width element
  const computeHomepageAspect = () => {
    try {
      const el = document.createElement('div');
      el.className = 'relative w-full h-[320px] sm:h-[460px] md:h-[560px] lg:h-[660px]';
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      document.body.appendChild(el);
      const rect = el.getBoundingClientRect();
      const aspect = rect.width && rect.height ? rect.width / rect.height : null;
      document.body.removeChild(el);
      return aspect;
    } catch (err) {
      return null;
    }
  };

  useEffect(() => {
    const updateAspect = () => {
      const a = computeHomepageAspect();
      if (a) setHomepageAspect(a);
    };
    updateAspect();
    window.addEventListener('resize', updateAspect);
    return () => window.removeEventListener('resize', updateAspect);
  }, []);

  // Apply homepage aspect to preview container so crop frame matches exactly
  useEffect(() => {
    const applyPreviewHeight = () => {
      if (!homepageAspect || !previewRef.current) return;
      const previewWidth = previewRef.current.getBoundingClientRect().width;
      const desiredHeight = previewWidth / homepageAspect;
      previewRef.current.style.height = `${Math.round(desiredHeight)}px`;
    };
    applyPreviewHeight();
    window.addEventListener('resize', applyPreviewHeight);
    return () => window.removeEventListener('resize', applyPreviewHeight);
  }, [homepageAspect]);
  const [isDragging, setIsDragging] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const dragStartRef = useRef(null);
  const previewRef = useRef(null);
  const [imageError, setImageError] = useState(null);

  const slideshowStorageKey = (imageId) => `slideshow-edit-state:${imageId}`;

  const readStoredSlideshowState = (imageId) => {
    if (!imageId) return null;
    try {
      const raw = localStorage.getItem(slideshowStorageKey(imageId));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  };

  const writeStoredSlideshowState = (imageId, state) => {
    if (!imageId) return;
    try {
      localStorage.setItem(slideshowStorageKey(imageId), JSON.stringify(state));
    } catch (err) {
      console.warn("Unable to persist slideshow edit state", err);
    }
  };

  const createImageFileFromDataUrl = async (dataUrl, fallbackName = "slideshow-image", fallbackType = "image/jpeg") => {
    if (!dataUrl) return null;
    try {
      const response = await fetch(dataUrl);
      if (!response.ok) throw new Error("Unable to read image");
      const blob = await response.blob();
      const mimeType = blob.type || fallbackType;
      const extension = mimeType.includes("png")
        ? ".png"
        : mimeType.includes("webp")
          ? ".webp"
          : mimeType.includes("gif")
            ? ".gif"
            : ".jpg";
      const baseName = (fallbackName || "slideshow-image").replace(/\s+/g, "_").replace(/\.[^/.]+$/, "");
      return new File([blob], `${baseName}${extension}`, { type: mimeType });
    } catch (err) {
      console.warn("Unable to create slideshow file from stored preview", err);
      return null;
    }
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});

  // Image viewer modal state
  const [selectedImage, setSelectedImage] = useState(null);
  const [viewerMenuOpen, setViewerMenuOpen] = useState(false);
  const [draggedImageId, setDraggedImageId] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // Tab configuration with API endpoints and form fields
  const tabs = {
    units: {
      title: "Division",
      icon: Layers,
      endpoint: "/api/master-list/units",
      fields: [
        { name: "name", label: "Unit Name", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
      ],
    },
    positions: {
      title: "Officer Positions",
      icon: Shield,
      endpoint: "/api/master-list/positions",
      fields: [
        { name: "name", label: "Position Name", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea" },
        { name: "maxHolders", label: "Max Holders", type: "number", defaultValue: 1 },
        { name: "isSharedRole", label: "Shared Global Role", type: "checkbox" },
        { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
      ],
    },
    terms: {
      title: "A.Y.",
      icon: Clock,
      endpoint: "/api/master-list/terms",
      fields: [
        { name: "name", label: "Term Name", type: "text", required: true, placeholder: "e.g., 2025-2026" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "startDate", label: "Start Date", type: "date", required: true },
        { name: "endDate", label: "End Date", type: "date", required: true },
        { name: "isActive", label: "Active Term", type: "checkbox" },
      ],
    },
    rules: {
      title: "Rules & Policies",
      icon: BookOpen,
      endpoint: "/api/master-list/rules",
      fields: [
        { name: "title", label: "Rule Title", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea" },
        {
          name: "category",
          label: "Category",
          type: "select",
          options: ["Attendance", "Conduct", "Borrowing", "Finance", "Other"],
          required: true,
        },
        { name: "severity", label: "Severity", type: "select", options: ["Low", "Medium", "High"], required: true },
        { name: "sanction", label: "Sanction / Penalty", type: "textarea" },
        { name: "isActive", label: "Active", type: "checkbox" },
      ],
    },
    events: {
      title: "Event / Activity Types",
      icon: Tag,
      endpoint: "/api/master-list/event-types",
      fields: [
        { name: "name", label: "Event Type Name", type: "text", required: true, placeholder: "e.g., Meeting, Practice" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
      ],
    },
    categories: {
      title: "Category",
      icon: Package,
      endpoint: "/api/master-list/inventory-categories",
      fields: [
        { name: "name", label: "Category Name", type: "text", required: true, placeholder: "e.g., Costume, Equipment" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"] },
      ],
    },
    settings: {
      title: "Attendance Time",
      icon: Settings,
      endpoint: "/api/master-list/attendance-settings",
      fields: [
        { name: "amStart", label: "AM Time-In Start", type: "time" },
        { name: "amEnd", label: "AM Time-In End", type: "time" },
        { name: "pmStart", label: "PM Time-In Start", type: "time" },
        { name: "pmEnd", label: "PM Time-In End", type: "time" },
        { name: "gracePeriodMinutes", label: "Grace Period (minutes)", type: "number" },
        { name: "undertimeThresholdMinutes", label: "Undertime Threshold (minutes)", type: "number" },
        { name: "requiredHoursPerDay", label: "Required Hours per Day", type: "number", step: 0.5 },
      ],
      isSingleRecord: true,
    },
    slideshow: {
      title: "GetStarted Slideshow",
      icon: Image,
      endpoint: "/api/master-list/slideshow-images",
      fields: [],
      isImageUpload: true,
    },
  };

  const currentTab = tabs[activeTab];

  // Officers specific state
  const [divisionsList, setDivisionsList] = useState([]);
  const [positionsList, setPositionsList] = useState([]);
  const [officersList, setOfficersList] = useState([]); // reused to hold unit-position mappings
  const [selectedDivision, setSelectedDivision] = useState(() => {
    try { return localStorage.getItem('masterlistSelectedDivision') || 'Dulimbay'; } catch { return 'Dulimbay'; }
  });
  const [officerLoading, setOfficerLoading] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      setImageError(null);
      // For officers we'll fetch positions/divisions separately
      if (activeTab === 'positions') {
        setOfficerLoading(true);
         const ts = Date.now();
         const [divRes, posRes] = await Promise.all([
           axios.get(`/api/master-list/units?_=${ts}`),
           axios.get(`/api/master-list/positions?_=${ts}`),
         ]);
        setDivisionsList(Array.isArray(divRes.data) ? divRes.data : []);
        setPositionsList(Array.isArray(posRes.data) ? posRes.data : []);
        // find unit id for selectedDivision name
        const unit = (divRes.data || []).find(u => (u.name||'').toLowerCase() === (selectedDivision||'').toLowerCase());
        if (unit) {
           const offRes = await axios.get(`/api/master-list/org-structures/unit/${unit.id}?_=${ts}`);
          setOfficersList(Array.isArray(offRes.data) ? offRes.data : []);
        } else {
          setOfficersList([]);
        }
        setOfficerLoading(false);
        setDataList(Array.isArray(posRes.data) ? posRes.data : []);
        return;
      }

      const res = await axios.get(currentTab.endpoint);
      setDataList(Array.isArray(res.data) ? res.data : [res.data]);
    } catch (err) {
      console.error("Fetch error:", err);
      const errorMsg = err.response?.data?.error || "Failed to load data";
      setImageError(errorMsg);
      // Only show toast if not slideshow tab (slideshow shows error in UI)
      if (activeTab !== "slideshow") {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Persist selected division
  useEffect(() => {
    try { localStorage.setItem('masterlistSelectedDivision', selectedDivision); } catch(e){}
  }, [selectedDivision]);

  // Helper: refresh officers for current selectedDivision
  const refreshOfficersForDivision = async (divisionName) => {
    try {
      setOfficerLoading(true);
      const divRes = await axios.get('/api/master-list/units');
      const unit = (divRes.data || []).find(u => (u.name||'').toLowerCase() === (divisionName||'').toLowerCase());
      if (!unit) { setOfficersList([]); setOfficerLoading(false); return; }
      const offRes = await axios.get(`/api/master-list/org-structures/unit/${unit.id}`);
      setOfficersList(Array.isArray(offRes.data) ? offRes.data : []);
    } catch (err) {
      console.error('Failed to refresh officers:', err);
    } finally {
      setOfficerLoading(false);
    }
  };

  // Filter and search logic
  const filteredData = dataList.filter((item) => {
    const matchSearch =
      !searchTerm ||
      Object.values(item)
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    // Do not hide inactive records — return everything that matches the search
    return matchSearch;
  });

  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Open add/edit modal
  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData({});
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({});
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = { ...formData };

      // Convert checkbox fields
      if (currentTab.fields.some((f) => f.type === "checkbox")) {
        currentTab.fields.forEach((field) => {
          if (field.type === "checkbox" && payload[field.name] !== undefined) {
            payload[field.name] = payload[field.name] === true || payload[field.name] === "on";
          }
        });
      }

      if (editingItem) {
        // Update
        await axios.put(`${currentTab.endpoint}/${editingItem.id}`, payload);
        toast.success("✅ Updated successfully");
      } else {
        // Create
        await axios.post(currentTab.endpoint, payload);
        toast.success("✅ Created successfully");
      }

      fetchData();
      closeModal();
    } catch (err) {
      console.error("Submit error:", err);
      toast.error(err.response?.data?.error || "Failed to save");
    }
  };

  // Delete item
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      await axios.delete(`${currentTab.endpoint}/${id}`);
      toast.success("✅ Deleted successfully");
      fetchData();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete");
    }
  };

  // Handle image file selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImageOffset({ x: 0, y: 0 });
      setZoom(1);
      setMirrored(false);
      setImageBaseSize({ width: 0, height: 0 });
      const reader = new FileReader();
      reader.onload = (evt) => setImagePreview(evt.target.result);
      reader.readAsDataURL(file);
    }
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const getPreviewBounds = () => {
    if (!previewRef.current || !imagePreview) return null;
    const container = previewRef.current.getBoundingClientRect();
    const imgEl = previewRef.current.querySelector('img');
    if (!imgEl) return null;
    const imgRect = imgEl.getBoundingClientRect();
    const displayWidth = imgRect.width;
    const displayHeight = imgRect.height;
    const maxX = Math.max(0, (displayWidth - container.width) / 2);
    const maxY = Math.max(0, (displayHeight - container.height) / 2);
    return { maxX, maxY };
  };

  const updateBoundsOffset = (x, y) => {
    const bounds = getPreviewBounds();
    if (!bounds) return { x, y };
    return {
      x: clamp(x, -bounds.maxX, bounds.maxX),
      y: clamp(y, -bounds.maxY, bounds.maxY),
    };
  };

  const handlePreviewImageLoad = (e) => {
    if (!previewRef.current) return;
    const container = previewRef.current.getBoundingClientRect();
    const naturalWidth = e.target.naturalWidth;
    const naturalHeight = e.target.naturalHeight;
    const imageAspect = naturalWidth / naturalHeight;
    const containerAspect = container.width / container.height;
    const baseSize = imageAspect > containerAspect
      ? { width: container.height * imageAspect, height: container.height }
      : { width: container.width, height: container.width / imageAspect };
    // Record whether the image should be sized by height (so we set only height in CSS)
    setFitByHeight(imageAspect > containerAspect);
    setImageBaseSize(baseSize);
    setNaturalSize({ width: naturalWidth, height: naturalHeight });
    // If we measured the homepage aspect, size the preview container to match that aspect
    if (homepageAspect && previewRef.current) {
      const previewWidth = previewRef.current.getBoundingClientRect().width;
      const desiredHeight = previewWidth / homepageAspect;
      previewRef.current.style.height = `${Math.round(desiredHeight)}px`;
      // recompute base size after adjusting container height
      const containerAfter = previewRef.current.getBoundingClientRect();
      const containerAspectAfter = containerAfter.width / containerAfter.height;
      const baseSizeAfter = imageAspect > containerAspectAfter
        ? { width: containerAfter.height * imageAspect, height: containerAfter.height }
        : { width: containerAfter.width, height: containerAfter.width / imageAspect };
      setImageBaseSize(baseSizeAfter);
    }
    setImageOffset((prev) => updateBoundsOffset(prev.x, prev.y));
  };

  // Create cropped blob matching the visible crop frame
  const getCroppedBlob = async () => {
    if (!previewRef.current || !imagePreview || !naturalSize.width) return null;
    const container = previewRef.current.getBoundingClientRect();
    const imgEl = previewRef.current.querySelector('img');
    if (!imgEl) return null;
    const imgRect = imgEl.getBoundingClientRect();

    // Map container coordinates to image natural pixels using rendered image rect
    const srcX = (container.left - imgRect.left) * (naturalSize.width / imgRect.width);
    const srcY = (container.top - imgRect.top) * (naturalSize.height / imgRect.height);
    const srcW = container.width * (naturalSize.width / imgRect.width);
    const srcH = container.height * (naturalSize.height / imgRect.height);

    const sx = Math.max(0, srcX);
    const sy = Math.max(0, srcY);
    const sw = Math.max(1, Math.min(naturalSize.width - sx, srcW));
    const sh = Math.max(1, Math.min(naturalSize.height - sy, srcH));

    // Create image element to draw from
    const img = await new Promise((resolve, reject) => {
      const i = document.createElement("img");
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = imagePreview;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    if (mirrored) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    }

    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9));
  };

  // Handle image upload
  const handleImageUpload = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    
    // Validation
    if (!imageFile) {
      setImageError("Please select an image file");
      toast.error("Please select an image file");
      return;
    }

    // File size validation (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      setImageError("Image size must be less than 5MB");
      toast.error("Image size must be less than 5MB");
      return;
    }

    // File type validation
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(imageFile.type)) {
      setImageError("Only JPG, PNG, GIF, and WEBP images are allowed");
      toast.error("Only JPG, PNG, GIF, and WEBP images are allowed");
      return;
    }

    try {
      setUploadingImage(true);
      setImageError(null);
      const formData = new FormData();
      // create cropped blob matching visible area; fallback to original file
      const croppedBlob = await getCroppedBlob();
      if (croppedBlob) {
        const filename = imageFile?.name ? `cropped_${imageFile.name}` : "cropped.jpg";
        formData.append("image", croppedBlob, filename);
      } else {
        formData.append("image", imageFile);
      }

      const res = await axios.post(`${currentTab.endpoint}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res?.data?.id) {
        writeStoredSlideshowState(res.data.id, {
          sourcePreview: imagePreview,
          fileName: imageFile.name,
          fileType: imageFile.type,
          offset: imageOffset,
          zoom,
          mirrored,
        });
      }

      toast.success("✅ Image uploaded successfully");
      setImageFile(null);
      setImagePreview(null);
      setImageOffset({ x: 0, y: 0 });
      setZoom(1);
      fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || "Failed to upload image";
      console.error("Upload error:", err);
      setImageError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setUploadingImage(false);
    }
  };

  // Render form fields
  const renderFormField = (field) => {
    const value = formData[field.name] ?? "";

    switch (field.type) {
      case "text":
      case "number":
      case "date":
      case "time":
        return (
          <input
            type={field.type}
            name={field.name}
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            placeholder={field.placeholder}
            step={field.step}
            required={field.required}
            className="w-full border border-outline-variant/30 dark:border-gray-700 rounded-lg px-3 py-2 text-sm dark:bg-[#2a2a2a] dark:text-white dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        );

      case "textarea":
        return (
          <textarea
            name={field.name}
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            placeholder={field.placeholder}
            rows="3"
            className="w-full border border-outline-variant/30 dark:border-gray-700 rounded-lg px-3 py-2 text-sm dark:bg-[#2a2a2a] dark:text-white dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        );

      case "select":
        return (
          <select
            name={field.name}
            value={value}
            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
            required={field.required}
            className="w-full border border-outline-variant/30 dark:border-gray-700 rounded-lg px-3 py-2 text-sm dark:bg-[#2a2a2a] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select {field.label}</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "checkbox":
        return (
          <label className="flex items-center gap-2 dark:text-white">
            <input
              type="checkbox"
              name={field.name}
              checked={formData[field.name] === true}
              onChange={(e) => setFormData({ ...formData, [field.name]: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">{field.label}</span>
          </label>
        );

      default:
        return null;
    }
  };

  // Render table with dynamic columns
  const renderTable = () => {
    if (loading) return <p className="text-center py-8 text-on-surface-variant dark:text-gray-400">Loading...</p>;
    if (paginatedData.length === 0) return <p className="text-center py-8 text-on-surface-variant dark:text-gray-400">No data found</p>;

    // Get dynamic columns from first item
    const columns =
      paginatedData.length > 0
        ? Object.keys(paginatedData[0]).filter(
            (k) => !["id", "created_at", "updated_at", "created_by"].includes(k)
          )
        : [];

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-lowest dark:bg-[#1a1a1a] border-b border-outline-variant/20 dark:border-gray-700">
            <tr>
              {columns.map((col) => (
                <th key={col} className="text-left px-4 py-3 font-semibold text-on-surface dark:text-white">
                  {col.replace(/_/g, " ").toUpperCase()}
                </th>
              ))}
              <th className="text-left px-4 py-3 font-semibold text-on-surface dark:text-white">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item) => (
              <tr key={item.id} className="border-b border-outline-variant/10 dark:border-gray-700 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a] transition">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-3 text-on-surface dark:text-gray-300">
                    {typeof item[col] === "boolean" ? (
                      item[col] ? (
                        <CheckCircle className="w-5 h-5 text-primary dark:text-blue-400" />
                      ) : (
                        <X className="w-5 h-5 text-on-surface-variant dark:text-gray-600" />
                      )
                    ) : (
                      String(item[col] || "-").substring(0, 50)
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 flex gap-2">
                  <button
                    onClick={() => openModal(item)}
                    className="p-2 hover:bg-primary/10 dark:hover:bg-blue-900/30 rounded text-primary dark:text-blue-400 transition"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 hover:bg-error/10 dark:hover:bg-red-900/30 rounded text-error dark:text-red-400 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render image grid for slideshow tab
  const renderImageGallery = () => {
    if (loading) return <p className="text-center py-8 text-on-surface-variant dark:text-gray-400">Loading images...</p>;
    
    if (imageError) {
      return (
        <div className="bg-error/10 dark:bg-red-900/20 border border-error/30 dark:border-red-700 rounded-lg p-6 text-center">
          <p className="text-error dark:text-red-400 font-semibold mb-2">⚠️ Error Loading Images</p>
          <p className="text-error/70 dark:text-red-300/70 text-sm mb-4">{imageError}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-error dark:bg-red-600 text-white rounded-lg font-medium hover:bg-error/90 dark:hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      );
    }
    
    if (dataList.length === 0) return <p className="text-center py-8 text-on-surface-variant dark:text-gray-400">No images uploaded yet. Upload your first image above.</p>;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {dataList.map((image) => (
          <div
            key={image.id}
            draggable
            onDragStart={() => setDraggedImageId(image.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleReorderImages(draggedImageId, image.id)}
            onDragEnd={() => setDraggedImageId(null)}
            className={`group relative bg-surface-container-low dark:bg-[#222] rounded-lg shadow-sm dark:shadow-black/40 border border-outline-variant/10 dark:border-gray-700 overflow-hidden hover:shadow-lg dark:hover:shadow-black/60 transition-shadow ${draggedImageId === image.id ? "opacity-60" : ""}`}
          >
            <div className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white shadow-sm">
              <GripVertical className="w-4 h-4" />
            </div>
            {/* Image Container - Clickable */}
            <div
              className="aspect-[3/1] bg-surface-container-high dark:bg-[#1a1a1a] overflow-hidden cursor-pointer"
              onClick={() => setSelectedImage(image)}
            >
              <img
                src={image.image_url || image.imageUrl}
                alt={image.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            {/* Info Section */}
            <div className="p-3 space-y-2">
              <h3 className="font-semibold text-sm text-on-surface dark:text-white truncate">{image.title}</h3>
              {image.description && (
                <p className="text-xs text-on-surface-variant dark:text-gray-400 line-clamp-2">{image.description}</p>
              )}
            </div>

            {/* Delete Button - Show on Hover */}
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this image?")) {
                  handleDeleteImage(image.id);
                }
              }}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-2 bg-error dark:bg-red-600 text-white rounded-lg shadow-lg hover:bg-error/80 dark:hover:bg-red-700 transition-all duration-200"
              title="Delete image"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // Handle image deletion
  const handleDeleteImage = async (imageId) => {
    try {
      setLoading(true);
      setImageError(null);
      await axios.delete(`${currentTab.endpoint}/${imageId}`);
      toast.success("✅ Image deleted successfully");
      fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to delete image";
      setImageError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const startSlideshowEditorForImage = async (image) => {
    const sourceUrl = image.image_url || image.imageUrl;
    const imageId = image?.id;
    const storedState = readStoredSlideshowState(imageId);

    setSelectedImage(null);
    setViewerMenuOpen(false);
    setImageError(null);
    setImageOffset({ x: 0, y: 0 });
    setZoom(1);
    setMirrored(false);

    try {
      if (storedState?.sourcePreview) {
        const restoredFile = await createImageFileFromDataUrl(
          storedState.sourcePreview,
          storedState.fileName || image.title || "slideshow-image",
          storedState.fileType || "image/jpeg"
        );

        if (restoredFile) {
          setImageFile(restoredFile);
          setImagePreview(storedState.sourcePreview);
          setImageOffset(storedState.offset || { x: 0, y: 0 });
          setZoom(storedState.zoom || 1);
          setMirrored(Boolean(storedState.mirrored));
          return;
        }
      }

      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error("Failed to load image");
      const blob = await response.blob();
      const extension = blob.type.includes("png") ? ".png" : blob.type.includes("webp") ? ".webp" : ".jpg";
      const fileName = (image.title || "slideshow-image").replace(/\s+/g, "_") + extension;
      setImageFile(new File([blob], fileName, { type: blob.type || "image/jpeg" }));
      setImagePreview(sourceUrl);
    } catch (err) {
      console.error("Unable to preload slideshow image for editing", err);
      setImagePreview(sourceUrl);
      setImageFile(null);
      toast.error("Unable to open the editor for this image.");
    }
  };

  const handleReorderImages = async (draggedId, targetId) => {
    if (!draggedId || !targetId || draggedId === targetId) return;

    const originalOrder = [...dataList];
    const reordered = [...dataList];
    const fromIndex = reordered.findIndex((image) => image.id === draggedId);
    const toIndex = reordered.findIndex((image) => image.id === targetId);

    if (fromIndex === -1 || toIndex === -1) return;

    const [movedItem] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedItem);
    setDataList(reordered);

    try {
      setSavingOrder(true);
      await axios.post(`${currentTab.endpoint}/reorder`, {
        imageOrders: reordered.map((image, index) => ({ id: image.id, display_order: index })),
      });
      toast.success("✅ Slideshow order updated");
      await fetchData();
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to reorder slideshow images";
      setDataList(originalOrder);
      toast.error(errorMsg);
    } finally {
      setSavingOrder(false);
      setDraggedImageId(null);
    }
  };

  // Render upload form for slideshow tab
  const renderImageUploadForm = () => {
    return (
      <div className="mb-8">
        {/* Upload Form Modal State */}
        {imageFile && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl dark:shadow-black/60 max-w-6xl w-full max-h-[90vh] overflow-hidden p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Upload Image</h3>
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-[#222] rounded transition"
                >
                  <X className="w-5 h-5 text-slate-600 dark:text-gray-400" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                {/* Left: large preview */}
                {imagePreview && (
                  <div className="w-full md:flex-1 bg-slate-100 dark:bg-[#222] rounded-2xl overflow-hidden border border-outline-variant/20 dark:border-gray-700">
                    <div
                      ref={previewRef}
                      className="relative w-full h-[320px] sm:h-[460px] md:h-[560px] lg:h-[660px] cursor-grab group"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                        dragStartRef.current = {
                          pointerX: e.clientX,
                          pointerY: e.clientY,
                          offsetX: imageOffset.x,
                          offsetY: imageOffset.y,
                          mirroredAtStart: mirrored,
                        };
                      }}
                      onPointerMove={(e) => {
                        if (!isDragging || !dragStartRef.current) return;
                        const deltaX = e.clientX - dragStartRef.current.pointerX;
                        const deltaY = e.clientY - dragStartRef.current.pointerY;
                        const effectiveDeltaX = dragStartRef.current.mirroredAtStart ? -deltaX : deltaX;
                        const newOffsets = updateBoundsOffset(dragStartRef.current.offsetX + effectiveDeltaX, dragStartRef.current.offsetY + deltaY);
                        setImageOffset(newOffsets);
                      }}
                      onPointerUp={() => setIsDragging(false)}
                      onPointerLeave={() => setIsDragging(false)}
                    >
                      <img
                        src={imagePreview}
                        alt="Preview"
                        onLoad={handlePreviewImageLoad}
                        className="absolute transition-transform duration-150"
                        style={{
                          ...(fitByHeight
                            ? { height: imageBaseSize.height ? `${imageBaseSize.height}px` : "100%", width: "auto" }
                            : { width: imageBaseSize.width ? `${imageBaseSize.width}px` : "100%", height: "auto" }),
                          left: "50%",
                          top: "50%",
                          transform: `translate(-50%,-50%) translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${zoom}) scaleX(${mirrored ? -1 : 1})`,
                          cursor: isDragging ? "grabbing" : "grab",
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 border-4 border-white/80 ring-1 ring-white/30 rounded-2xl" />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10" />
                    </div>
                  </div>
                )}

                {/* Right: controls */}
                <div
                  className="w-full md:w-72 flex flex-col justify-between"
                  style={{
                    maxHeight: previewRef.current ? `${previewRef.current.getBoundingClientRect().height}px` : 'auto',
                    overflowY: 'auto',
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Slideshow Crop Preview</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Drag the image behind the fixed frame and use zoom controls to choose the visible area.</p>

                    <div className="flex items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setZoom((prev) => Math.max(1, +(prev - 0.1).toFixed(2)))}
                        disabled={zoom <= 1}
                        className="px-3 py-2 rounded-lg border border-outline-variant/30 dark:border-gray-700 bg-slate-50 dark:bg-[#161616] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#222] transition disabled:opacity-50"
                      >
                        -
                      </button>
                      <span className="text-sm text-on-surface dark:text-white">{Math.round(zoom * 100)}%</span>
                      <button
                        type="button"
                        onClick={() => setZoom((prev) => Math.min(3, +(prev + 0.1).toFixed(2)))}
                        className="px-3 py-2 rounded-lg border border-outline-variant/30 dark:border-gray-700 bg-slate-50 dark:bg-[#161616] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#222] transition"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => setMirrored((m) => !m)}
                        className="px-3 py-2 rounded-lg border border-outline-variant/30 dark:border-gray-700 bg-slate-50 dark:bg-[#161616] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#222] transition"
                        title="Mirror"
                      >
                        ⇋
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImageOffset({ x: 0, y: 0 });
                          setZoom(1);
                          setMirrored(false);
                        }}
                        className="px-3 py-2 rounded-lg border border-outline-variant/30 dark:border-gray-700 bg-slate-50 dark:bg-[#161616] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#222] transition"
                        title="Reset"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleImageUpload}
                      disabled={uploadingImage || !imageFile}
                      className="flex-1 px-4 py-2 bg-primary dark:bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-primary/90 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {uploadingImage ? "Uploading..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setImageOffset({ x: 0, y: 0 });
                        setZoom(1);
                        setMirrored(false);
                      }}
                      disabled={uploadingImage}
                      className="flex-1 px-4 py-2 bg-slate-200 dark:bg-[#222] text-slate-900 dark:text-gray-300 rounded-lg font-semibold text-sm hover:bg-slate-300 dark:hover:bg-[#2a2a2a] disabled:opacity-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Input (Hidden) */}
        <input
          type="file"
          id="slideshow-file-input"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Add Image Button */}
        <label htmlFor="slideshow-file-input" className="inline-block">
          <button
            type="button"
            onClick={() => document.getElementById("slideshow-file-input").click()}
            className="flex items-center gap-2 px-6 py-3 bg-primary dark:bg-blue-600 text-white rounded-lg font-bold shadow-lg shadow-primary/20 dark:shadow-blue-600/20 hover:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Add Image
          </button>
        </label>
      </div>
    );
  };

  // Icon mapping
  const getTabIcon = (tabKey) => {
    const tab = tabs[tabKey];
    const Icon = tab.icon;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-surface dark:bg-[#171717]">
        {/* Header */}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">Master List</h1>
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">Centralized configuration hub for the organization</p>
            </div>
            {activeTab !== "slideshow" && (
              <button
                onClick={() => openModal()}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary dark:bg-blue-600 text-white rounded-lg font-semibold text-sm shadow-lg shadow-primary/20 dark:shadow-blue-600/20 hover:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                New Entry
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 md:px-8 lg:px-12 flex flex-nowrap gap-1 border-b border-outline-variant/20 dark:border-gray-700 pb-2 mt-2 overflow-x-auto">
          {Object.entries(tabs).map(([key, tab]) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                setCurrentPage(1);
                setSearchTerm("");
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-xs whitespace-nowrap transition-all ${
                activeTab === key
                  ? "text-primary dark:text-blue-400"
                  : "text-slate-700 dark:text-gray-300 hover:text-primary dark:hover:text-blue-400 bg-transparent"
              }`}
            >
              {getTabIcon(key)}
              {tab.title.split(" ")[0]}
            </button>
          ))}
        </div>

       

        {/* Content - Table or Image Gallery */}
        <div className="px-6 md:px-8 lg:px-12 mt-3">
          {activeTab === "slideshow" ? (
            <>
              {/* Image Upload Form */}
              {renderImageUploadForm()}

            {/* Image Gallery */}
            <div>
              <h3 className="text-lg font-semibold text-on-surface dark:text-white mb-4">Uploaded Images</h3>
              <div className="bg-surface-container-lowest dark:bg-[#1a1a1a] rounded-xl">
                {renderImageGallery()}
              </div>
            </div>
            </>
          ) : (
            <div className="bg-surface-container-low dark:bg-[#222] rounded-xl shadow-sm dark:shadow-black/40 border border-outline-variant/10 dark:border-gray-700 overflow-hidden">
              {renderTable()}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 md:px-8 lg:px-12 mt-3">
            {activeTab === "positions" ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  {['Dulimbay','Budjong','Kayam'].map((d) => (
                    <button
                      key={d}
                      onClick={() => { setSelectedDivision(d); refreshOfficersForDivision(d); }}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${selectedDivision === d ? 'text-primary dark:text-blue-400' : 'text-on-surface dark:text-gray-300 hover:text-primary dark:hover:text-blue-400'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <div className="bg-surface-container-low dark:bg-[#222] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-on-surface dark:text-white mr-2">Position</label>
                      <select
                        id="existingPositionSelect"
                        className="px-3 py-2 bg-white dark:bg-[#111] border border-outline-variant/20 rounded-md text-sm"
                      >
                        <option value="">Use existing position (optional)</option>
                        {positionsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input
                        type="text"
                        value={newPositionName}
                        onChange={(e) => setNewPositionName(e.target.value)}
                        placeholder="Or enter new position name"
                        className="px-3 py-2 border border-outline-variant/20 rounded-md text-sm flex-1 bg-white dark:bg-[#111]"
                      />
                    </div>
                    <div>
                      <button
                        onClick={async () => {
                          const sel = document.getElementById('existingPositionSelect').value;
                          const name = newPositionName && newPositionName.trim();
                          if (!sel && !name) { toast.error('Select or enter a position name'); return; }
                          try {
                            const divRes = await axios.get('/api/master-list/units');
                            const unit = (divRes.data||[]).find(u=> (u.name||'').toLowerCase()===selectedDivision.toLowerCase());
                            if (!unit) { toast.error('Division not found'); return; }

                            let payload = { unitId: unit.id, hierarchyLevel: 3 };
                            if (sel) payload.positionId = Number(sel);
                            else payload.positionName = name;

                            await axios.post('/api/master-list/org-structures', payload);
                            toast.success('Position added to division');
                            setNewPositionName('');
                            document.getElementById('existingPositionSelect').value = '';
                            refreshOfficersForDivision(selectedDivision);
                          } catch (err) { console.error(err); toast.error(err.response?.data?.error || 'Add failed'); }
                        }}
                        className="btn btn-primary"
                      >Add Position</button>
                    </div>
                  </div>

                  <div>
                    {officerLoading ? (
                      <div className="py-8 text-center">Loading officers...</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-on-surface-variant">
                            <th className="py-2">Position</th>
                            <th className="py-2">Unit</th>
                            <th className="py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {officersList.map(o => (
                            <tr key={o.id} className="border-t border-outline-variant/10">
                              <td className="py-2">{o.position_name}</td>
                              <td className="py-2">{o.unit_name}</td>
                              <td className="py-2">
                                <button onClick={async ()=>{
                                  if (!confirm('Delete officer?')) return;
                                  try {
                                    await axios.delete(`/api/master-list/org-structures/${o.id}`);
                                    toast.success('Deleted');
                                    refreshOfficersForDivision(selectedDivision);
                                  } catch (err) { console.error(err); toast.error(err.response?.data?.error || 'Delete failed'); }
                                }} className="text-red-600">Delete</button>
                              </td>
                            </tr>
                          ))}
                          {officersList.length === 0 && (
                            <tr><td colSpan={3} className="py-6 text-center text-on-surface-variant">No officers found</td></tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            ) : activeTab === "slideshow" ? (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-[#222] rounded disabled:opacity-50 transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="text-sm font-medium text-on-surface dark:text-white">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-[#222] rounded disabled:opacity-50 transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-[#222] rounded disabled:opacity-50 transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="text-sm font-medium text-on-surface dark:text-white">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-[#222] rounded disabled:opacity-50 transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl dark:shadow-black/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-primary to-primary-container dark:from-blue-600 dark:to-blue-700 px-6 py-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {getTabIcon(activeTab)}
                  {editingItem ? "Edit" : "Add"} {currentTab.title}
                </h3>
                <button onClick={closeModal} className="p-1 hover:bg-white/20 rounded transition">
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {currentTab.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{field.label}</label>
                    {renderFormField(field)}
                  </div>
                ))}

                {/* Form Actions */}
                <div className="flex gap-3 pt-6 border-t border-outline-variant/20 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-[#222] text-slate-900 dark:text-gray-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-[#2a2a2a] transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary dark:bg-blue-600 text-white rounded-lg font-medium hover:bg-primary/90 dark:hover:bg-blue-700 transition"
                  >
                    {editingItem ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Image Viewer Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-3 sm:p-4"
            onClick={() => {
              setSelectedImage(null);
              setViewerMenuOpen(false);
            }}
          >
            <div
              className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setViewerMenuOpen((prev) => !prev)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white backdrop-blur-sm transition hover:bg-white/20"
                    aria-label="More actions"
                  >
                    ⋮
                  </button>

                  {viewerMenuOpen && (
                    <div className="absolute right-0 top-12 flex min-w-[120px] flex-col rounded-xl border border-white/10 bg-white/95 p-1 shadow-xl">
                      <button
                        type="button"
                        onClick={async () => {
                          setViewerMenuOpen(false);
                          await startSlideshowEditorForImage(selectedImage);
                        }}
                        className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewerMenuOpen(false);
                          if (window.confirm("Are you sure you want to delete this image?")) {
                            handleDeleteImage(selectedImage.id);
                            setSelectedImage(null);
                          }
                        }}
                        className="rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setViewerMenuOpen(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl text-white backdrop-blur-sm transition hover:bg-white/20"
                  aria-label="Close image viewer"
                >
                  ×
                </button>
              </div>

              <div className="flex max-h-[90vh] items-center justify-center bg-slate-950">
                <img
                  src={selectedImage.image_url || selectedImage.imageUrl}
                  alt={selectedImage.title || "Slideshow image"}
                  className="max-h-[90vh] w-full object-contain"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
