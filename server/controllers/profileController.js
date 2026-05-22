const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { verifySchoolID } = require("../services/schoolIDDetectionService");

// ✅ Backend server URL (set in .env, defaults to port 8000 in dev)
// In production, this should be your Render backend URL
const SERVER_URL = process.env.SERVER_URL || "http://localhost:8000";

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
  return filePath ? `${SERVER_URL}${filePath}` : null;
}

// Helper: Backwards-compatible profile query
// Tries to include division info, falls back if column doesn't exist
async function getProfileWithDivision(userId) {
  try {
    // Try the new query with division_id
    const qWithDivision = `
      SELECT u.id, u.name, u.email, u.phone, u.role, u.division_id,
             d.name as department_name, d.description as department_description,
             p.profile_pic_url, p.birth_certificate_url, p.class_schedule_url,
             p.id_front_url, p.id_back_url, p.updated_at
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      LEFT JOIN divisions d ON u.division_id = d.id
      WHERE u.id = $1;
    `;
    const { rows } = await pool.query(qWithDivision, [userId]);
    return rows[0] || null;
  } catch (err) {
    // If division_id column doesn't exist, fall back to old query
    if (err.message.includes("division_id") || err.message.includes("unknown column")) {
      console.warn("⚠️ division_id column not found - running migration will enable department tracking");
      const qWithoutDivision = `
        SELECT u.id, u.name, u.email, u.phone, u.role,
               p.profile_pic_url, p.birth_certificate_url, p.class_schedule_url,
               p.id_front_url, p.id_back_url, p.updated_at
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.id = $1;
      `;
      const { rows } = await pool.query(qWithoutDivision, [userId]);
      return rows[0] || null;
    }
    throw err;
  }
}

// Helper: Get all profiles with division info (backwards compatible)
async function getAllProfilesWithDivisions() {
  try {
    const qWithDivision = `
      SELECT u.id, u.name, u.email, u.phone, u.role, u.division_id,
             d.name as department_name, d.description as department_description,
             p.profile_pic_url, p.birth_certificate_url, p.class_schedule_url,
             p.id_front_url, p.id_back_url, p.updated_at
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      LEFT JOIN divisions d ON u.division_id = d.id
      ORDER BY u.id;
    `;
    const { rows } = await pool.query(qWithDivision);
    return rows;
  } catch (err) {
    if (err.message.includes("division_id") || err.message.includes("unknown column")) {
      console.warn("⚠️ division_id column not found - running migration will enable department tracking");
      const qWithoutDivision = `
        SELECT u.id, u.name, u.email, u.phone, u.role,
               p.profile_pic_url, p.birth_certificate_url, p.class_schedule_url,
               p.id_front_url, p.id_back_url, p.updated_at
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        ORDER BY u.id;
      `;
      const { rows } = await pool.query(qWithoutDivision);
      return rows;
    }
    throw err;
  }
}

