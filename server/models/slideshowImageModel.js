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
  static async update(id, { title, description, display_order, image_url, image_filename, file_size, mime_type }) {
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
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCount++}`);
      values.push(image_url);
    }
    if (image_filename !== undefined) {
      updates.push(`image_filename = $${paramCount++}`);
      values.push(image_filename);
    }
    if (file_size !== undefined) {
      updates.push(`file_size = $${paramCount++}`);
      values.push(file_size);
    }
    if (mime_type !== undefined) {
      updates.push(`mime_type = $${paramCount++}`);
      values.push(mime_type);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE slideshow_images SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id, title, description, image_url, image_filename, file_size, mime_type, display_order, created_at, updated_at`;
    const result = await pool.query(query, values);
    const updatedImage = result.rows[0];

    if (!updatedImage || image_filename === undefined) {
      return updatedImage;
    }

    const previousImage = await this.getById(id);
    if (!previousImage || !previousImage.image_filename || previousImage.image_filename === image_filename) {
      return updatedImage;
    }

    const uploadDir = path.join(__dirname, "../uploads/slideshow");
    const filePath = path.join(uploadDir, previousImage.image_filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`Error deleting old slideshow file ${filePath}:`, err.message);
    }

    return updatedImage;
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
      const uploadDir = path.join(__dirname, "../uploads/slideshow");
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
    if (!Array.isArray(imageOrders) || imageOrders.length === 0) return [];

    const normalizedOrders = imageOrders.map((image, index) => ({
      id: image.id,
      display_order: index,
    }));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const { id, display_order } of normalizedOrders) {
        await client.query("UPDATE slideshow_images SET display_order = $1 WHERE id = $2", [display_order, id]);
      }

      await client.query("COMMIT");
      return this.getAll();
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Reorder failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

module.exports = SlideshowImageModel;
