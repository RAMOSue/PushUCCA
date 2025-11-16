import os

print("Testing file paths...")
print(f"Current working directory: {os.getcwd()}")
print(f"Script location: {os.path.abspath(__file__)}")
print(f"Script directory: {os.path.dirname(os.path.abspath(__file__))}")

current_dir = os.path.dirname(os.path.abspath(__file__))
html_path = os.path.join(current_dir, "testing", "index.html")
print(f"\nLooking for HTML at: {html_path}")
print(f"File exists: {os.path.exists(html_path)}")

if os.path.exists(html_path):
    print("✓ HTML file found!")
else:
    print("✗ HTML file NOT found!")
    print("\nListing files in testing directory:")
    testing_dir = os.path.join(current_dir, "testing")
    if os.path.exists(testing_dir):
        for file in os.listdir(testing_dir):
            print(f"  - {file}")
    else:
        print("  testing directory doesn't exist!")

print("\nTesting model files in parent directory...")
parent_dir = os.path.dirname(current_dir)
print(f"Parent directory: {parent_dir}")

for model in ["yolo11n.pt", "yolov8s.pt"]:
    model_path = os.path.join(parent_dir, model)
    print(f"{model}: {'✓ Found' if os.path.exists(model_path) else '✗ Not found'}")
