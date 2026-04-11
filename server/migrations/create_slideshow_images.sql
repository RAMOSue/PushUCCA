-- ============================================================================
-- SLIDESHOW IMAGES TABLE CREATION MIGRATION
-- Stores GetStarted page slideshow images that can be managed via Master List
-- ============================================================================

-- ======================== SLIDESHOW_IMAGES TABLE ========================
-- Manages images displayed in the GetStarted page slideshow
CREATE TABLE IF NOT EXISTS slideshow_images (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500) NOT NULL,
    image_filename VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(50),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    display_order INTEGER DEFAULT 0
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_slideshow_images_created_at ON slideshow_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slideshow_images_display_order ON slideshow_images(display_order);
CREATE INDEX IF NOT EXISTS idx_slideshow_images_created_by ON slideshow_images(created_by);

-- ============================================================================
-- NOTES
-- ============================================================================
-- image_url: Path to the uploaded image file (relative to /public/uploads/)
-- display_order: Used to control the order of images in the slideshow (ASC)
-- created_by: User who uploaded the image
-- ============================================================================
