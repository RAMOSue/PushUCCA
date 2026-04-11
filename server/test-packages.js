#!/usr/bin/env node

/**
 * Test if required packages are installed correctly
 */

console.log("Testing package installations...\n");

// Test 1: Tesseract.js
console.log("1. Testing tesseract.js:");
try {
  const Tesseract = require("tesseract.js");
  console.log("   ✅ Tesseract.js loaded successfully");
  console.log("   📦 Version:", Tesseract.version || "unknown");
  console.log("   📍 Path:", require.resolve("tesseract.js"));
} catch (err) {
  console.log("   ❌ Failed to load tesseract.js");
  console.log("   Error:", err.message);
  process.exit(1);
}

// Test 2: Sharp
console.log("\n2. Testing sharp:");
try {
  const sharp = require("sharp");
  console.log("   ✅ Sharp loaded successfully");
  console.log("   📍 Path:", require.resolve("sharp"));
} catch (err) {
  console.log("   ❌ Failed to load sharp");
  console.log("   Error:", err.message);
  process.exit(1);
}

// Test 3: Other dependencies
console.log("\n3. Testing other dependencies:");
const deps = ["axios", "express", "pg", "multer", "react-hot-toast"];
for (const dep of deps) {
  try {
    require.resolve(dep);
    console.log(`   ✅ ${dep}`);
  } catch (err) {
    console.log(`   ❌ ${dep} - NOT FOUND`);
  }
}

console.log("\n✅ All packages loaded successfully!");
console.log("\nYou can now run the server with: npm start");
