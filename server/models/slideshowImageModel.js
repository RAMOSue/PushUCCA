// server/models/slideshowImageModel.js
// CRUD operations for Slideshow Images
const pool = require("../db");
const path = require("path");
const fs = require("fs");

class SlideshowImageModel {
  // Get all slideshow images ordered by display_order
  static async getAll() {
    const result = await pool.query(
      "SELECT id, title, description, image_url, image_filename, created_by, created_at, display_order FROM slideshow_images ORDER BY display_order ASC, created_at DESC"
    );
    return result.rows;
  }

  // Get image by ID
  static async getById(id) {
    const result = await pool.query(
      "SELECT id, title, description, image_url, image_filename, created_by, created_at, display_order FROM slideshow_images WHERE id = $1",
      [id]
    );
    return result.rows[0];
  }

  // Create new slideshow image
  static async create(title, description, imagePath, imageFilename, fileSize, mimeType, createdBy) {
    // Title may be empty; ensure imagePath is present
    if (!imagePath) throw new Error("Image path is required");

    const result = await pool.query(
      `INSERT INTO slideshow_images (title, description, image_url, image_filename, file_size, mime_type, created_by, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(display_order), -1) + 1 FROM slideshow_images))
       RETURNING id, title, description, image_url, image_filename, created_by, created_at, display_order`,
      [title, description || null, imagePath, imageFilename, fileSize, mimeType, createdBy]
    );
    return result.rows[0];
  }

  // Update slideshow image
  static async update(id, { title, description, display_order }) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramCount++}`);
      values.push(display_order);
    }

    // Always update updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    if (updates.length === 1) {
      // Only updated_at changed
      const result = await pool.query(
        `UPDATE slideshow_images SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        values
      );
      return result.rows[0];
    }

    const query = `UPDATE slideshow_images SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id, title, description, image_url, display_order, created_at`;
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Delete slideshow image (also delete file from disk)
  static async delete(id) {
    // Get the image record first to get the file path
    const image = await this.getById(id);
    if (!image) throw new Error("Image not found");

    // Delete from database
    const result = await pool.query("DELETE FROM slideshow_images WHERE id = $1 RETURNING id", [id]);

    // Delete file from disk if it exists
    if (image.image_filename) {
      const uploadDir = path.join(__dirname, "../uploads");
      const filePath = path.join(uploadDir, image.image_filename);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`Error deleting file ${filePath}:`, err.message);
        // Don't throw error - image record is already deleted from DB
      }
    }

    return result.rows[0];
  }

  // Reorder images by updating display_order
  static async reorder(imageOrders) {
    // imageOrders should be array of { id, display_order }
    const updates = [];
    const values = [];

    for (let i = 0; i < imageOrders.length; i++) {
      const { id, display_order } = imageOrders[i];
      updates.push(`UPDATE slideshow_images SET display_order = $${i * 2 + 1} WHERE id = $${i * 2 + 2}`);
      values.push(display_order, id);
    }

    if (updates.length === 0) return [];

    // Execute all updates
    try {
      const query = updates.join("; ") + ";";
      await pool.query(query, values);
      return this.getAll();
    } catch (err) {
      throw new Error(`Reorder failed: ${err.message}`);
    }
  }
}

module.exports = SlideshowImageModel;
