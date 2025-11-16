import torch
import torch.nn as nn
import torchvision.models as models

class QRCNN(nn.Module):
    def __init__(self, num_classes=100):
        super(QRCNN, self).__init__()
        # Use pretrained MobileNetV3 small for speed
        self.model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        self.model.classifier[3] = nn.Linear(self.model.classifier[3].in_features, num_classes)

    def forward(self, x):
        return self.model(x)
