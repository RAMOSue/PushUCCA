#!/usr/bin/env node

/**
 * Debug script to test the ID verification service directly
 */

const path = require("path");
const fs = require("fs");

console.log("🔧 ID Verification Service Debugger\n");
console.log("Current directory:", process.cwd());
console.log("Node version:", process.version);
console.log("NPM version:", require("child_process").execSync("npm --version", { encoding: "utf8" }).trim());

// Check if node_modules exists
console.log("\n1️⃣  Checking dependencies...");
const nodeModulesPath = path.join(__dirname, "node_modules");
if (fs.existsSync(nodeModulesPath)) {
  console.log("   ✅ node_modules directory exists");
  
  // Check for tesseract.js
  const tesseractPath = path.join(nodeModulesPath, "tesseract.js");
  if (fs.existsSync(tesseractPath)) {
    console.log("   ✅ tesseract.js found at:", tesseractPath);
  } else {
    console.log("   ❌ tesseract.js NOT found in node_modules");
    console.log("   Run: npm install tesseract.js sharp --save");
    process.exit(1);
  }
  
  // Check for sharp
  const sharpPath = path.join(nodeModulesPath, "sharp");
  if (fs.existsSync(sharpPath)) {
    console.log("   ✅ sharp found at:", sharpPath);
  } else {
    console.log("   ❌ sharp NOT found in node_modules");
    console.log("   Run: npm install tesseract.js sharp --save");
    process.exit(1);
  }
} else {
  console.log("   ❌ node_modules directory NOT found!");
  console.log("   Run: npm install");
  process.exit(1);
}

// Try to require the service
console.log("\n2️⃣  Loading schoolIDDetectionService...");
try {
  const { verifySchoolID } = require("./services/schoolIDDetectionService");
  console.log("   ✅ Service loaded successfully");
  
  // Try creating a test image
  console.log("\n3️⃣  Creating test image...");
  const testImageBuffer = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
  ]);
  console.log("   ✅ Test image created (", testImageBuffer.length, "bytes )");
  
  console.log("\n4️⃣  Testing verification function...");
  verifySchoolID(testImageBuffer, "id_front").then((result) => {
    console.log("   ✅ Verification function executed");
    console.log("   Result:");
    console.log("   - isSchoolID:", result.isSchoolID);
    console.log("   - confidence:", result.confidence);
    console.log("   - error:", result.error);
    if (result.issues) {
      console.log("   - issues:", result.issues);
    }
  }).catch((err) => {
    console.log("   ❌ Error during verification:", err.message);
    process.exit(1);
  });
  
} catch (err) {
  console.log("   ❌ Failed to load service:", err.message);
  console.log("   Stack:", err.stack);
  process.exit(1);
}