// Helper: Try to update division_id if column exists
async function updateDivisionIfExists(userId, divisionId) {
  if (!divisionId) return; // Skip if no division provided
  try {
    await pool.query("UPDATE users SET division_id = $1 WHERE id = $2", [divisionId, userId]);
  } catch (err) {
    if (err.message.includes("division_id") || err.message.includes("unknown column")) {
      console.warn("⚠️ division_id column not found - run migration to enable department tracking");
      return;
    }
    throw err;
  }
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

      // Only insert/update if at least one file was uploaded
      if (!profilePic && !birthCert && !classSchedule && !idFront && !idBack) {
        return res.status(400).json({ error: "No files provided" });
      }

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
      await pool.query(query, vals);

      // Fetch updated profile with all user data
      const profile = await getProfileWithDivision(userId);

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
    if (!id) {
      console.warn("⚠️ getMyProfile: Missing user id from token");
      return res.status(400).json({ error: "Missing user id" });
    }

    // First, verify user exists
    const userQuery = await pool.query(
      "SELECT id, name, email, phone, role, division_id FROM users WHERE id = $1",
      [id]
    );
    
    if (!userQuery.rows[0]) {
      console.warn(`⚠️ getMyProfile: User ${id} not found`);
      return res.status(404).json({ error: "User not found" });
    }

    const user = userQuery.rows[0];

    // Try to get profile with division, but don't fail if it doesn't exist
    let profile = await getProfileWithDivision(id);
    
    // If profile doesn't exist, try to create it
    if (!profile) {
      try {
        await pool.query(
          "INSERT INTO user_profiles (user_id, updated_at) VALUES ($1, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO NOTHING",
          [id]
        );
        profile = await getProfileWithDivision(id);
      } catch (err) {
        console.warn(`⚠️ Could not create user_profiles record for user ${id}:`, err.message);
        // Fall back to returning just the user data without profile pics
        profile = user;
      }
    }

    // Ensure we always have a profile object to return
    if (!profile) {
      profile = user;
    }

    res.json({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone || null,
      role: profile.role,
      division_id: profile.division_id || null,
      department_name: profile.department_name || null,
      department_description: profile.department_description || null,
      profile_pic_url: profile.profile_pic_url ? toFullUrl(profile.profile_pic_url) : null,
      birth_certificate_url: profile.birth_certificate_url ? toFullUrl(profile.birth_certificate_url) : null,
      class_schedule_url: profile.class_schedule_url ? toFullUrl(profile.class_schedule_url) : null,
      id_front_url: profile.id_front_url ? toFullUrl(profile.id_front_url) : null,
      id_back_url: profile.id_back_url ? toFullUrl(profile.id_back_url) : null,
      updated_at: profile.updated_at || new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ getMyProfile error:", err.message);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

// ---------------------------
// Update profile info (name, phone, division)
// ---------------------------
exports.updateProfileInfo = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(400).json({ error: "Missing user id" });

    const { name, phone, division_id } = req.body;

    // Build dynamic UPDATE query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (name && typeof name === "string" && name.trim()) {
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(name.trim());
      paramCount++;
    }

    if (phone && typeof phone === "string" && phone.trim()) {
      updateFields.push(`phone = $${paramCount}`);
      updateValues.push(phone.trim());
      paramCount++;
    }

    if (division_id && !isNaN(parseInt(division_id, 10))) {
      updateFields.push(`division_id = $${paramCount}`);
      updateValues.push(parseInt(division_id, 10));
      paramCount++;
    }

    // Only run UPDATE if there are fields to update
    if (updateFields.length > 0) {
      updateValues.push(userId);
      const updateQuery = `UPDATE users SET ${updateFields.join(", ")} WHERE id = $${paramCount}`;
      await pool.query(updateQuery, updateValues);
    }

    // Fetch and return updated profile
    const profile = await getProfileWithDivision(userId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

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
    console.error("updateProfileInfo error:", err);
    res.status(500).json({ error: "Failed to update profile", details: err.message });
  }
};

// ---------------------------
// Admin/Staff: get all profiles
// ---------------------------
exports.getAllProfiles = async (req, res) => {
  try {
    const rows = await getAllProfilesWithDivisions();
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

    const profile = await getProfileWithDivision(id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

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

// ---------------------------
// 🆕 School ID Verification
// Detects if captured image is a valid school ID
// ---------------------------
exports.verifySchoolId = async (req, res) => {
  try {
    const { image, fieldName, expectedType } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    if (!fieldName || !["id_front", "id_back"].includes(fieldName)) {
      return res.status(400).json({ error: "Invalid fieldName. Must be 'id_front' or 'id_back'" });
    }

    // Convert base64 to buffer
    let imageBuffer;
    if (image.startsWith("data:image")) {
      // Data URL format
      const base64Data = image.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
    } else {
      // Direct base64
      imageBuffer = Buffer.from(image, "base64");
    }

    // Verify the image using AI/OCR detection
    const verificationResult = await verifySchoolID(imageBuffer, fieldName);

    // Log verification for audit trail
    console.log("School ID Verification:", {
      userId: req.user?.id,
      fieldName,
      isValid: verificationResult.isValid,
      isSchoolID: verificationResult.isSchoolID,
      confidence: verificationResult.confidence,
      schoolName: verificationResult.schoolName,
      timestamp: new Date(),
    });

    // Return detailed result for frontend feedback
    res.json(verificationResult);
  } catch (error) {
    console.error("School ID verification error:", error);
    res.status(500).json({
      error: "Failed to verify school ID",
      details: error.message,
      isValid: false,
      isSchoolID: false,
      confidence: 0,
    });
  }
};

