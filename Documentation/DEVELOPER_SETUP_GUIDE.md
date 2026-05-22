# Developer Setup Guide - Local Development Environment

## Complete Setup Instructions for New Developers

This guide provides step-by-step instructions to set up a complete local development environment for the Borrowing System project.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Prerequisites Installation](#2-prerequisites-installation)
3. [Repository Setup](#3-repository-setup)
4. [Database Setup](#4-database-setup)
5. [Environment Configuration](#5-environment-configuration)
6. [Backend Setup](#6-backend-setup)
7. [Frontend Setup](#7-frontend-setup)
8. [Running the Application](#8-running-the-application)
9. [IDE Configuration](#9-ide-configuration)
10. [Common Development Tasks](#10-common-development-tasks)
11. [Debugging Guide](#11-debugging-guide)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. System Requirements

### Minimum Specifications
- **CPU**: 4 cores (Intel i5 / AMD Ryzen 5 or equivalent)
- **RAM**: 8GB minimum (16GB recommended for comfortable development)
- **Disk Space**: 10GB available
- **Network**: 5MB+ internet connection (for downloading dependencies)

### Supported Operating Systems
- macOS 10.15+ (Intel or Apple Silicon)
- Windows 10/11 (with WSL2 recommended for better performance)
- Ubuntu 18.04 LTS or later
- Other Linux distributions (Debian-based preferred)

### Required Software Versions
- **Node.js**: v18.0.0 or later (v18.14+ recommended)
- **npm**: v9.0.0 or later
- **PostgreSQL**: v12.0 or later (v14+ recommended)
- **Git**: v2.30.0 or later
- **Visual Studio Code**: v1.60.0+ (optional but recommended)

---

## 2. Prerequisites Installation

### 2.1 Install Node.js (v18 LTS)

#### macOS
```bash
# Using Homebrew (recommended)
brew install node@18

# Verify installation
node --version    # Should be v18.x.x
npm --version     # Should be v9.x.x
```

#### Windows
1. Download installer from https://nodejs.org/en/ (LTS version)
2. Run installer and follow prompts
3. Verify installation:
```bash
node --version
npm --version
```

#### Linux (Ubuntu/Debian)
```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 2.2 Install PostgreSQL

#### macOS
```bash
# Using Homebrew
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Verify installation
psql --version
```

#### Windows
1. Download installer from https://www.postgresql.org/download/windows/
2. Run installer (remember password for postgres user)
3. Verify installation:
```bash
psql --version
```

#### Linux (Ubuntu/Debian)
```bash
# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
psql --version
```

### 2.3 Install Git

#### macOS
```bash
brew install git
```

#### Windows
Download from https://git-scm.com/download/win and run installer

#### Linux
```bash
sudo apt install -y git
```

### 2.4 Install Visual Studio Code (Optional)

Download from https://code.visualstudio.com/ and install

**Recommended Extensions**:
- ESLint
- Prettier
- PostgreSQL
- Thunder Client (API testing)
- REST Client

---

## 3. Repository Setup

### 3.1 Clone Repository

```bash
# Choose working directory
cd ~/projects  # or your preferred location

# Clone repository
git clone https://github.com/your-username/borrowing-system.git
cd borrowing-system

# Verify structure
ls -la
# Should see: client/, server/, Documentation/, README.md
```

### 3.2 Create Development Branches

```bash
# Create your feature branch from main
git checkout -b feature/your-feature-name

# Example branch naming:
# feature/division-filter
# bugfix/cart-ui-issue
# chore/code-cleanup
```

---

## 4. Database Setup

### 4.1 Create Database User

#### Linux/macOS (using psql)
```bash
# Access PostgreSQL
psql -U postgres

# Create development database
CREATE DATABASE borrowing_system_dev;

# Create development user
CREATE USER dev_user WITH PASSWORD 'dev_password_123';

# Grant privileges
ALTER ROLE dev_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE borrowing_system_dev TO dev_user;

# Exit psql
\q
```

#### Windows (using pgAdmin)
1. Open pgAdmin from Windows Start Menu
2. Expand Servers > PostgreSQL > Databases
3. Right-click Databases > Create > Database
4. Name: `borrowing_system_dev`
5. Create login/group role:
   - Right-click Login/Group Roles > Create > Login/Group Role
   - Name: `dev_user`
   - Password: `dev_password_123`
   - Grant Privileges: Superuser, Can Create Databases

### 4.2 Initialize Database Schema

```bash
# Navigate to server directory
cd server

# Create .env file (see section 5)

# Run database migrations (if using migrations)
npm run migrate  # or: npm run db:setup

# Expected output: "Migration completed successfully"
```

### 4.3 Load Sample Data (Optional)

```bash
# Seed database with sample data for testing
npm run db:seed

# Verify data
psql -U dev_user -d borrowing_system_dev

# Check tables
postgres=> \dt

# Check sample users
postgres=> SELECT * FROM users LIMIT 5;
```

---

## 5. Environment Configuration

### 5.1 Backend Environment Variables

Create `server/.env`:

```bash
cd server
nano .env  # or vim .env for Windows Notepad use code .env
```

```env
# ============ SERVER CONFIGURATION ============
NODE_ENV=development
PORT=5000
DEBUG=true

# ============ DATABASE ============
DB_HOST=localhost
DB_PORT=5432
DB_NAME=borrowing_system_dev
DB_USER=dev_user
DB_PASSWORD=dev_password_123
DB_LOGGING=false  # Set to true for SQL query logging

# ============ JWT AUTHENTICATION ============
JWT_SECRET=dev_secret_key_change_in_production_mustbe32chars!@
JWT_EXPIRY=24h

# ============ EMAIL SERVICE (Nodemailer) ============
# For development, use a test email provider or log to console
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=465
SMTP_USER=your_mailtrap_username
SMTP_PASSWORD=your_mailtrap_password
SMTP_FROM_EMAIL=dev@localhost
SMTP_FROM_NAME="Borrowing System Dev"

# ============ FILE UPLOADS ============
UPLOAD_DIR=./public/uploads
MAX_FILE_SIZE=10485760  # 10MB

# ============ FRONTEND URL ============
FRONTEND_URL=http://localhost:5173  # Vite default port
BACKEND_URL=http://localhost:5000

# ============ CORS CONFIGURATION ============
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
CORS_CREDENTIALS=true

# ============ SECURITY ============
BCRYPT_ROUNDS=10  # Faster in development (production: 12)
INACTIVITY_TIMEOUT=1800

# ============ LOGGING ============
LOG_LEVEL=debug
LOG_FILE=./logs/app.log

# ============ OPTIONAL: DEVELOPMENT TOOLS ============
MOCK_EMAIL=true  # Log emails instead of sending
MOCK_PUSH_NOTIFICATIONS=true  # Log notifications instead of sending
```

### 5.2 Frontend Environment Variables

Create `client/.env.local`:

```bash
cd ../client
nano .env.local  # or code .env.local
```

```env
# ============ API CONFIGURATION ============
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Borrowing System
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=development

# ============ FEATURE FLAGS ============
VITE_ENABLE_IMAGE_RECOGNITION=true
VITE_ENABLE_QR_SCANNER=true
VITE_DEBUG_MODE=true

# ============ BUILD SETTINGS ============
VITE_SOURCEMAP=true  # Enable source maps for debugging
```

---

## 6. Backend Setup

### 6.1 Install Dependencies

```bash
cd server

# Clean install
rm -rf node_modules package-lock.json
npm install

# Expected output:
# added 250+ packages, audited 250 packages in 30s
```

### 6.2 Verify Installation

```bash
# List installed packages
npm list

# Check Node.js environment
npm run env

# Expected output should include:
# NODE_ENV=development
# DB_NAME=borrowing_system_dev
```

### 6.3 Test Database Connection

```bash
# Create test script
cat > test-db.js << 'EOF'
const pg = require("pg");

const client = new pg.Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

client.connect((err) => {
  if (err) {
    console.error("Connection failed:", err.message);
    process.exit(1);
  }
  console.log("✓ Database connected successfully");
  
  client.query("SELECT * FROM users LIMIT 1", (err, result) => {
    if (err) console.error("Query error:", err);
    else console.log("✓ Sample query successful, found", result.rows.length, "user(s)");
    client.end();
  });
});
EOF

# Run test
node test-db.js

# Expected output:
# ✓ Database connected successfully
# ✓ Sample query successful
```

---

## 7. Frontend Setup

### 7.1 Install Dependencies

```bash
cd ../client

# Clean install
rm -rf node_modules package-lock.json
npm install

# Expected output:
# added 200+ packages, audited 200 packages in 25s
```

### 7.2 Verify Vite Configuration

```bash
# Check build configuration
cat vite.config.js | head -20

# Should show:
# - Vite version references
# - React plugin configuration
# - Host and port settings
```

---

## 8. Running the Application

### 8.1 Start Backend Server

**Terminal 1 - Backend**:
```bash
cd server
npm run dev

# Expected output:
# > nodemon index.js
# [nodemon] 3.0.0
# [nodemon] to restart at any time, type `rs`
# [nodemon] watching path(s): ...
# Server running on port 5000
# ✓ Database connected
```

### 8.2 Start Frontend Development Server

**Terminal 2 - Frontend**:
```bash
cd client
npm run dev

# Expected output:
# > vite
# ✓ built in 2.50s
# 
# ➜ Local: http://localhost:5173/
# ➜ press h to show help
```

### 8.3 Access Application

Open browser to **http://localhost:5173**

**Test Login Credentials** (if seeded):
```
Email: borrower@example.com
Password: Password123!

Email: staff@example.com
Password: Password123!

Email: admin@example.com
Password: Password123!
```

### 8.4 Verify Full Stack

```bash
# In another terminal, test API
curl -X GET http://localhost:5000/api/auth/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-15T10:30:45.123Z"}
```

---

## 9. IDE Configuration

### 9.1 Visual Studio Code Setup

Install recommended extensions:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-node-debug2",
    "ckolkman.vscode-postgres",
    "rangav.vscode-thunder-client",
    "wayou.vscode-todo-highlight"
  ]
}
```

### 9.2 ESLint & Prettier Configuration

Both directories should have configuration files:

```bash
# Check ESLint config
cat server/.eslintrc.json
cat client/.eslintrc.json

# Check Prettier config
cat server/.prettierrc
cat client/.prettierrc
```

### 9.3 Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend Debug",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server/index.js",
      "restart": true,
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "name": "Frontend Debug",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/client"
    }
  ]
}
```

---

## 10. Common Development Tasks

### 10.1 Create New API Endpoint

```bash
# 1. Create controller
code server/controllers/newController.js

# 2. Create route
code server/routes/newRoutes.js

# 3. Add route to app
# In server/index.js, add:
# app.use("/api/new", require("./routes/newRoutes"));

# 4. Test with Thunder Client or curl
curl -X PUT http://localhost:5000/api/new

# 5. Commit changes
git add -A
git commit -m "feat: Add new feature endpoint"
```

### 10.2 Create New React Component

```bash
# 1. Create component directory
mkdir client/src/components/MyComponent

# 2. Create component file
code client/src/components/MyComponent/MyComponent.jsx

# 3. Create styles
code client/src/components/MyComponent/MyComponent.css

# 4. Create index (for easy imports)
echo "export { default } from './MyComponent';" > client/src/components/MyComponent/index.js

# 5. Use in pages
# import MyComponent from '@/components/MyComponent';
```

### 10.3 Database Migration (if using migration system)

```bash
# Create new migration
npm run db:create-migration my_feature_name

# Edit migration file
code server/migrations/001_my_feature_name.sql

# Run migrations
npm run db:migrate

# Rollback if needed
npm run db:rollback
```

### 10.4 Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/auth.test.js

# Run with coverage
npm run test:coverage

# Watch mode (auto-rerun on file changes)
npm test -- --watch
```

### 10.5 Lint & Format Code

```bash
# Run ESLint
npm run lint

# Fix ESLint issues automatically
npm run lint:fix

# Format with Prettier
npm run format

# Check code style
npm run format:check
```

---

## 11. Debugging Guide

### 11.1 Backend Debugging

#### Using Node Inspector

```bash
# Start with debugging
node --inspect server/index.js

# Expected output:
# Debugger listening on ws://127.0.0.1:9229/...
```

Open **chrome://inspect** in Chrome browser and debug

#### Using VS Code Debugger

1. Press F5 to start debugging
2. Select "Backend Debug" configuration
3. Set breakpoints by clicking on line numbers
4. Trigger code execution to hit breakpoints
5. Step through code using controls

#### Console Logging

```javascript
// In any controller
console.log("Debug info:", someVariable);
console.error("Error occurred:", error);
console.table(arrayOfObjects);  // Pretty print arrays
```

### 11.2 Frontend Debugging

#### Using React DevTools

1. Install Chrome extension: [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/)
2. Open Chrome DevTools (F12)
3. Go to "Components" tab
4. Inspect React components and state

#### Using Network Tab

1. Open Chrome DevTools (F12)
2. Go to "Network" tab
3. Load page or trigger API call
4. Inspect requests/responses
5. Check status codes and response times

#### Using Console

```javascript
// In browser console (F12)
// Check API calls
fetch('http://localhost:5000/api/users')
  .then(r => r.json())
  .then(d => console.table(d));

// Check localStorage
localStorage.getItem('token');

// Check context state
console.log(useContext(BorrowingContext));
```

### 11.3 Database Debugging

```bash
# Access database directly
psql -U dev_user -d borrowing_system_dev

# Useful queries
SELECT * FROM users LIMIT 5;
SELECT * FROM borrowing_requests WHERE status='pending';
EXPLAIN ANALYZE SELECT * FROM borrowing_items WHERE status='borrowed';

# Check logs (if enabled)
tail -f logs/app.log
```

---

## 12. Troubleshooting

### "Module not found" Error

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Clear npm cache if still failing
npm cache clean --force
npm install
```

### Port Already in Use

```bash
# Find process using port 5000 (macOS/Linux)
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=5001  # Use different port
```

### Database Connection Failed

```bash
# Verify PostgreSQL is running
# macOS
brew services list

# Linux
sudo systemctl status postgresql

# Check credentials in .env
cat .env | grep DB_

# Test connection manually
psql -h localhost -U dev_user -d borrowing_system_dev
```

### Node Module Dependency Issues

```bash
# Clear all caches and reinstall
npm ci  # Clean install (uses package-lock.json)

# Update dependencies (if needed)
npm update

# Check for conflicts
npm audit fix
```

### Frontend Won't Load/Vite Error

```bash
# Clear Vite cache
rm -rf client/node_modules/.vite

# Restart dev server
npm run dev

# Check for port conflicts (default: 5173)
lsof -i :5173  # Linux/macOS
```

### Service Worker Issues

```bash
# Clear service worker cache
# In browser DevTools:
# Application > Service Workers > Unregister
# Application > Cache Storage > Clear all

# Or unregister programmatically
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(r => r.unregister());
});
```

---

## Performance Optimization During Development

### Faster Builds

```bash
# Frontend: Use SWC transpiler (faster than Babel)
# Already configured in Vite

# Backend: Use nodemon with polling
export NODEMON_POLL=100  # Faster file detection
```

### Memory Usage

```bash
# Increase Node.js heap if needed
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

---

## Next Steps

1. ✅ Complete this setup guide
2. 📖 Read [COMPREHENSIVE_SYSTEM_GUIDE.md](./COMPREHENSIVE_SYSTEM_GUIDE.md) for architecture overview
3. 📋 Read [COMPLETE_USER_FLOWS.md](./COMPLETE_USER_FLOWS.md) for feature understanding
4. 🔌 Read [API_REFERENCE_COMPLETE.md](./API_REFERENCE_COMPLETE.md) for API details
5. 🎥 Read [SCANNER_IMPLEMENTATION_GUIDE.md](./SCANNER_IMPLEMENTATION_GUIDE.md) for scanner features
6. 🚀 Start contributing!

---

**Last Updated**: January 2024
**Version**: 1.0
**Tested On**: Node.js 18.14, npm 9.3, PostgreSQL 14, Vite 4.0
