# ml/augment_dataset.py
import os
import cv2
import random
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from pathlib import Path

# Folder paths (relative to repo root where you run the script)
DATASET_DIR = "ml/dataset"           # your original labeled folders (qr_001, qr_002, ...)
AUGMENTED_DIR = "ml/dataset_augmented"

# Create output directory if missing
os.makedirs(AUGMENTED_DIR, exist_ok=True)

# Augmentation parameters
ROTATION_RANGE = 15
SCALE_RANGE = (0.9, 1.1)
BRIGHTNESS_RANGE = (0.7, 1.3)
CONTRAST_RANGE = (0.7, 1.3)

def add_noise_pil(pil_img, mean=0, sigma=8):
    """Add Gaussian noise to a PIL image and return a PIL image."""
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR).astype(np.float32)
    noise = np.random.normal(mean, sigma, cv_img.shape).astype(np.float32)
    noisy = cv_img + noise
    noisy = np.clip(noisy, 0, 255).astype(np.uint8)
    return Image.fromarray(cv2.cvtColor(noisy, cv2.COLOR_BGR2RGB))

def augment_image(img_path, output_dir, count=5):
    img = Image.open(img_path).convert("RGB")
    base_stem = Path(img_path).stem

    for i in range(count):
        aug = img.copy()

        # Random rotation
        angle = random.uniform(-ROTATION_RANGE, ROTATION_RANGE)
        aug = aug.rotate(angle, expand=True)

        # Random scale (resize then center-crop/pad back to original proportion if needed)
        scale = random.uniform(*SCALE_RANGE)
        w, h = aug.size
        new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
        aug = aug.resize((new_w, new_h))

        # If scaled image is bigger/smaller, center-crop or pad to original size proportionally
        # We'll resize final image to a consistent size later (handled during training)
        # Random brightness & contrast
        enhancer_brightness = ImageEnhance.Brightness(aug)
        aug = enhancer_brightness.enhance(random.uniform(*BRIGHTNESS_RANGE))

        enhancer_contrast = ImageEnhance.Contrast(aug)
        aug = enhancer_contrast.enhance(random.uniform(*CONTRAST_RANGE))

        # Random blur
        if random.random() > 0.5:
            aug = aug.filter(ImageFilter.GaussianBlur(radius=random.uniform(0, 1.5)))

        # Random noise
        if random.random() > 0.5:
            aug = add_noise_pil(aug, mean=0, sigma=random.uniform(4, 12))

        # Small perspective transform (approx)
        if random.random() > 0.7:
            pts1 = np.float32([[0,0], [aug.width,0], [0,aug.height], [aug.width, aug.height]])
            shift = 0.06  # max shift as fraction of size
            dx = random.uniform(-shift, shift) * aug.width
            dy = random.uniform(-shift, shift) * aug.height
            pts2 = np.float32([[dx, dy],
                               [aug.width - dx, random.uniform(-shift, shift)*aug.height],
                               [random.uniform(-shift, shift)*aug.width, aug.height - dy],
                               [aug.width - random.uniform(-shift, shift)*aug.width, aug.height - dy]])
            try:
                M = cv2.getPerspectiveTransform(pts1, pts2)
                cv_img = cv2.cvtColor(np.array(aug), cv2.COLOR_RGB2BGR)
                warped = cv2.warpPerspective(cv_img, M, (aug.width, aug.height), borderMode=cv2.BORDER_REPLICATE)
                aug = Image.fromarray(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB))
            except Exception:
                # fallback to no transform on error
                pass

        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)

        # Save file
        output_path = os.path.join(output_dir, f"{base_stem}_aug{i}.jpg")
        aug.save(output_path, quality=90)

def main():
    if not os.path.isdir(DATASET_DIR):
        print(f"Dataset directory not found: {DATASET_DIR}")
        return

    labels = [d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))]
    if not labels:
        print(f"No label folders found inside {DATASET_DIR}. Expected structure: {DATASET_DIR}/<label>/*.jpg")
        return

    for label_dir in labels:
        src_dir = os.path.join(DATASET_DIR, label_dir)
        dest_dir = os.path.join(AUGMENTED_DIR, label_dir)
        os.makedirs(dest_dir, exist_ok=True)

        for filename in os.listdir(src_dir):
            if not filename.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            file_path = os.path.join(src_dir, filename)
            try:
                augment_image(file_path, dest_dir, count=5)
            except Exception as e:
                print(f"Failed augmenting {file_path}: {e}")

    print("✅ Augmentation complete! Check:", AUGMENTED_DIR)

if __name__ == "__main__":
    main()
