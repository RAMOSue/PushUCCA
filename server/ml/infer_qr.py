import sys
import torch
from torchvision import transforms
from PIL import Image
from model import QRCNN

# ✅ Map class ID → QR folder name (update if you add more folders)
id_to_qr = {
    0: "qr_001"
}

# ✅ Initialize model
model = QRCNN(num_classes=len(id_to_qr))

# ✅ Load model weights
state_dict = torch.load("ml/qr_model.pt", map_location="cpu")
model.load_state_dict(state_dict, strict=False)
model.eval()

# ✅ Check for argument
if len(sys.argv) < 2:
    print("Usage: python ml/infer_qr.py <path_to_image>")
    sys.exit(1)

img_path = sys.argv[1]

# ✅ Preprocess image
img = Image.open(img_path).convert("RGB")
preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ColorJitter(brightness=0.3, contrast=0.3),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

tensor = preprocess(img).unsqueeze(0)

# ✅ Inference
with torch.no_grad():
    preds = model(tensor)
    label = preds.argmax(dim=1).item()

# ✅ Output
predicted_qr = id_to_qr.get(label, "Unknown")
print(f"Predicted QR Folder: {predicted_qr}")
