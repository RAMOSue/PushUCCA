const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Backend base URL (set in .env)
const BASE_URL = process.env.BASE_URL || "http://localhost:8000";

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "profiles");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------------------
// Multer setup
// ---------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    const safeName = `${base}-${Date.now()}${ext}`;
    cb(null, safeName);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPEG/PNG images and PDF allowed"), false);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// Helper: convert relative path to full URL
function toFullUrl(filePath) {
  return filePath ? `${BASE_URL}${filePath}` : null;
}

// ---------------------------
// Borrower: upload profile
// ---------------------------
exports.uploadProfile = [
  upload.fields([
    { name: "profile_pic", maxCount: 1 },
    { name: "birth_certificate", maxCount: 1 },
    { name: "class_schedule", maxCount: 1 },
    { name: "id_front", maxCount: 1 },
    { name: "id_back", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ error: "Missing user id" });

      const profilePic = req.files?.profile_pic?.[0]
        ? `/uploads/profiles/${req.files.profile_pic[0].filename}`
        : null;
      const birthCert = req.files?.birth_certificate?.[0]
        ? `/uploads/profiles/${req.files.birth_certificate[0].filename}`
        : null;
      const classSchedule = req.files?.class_schedule?.[0]
        ? `/uploads/profiles/${req.files.class_schedule[0].filename}`
        : null;
      const idFront = req.files?.id_front?.[0]
        ? `/uploads/profiles/${req.files.id_front[0].filename}`
        : null;
      const idBack = req.files?.id_back?.[0]
        ? `/uploads/profiles/${req.files.id_back[0].filename}`
        : null;

      const query = `
        INSERT INTO user_profiles 
          (user_id, profile_pic_url, birth_certificate_url, class_schedule_url, id_front_url, id_back_url, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE
          SET profile_pic_url = COALESCE(EXCLUDED.profile_pic_url, user_profiles.profile_pic_url),
              birth_certificate_url = COALESCE(EXCLUDED.birth_certificate_url, user_profiles.birth_certificate_url),
              class_schedule_url = COALESCE(EXCLUDED.class_schedule_url, user_profiles.class_schedule_url),
              id_front_url = COALESCE(EXCLUDED.id_front_url, user_profiles.id_front_url),
              id_back_url = COALESCE(EXCLUDED.id_back_url, user_profiles.id_back_url),
              updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const vals = [userId, profilePic, birthCert, classSchedule, idFront, idBack];
      const result = await pool.query(query, vals);

      const profile = result.rows[0];
      res.json({
        success: true,
        profile: {
          ...profile,
          profile_pic_url: toFullUrl(profile.profile_pic_url),
          birth_certificate_url: toFullUrl(profile.birth_certificate_url),
          class_schedule_url: toFullUrl(profile.class_schedule_url),
          id_front_url: toFullUrl(profile.id_front_url),
          id_back_url: toFullUrl(profile.id_back_url),
        },
      });
    } catch (err) {
      console.error("uploadProfile error:", err);
      res.status(500).json({ error: "Upload failed", details: err.message });
    }
  },
];

// ---------------------------
// Borrower: get own profile
// ---------------------------
exports.getMyProfile = async (req, res) => {
  try {
    const id = req.user?.id;
    if (!id) return res.status(400).json({ error: "Missing user id" });

    const q = `
      SELECT u.id, u.name, u.email, u.role,
             p.profile_pic_url, p.birth_certificate_url, p.class_schedule_url,
             p.id_front_url, p.id_back_url, p.updated_at
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = $1;
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Profile not found" });

    const profile = rows[0];
    res.json({
      ...profile,
      profile_pic_url: toFullUrl(profile.profile_pic_url),
      birth_certificate_url: toFullUrl(profile.birth_certificate_url),
      class_schedule_url: toFullUrl(profile.class_schedule_url),
      id_front_url: toFullUrl(profile.id_front_url),
      id_back_url: toFullUrl(profile.id_back_url),
    });
  } catch (err) {
    console.error("getMyProfile error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

// ---------------------------
// Admin/Staff: get all profiles
// ---------------------------
exports.getAllProfiles = async (req, res) => {
  try {
    const q = `
      SELECT u.id, u.name, u.email, u.role,
             p.profile_pic_url, p.birth_certificate_url, p.class_schedule_url,
             p.id_front_url, p.id_back_url, p.updated_at
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      ORDER BY u.id;
    `;
    const { rows } = await pool.query(q);
    const profiles = rows.map(p => ({
      ...p,
      profile_pic_url: toFullUrl(p.profile_pic_url),
      birth_certificate_url: toFullUrl(p.birth_certificate_url),
      class_schedule_url: toFullUrl(p.class_schedule_url),
      id_front_url: toFullUrl(p.id_front_url),
      id_back_url: toFullUrl(p.id_back_url),
    }));
    res.json(profiles);
  } catch (err) {
    console.error("getAllProfiles error:", err);
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
};

// ---------------------------
// Admin/Staff: get profile by ID
// ---------------------------
exports.getProfileById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid or missing id" });

    const q = `
      SELECT u.id, u.name, u.email, u.role,
             p.profile_pic_url, p.birth_certificate_url, p.class_schedule_url,
             p.id_front_url, p.id_back_url, p.updated_at
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = $1;
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Profile not found" });

    const profile = rows[0];
    res.json({
      ...profile,
      profile_pic_url: toFullUrl(profile.profile_pic_url),
      birth_certificate_url: toFullUrl(profile.birth_certificate_url),
      class_schedule_url: toFullUrl(profile.class_schedule_url),
      id_front_url: toFullUrl(profile.id_front_url),
      id_back_url: toFullUrl(profile.id_back_url),
    });
  } catch (err) {
    console.error("getProfileById error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

// ---------------------------
// ✅ Fixed: Download profile file
// ---------------------------
exports.downloadFile = async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: "Missing file path" });

    // Clean up and ensure we stay within uploads folder
    const safePath = filePath.replace(/^\/+/, ""); // remove leading slashes
    const fullPath = path.join(__dirname, "..", "public", safePath);

    if (!fs.existsSync(fullPath)) {
      console.error("File not found:", fullPath);
      return res.status(404).json({ error: "File not found" });
    }

    // Set headers for download
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(fullPath)}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error("downloadFile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
