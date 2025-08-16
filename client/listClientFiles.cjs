// listClientFiles.js
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname); // Points to client folder root
const allowedFolders = ["context", "public", "src", "assets", "components", "pages", "services"];
const allowedFiles = [
  "borrowingContext.jsx", "userContext.jsx", "Layout.jsx", "Navbar.jsx",
  "AdminUserManagement.jsx", "AvailableItems.jsx", "BorrowCart.jsx",
  "Dashboard.jsx", "DashboardAdmin.jsx", "DashboardBorrower.jsx", "DashboardStaff.jsx",
  "GetStarted.jsx", "Home.jsx", "Login.jsx", "Register.jsx", "ScanQR.jsx",
  "App.jsx", "main.jsx", "AdminReports.jsx", "ManageBorrowRequests.jsx", "ManageInventory.jsx", "ReturnItems.jsx", "reportService.js",
  "UnitModal.jsx", "inventoryService.js", "inventoryRoutes.js"
];

function listFolderContents(dir, depth = 0) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dir, item.name);
    const relativePath = path.relative(ROOT_DIR, itemPath);

    if (item.isDirectory() && allowedFolders.includes(item.name)) {
      console.log(`${"  ".repeat(depth)}📁 ${relativePath.replace(/\\/g, "/")}/`);
      listFolderContents(itemPath, depth + 1);
    } else if (item.isFile() && allowedFiles.includes(item.name)) {
      console.log(`${"  ".repeat(depth)}📄 ${relativePath.replace(/\\/g, "/")}`);
    }
  }
}

console.log("✅ Client Folder Structure (filtered):\n");
listFolderContents(ROOT_DIR);
