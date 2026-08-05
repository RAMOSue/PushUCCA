// server/controllers/slideshowImageController.js
// Controller for Slideshow Image operations
const SlideshowImageModel = require("../models/slideshowImageModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Backend server URL (set in .env). In production, ensure SERVER_URL is the full https:// URL.
const isProd = process.env.NODE_ENV === "production";
const SERVER_URL = process.env.SERVER_URL || (isProd ? "" : "http://localhost:8000");

// Helper: convert relative or absolute path to full URL
function toFullUrl(filePath) {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) {
    return isProd ? filePath.replace(/^http:\/\//i, "https://") : filePath;
  }
  if (SERVER_URL) {
    const base = isProd ? SERVER_URL.replace(/^http:\/\//i, "https://") : SERVER_URL;
    return base + filePath;
  }
  return filePath;
}

// Helper: transform image_url to proper full URL
function transformImageUrl(imageUrl, defaultPath) {
  if (!imageUrl) return toFullUrl(defaultPath);
  
  if (imageUrl.startsWith('http')) {
    return imageUrl; // Already a full URL
  }
  
  // It's a relative path
  if (!imageUrl.startsWith('/uploads')) {
    imageUrl = `/uploads/slideshow/${imageUrl}`;
  }
  return toFullUrl(imageUrl);
}

// ======================== FILE UPLOAD SETUP ========================
const uploadDir = path.join(__dirname, "../uploads/slideshow");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
    cb(null, `${timestamp}-${originalName}`);
  },
});

// File filter: only images allowed
function fileFilter(req, file, cb) {
  const allowedMimes = ["image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPG, PNG, GIF, WEBP) are allowed!"));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

// ======================== CONTROLLERS ========================

// Get all slideshow images
const getAllImages = async (req, res) => {
  try {
    const images = await SlideshowImageModel.getAll();
    // Transform image_url to include full path for frontend
    const transformedImages = images.map(img => ({
      ...img,
      image_url: transformImageUrl(img.image_url, `/uploads/slideshow/${img.image_filename}`),
      imageUrl: transformImageUrl(img.image_url, `/uploads/slideshow/${img.image_filename}`) // Alternative property name
    }));
    res.json(transformedImages);
  } catch (err) {
    console.error("Get slideshow images error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get single image by ID
const getImageById = async (req, res) => {
  try {
    const { id } = req.params;
    const image = await SlideshowImageModel.getById(id);
    if (!image) return res.status(404).json({ error: "Image not found" });

    res.json({
      ...image,
      image_url: transformImageUrl(image.image_url, `/uploads/slideshow/${image.image_filename}`),
    });
  } catch (err) {
    console.error("Get slideshow image error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Create slideshow image (with file upload)
const createImage = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const { title, description } = req.body;

    // Allow missing title — fall back to original filename or empty string
    const safeTitle = title && title.trim() ? title.trim() : (req.file.originalname ? req.file.originalname : "");

    // Create relative path for image_url (stored in DB)
    const imagePath = `/uploads/slideshow/${req.file.filename}`;

    // Create image record in database
    const image = await SlideshowImageModel.create(
      safeTitle,
      description ? description.trim() : null,
      imagePath,
      req.file.filename,
      req.file.size,
      req.file.mimetype,
      req.user.id
    );

    // Return created image with full URL
    return res.status(201).json({
      ...image,
      image_url: imagePath,
      message: "Image uploaded successfully"
    });
  } catch (err) {
    // Delete uploaded file if error occurs
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (deleteErr) {
        console.error("Error deleting uploaded file:", deleteErr);
      }
    }

    console.error("Create slideshow image error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Update slideshow image metadata (title, description, display_order)
const updateImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, display_order } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (display_order !== undefined) updateData.display_order = display_order;

    const image = await SlideshowImageModel.update(id, updateData);
    if (!image) return res.status(404).json({ error: "Image not found" });

    res.json({
      ...image,
      image_url: transformImageUrl(image.image_url, `/uploads/slideshow/${image.image_filename}`),
      message: "Image updated successfully"
    });
  } catch (err) {
    console.error("Update slideshow image error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Delete slideshow image
const deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    const image = await SlideshowImageModel.delete(id);

    res.json({
      success: true,
      message: "Image deleted successfully",
      deletedId: image.id
    });
  } catch (err) {
    console.error("Delete slideshow image error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Reorder images
const reorderImages = async (req, res) => {
  try {
    const { imageOrders } = req.body; // Expected: array of { id, display_order }

    if (!Array.isArray(imageOrders)) {
      return res.status(400).json({ error: "imageOrders must be an array" });
    }

    const images = await SlideshowImageModel.reorder(imageOrders);
    res.json({
      success: true,
      message: "Images reordered successfully",
      images: images.map(img => ({
        ...img,
        image_url: transformImageUrl(img.image_url, `/uploads/slideshow/${img.image_filename}`),
      }))
    });
  } catch (err) {
    console.error("Reorder slideshow images error:", err);
    res.status(400).json({ error: err.message });
  }
};

module.exports = {
  getAllImages,
  getImageById,
  createImage,
  updateImage,
  deleteImage,
  reorderImages,
  upload, // Export multer middleware for use in routes
};
