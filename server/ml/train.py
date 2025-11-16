# ml/train.py
import os
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
from pathlib import Path

# ------------------------------
# ✅ Configuration
# ------------------------------
DATASET_DIR = "ml/dataset"
AUGMENTED_DIR = "ml/dataset_augmented"
MODEL_PATH = "ml/qr_model.pt"
EPOCHS = 10
BATCH_SIZE = 8
LEARNING_RATE = 1e-4
IMG_SIZE = 224

# ------------------------------
# ✅ Device setup
# ------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

# ------------------------------
# ✅ Data transforms
# ------------------------------
transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.5], [0.5])
])

# ------------------------------
# ✅ Combine base + augmented dataset (if available)
# ------------------------------
dataset_paths = []
if os.path.isdir(DATASET_DIR):
    dataset_paths.append(DATASET_DIR)
if os.path.isdir(AUGMENTED_DIR):
    dataset_paths.append(AUGMENTED_DIR)

if not dataset_paths:
    raise FileNotFoundError("No dataset found. Please ensure 'ml/dataset/' or 'ml/dataset_augmented/' exists.")

# Merge datasets
datasets_list = [datasets.ImageFolder(root=path, transform=transform) for path in dataset_paths]
full_dataset = torch.utils.data.ConcatDataset(datasets_list)

# Class mapping (for label → qr text)
id_to_qr = {}
idx = 0
for ds in datasets_list:
    for label_name in ds.classes:
        if label_name not in id_to_qr.values():
            id_to_qr[idx] = label_name
            idx += 1

# ------------------------------
# ✅ Split dataset (80/20)
# ------------------------------
train_size = int(0.8 * len(full_dataset))
val_size = len(full_dataset) - train_size
train_dataset, val_dataset = torch.utils.data.random_split(full_dataset, [train_size, val_size])

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

print(f"Training on {len(train_dataset)} images, validating on {len(val_dataset)} images")

# ------------------------------
# ✅ Model setup (MobileNetV3 Small)
# ------------------------------
num_classes = len(id_to_qr)
model = models.mobilenet_v3_small(pretrained=True)
model.classifier[3] = nn.Linear(model.classifier[3].in_features, num_classes)
model = model.to(device)

criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

# ------------------------------
# ✅ Training loop
# ------------------------------
best_acc = 0.0

for epoch in range(EPOCHS):
    model.train()
    running_loss = 0.0
    for inputs, labels in train_loader:
        inputs, labels = inputs.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item()

    avg_loss = running_loss / len(train_loader)

    # --------------------------
    # Validation
    # --------------------------
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            outputs = model(inputs)
            _, preds = torch.max(outputs, 1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

    acc = 100 * correct / total
    print(f"Epoch [{epoch+1}/{EPOCHS}] - Loss: {avg_loss:.4f}, Val Acc: {acc:.2f}%")

    if acc > best_acc:
        best_acc = acc
        torch.save(model.state_dict(), MODEL_PATH)
        print(f"✅ New best model saved to {MODEL_PATH}")

print(f"Training complete! Best validation accuracy: {best_acc:.2f}%")
