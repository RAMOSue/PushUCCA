// listServerFiles.js
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname); // points to the server folder
const allowedFolders = ["controllers", "middleware", "routes", "config", "helpers", "models", "public"];
const allowedFiles = [
  "authController.js","borrowController.js","inventoryController.js", "requireRole.js", "user.js", "authRoutes.js", "borrowRoutes.js", "inventoryRoutes.js",
  "auth.js", "index.js", "db.js", "passport.js", "server.js", "reportController.js", "reportRoutes.js", "qr_codes"
];

function listFolderContents(dir, depth = 0) {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dir, item.name);
    const relative = path.relative(ROOT_DIR, itemPath);

    if (item.isDirectory() && allowedFolders.includes(item.name)) {
      console.log(`${"  ".repeat(depth)}📁 ${relative}/`);
      listFolderContents(itemPath, depth + 1);
    } else if (item.isFile() && allowedFiles.includes(item.name)) {
      console.log(`${"  ".repeat(depth)}📄 ${relative}`);
    }
  }
}

console.log("✅ Server Folder Structure (filtered):\n");
listFolderContents(ROOT_DIR);
