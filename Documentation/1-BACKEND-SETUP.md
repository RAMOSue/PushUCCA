# 🔧 Backend Setup Guide - Step by Step

Complete step-by-step guide to set up the Express.js backend server for the Music Instrument Borrowing System.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Step 1: Extract Project Files](#step-1-extract-project-files)
4. [Step 2: Install Backend Dependencies](#step-2-install-backend-dependencies)
5. [Step 3: Configure PostgreSQL Database](#step-3-configure-postgresql-database)
6. [Step 4: Set Up Environment Variables](#step-4-set-up-environment-variables)
7. [Step 5: Run Database Migrations](#step-5-run-database-migrations)
8. [Step 6: Start the Backend Server](#step-6-start-the-backend-server)
9. [Step 7: Verify Backend is Running](#step-7-verify-backend-is-running)
10. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

Before starting, ensure you have:

- **Node.js v16+** - Download from https://nodejs.org/
  ```bash
  # Check if installed
  node --version
  npm --version
  ```

- **PostgreSQL v12+** - Download from https://www.postgresql.org/
  ```bash
  # Check if installed
  psql --version
  ```

- **Git** (optional) - For cloning the repository
  ```bash
  # Check if installed
  git --version
  ```

- **A text editor** - VS Code, Sublime Text, etc.

---

## 📁 Project Structure

The server directory structure:

```
server/
├── controllers/          # Business logic for each route
│   ├── authController.js
│   ├── borrowController.js
│   ├── inventoryController.js
│   ├── profileController.js
│   ├── reportController.js
│   ├── imageRecognitionController.js
│   ├── performanceController.js
│   └── notificationController.js
│
├── routes/              # API endpoint definitions
│   ├── authRoutes.js
│   ├── borrowRoutes.js
│   ├── inventoryRoutes.js
│   ├── profileRoutes.js
│   ├── reportRoutes.js
│   ├── imageRecognitionRoutes.js
│   ├── performanceRoutes.js
│   └── notificationRoutes.js
│
├── services/            # Helper services
│   ├── emailService.js
│   ├── verificationService.js
│   └── notificationService.js
│
├── middleware/          # Express middleware
│   ├── auth.js
│   └── errorHandler.js
│
├── cron/                # Scheduled tasks
│   └── notificationScheduler.js
│
├── migrations/          # Database migrations
│   ├── add_email_verification.sql
│   ├── add_unit_number.sql
│   └── ...
│
├── public/              # Static files served by Express
│   ├── uploads/
│   └── qr_codes/
│
├── index.js            # Server entry point ⭐ START HERE
├── db.js               # PostgreSQL connection
├── passport.js         # Authentication configuration
├── .env                # Environment variables
├── package.json        # Dependencies
└── package-lock.json
```

---

## Step 1: Extract Project Files

### Option A: If you have a ZIP file

```bash
# Navigate to your desired location
cd C:\Users\YourUsername\Desktop
# or
cd /home/username/projects

# Extract the ZIP file
unzip LOGINAUTH.zip
cd LOGINAUTH
```

### Option B: If cloning from Git

```bash
# Clone the repository
git clone <repository-url>
cd LOGINAUTH
```

### Option C: Manual copy

Simply copy the `LOGINAUTH` folder to your desired location.

---

## Step 2: Install Backend Dependencies

### Navigate to Server Directory

```bash
# From LOGINAUTH root directory
cd server
```

### Install Dependencies

```bash
# Install all required packages
npm install
```

**This will install:**
- `express` - Web framework
- `pg` - PostgreSQL client
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT tokens
- `passport` - Authentication
- `multer` - File uploads
- `nodemailer` - Email sending
- `sharp` - Image processing
- `tesseract.js` - OCR
- `node-cron` - Scheduled tasks
- And many more...

### Expected Output

You should see:
```
added XXX packages in X.XXs
```

### Verify Installation

```bash
# List installed packages
npm list

# Or start a quick test
npm list express pg bcrypt
```

---

## Step 3: Configure PostgreSQL Database

### Step 3.1: Start PostgreSQL Service

**Windows:**
```bash
# PostgreSQL should start automatically
# Or in Services: Press Win+R, type 'services.msc'
# Find 'postgresql-x64-XX' and ensure it's running
```

**macOS:**
```bash
brew services start postgresql
```

**Linux:**
```bash
sudo systemctl start postgresql
```

### Step 3.2: Create Database

Open PostgreSQL terminal:

**Windows (using pgAdmin or Command Prompt):**
```bash
# Open Command Prompt or PowerShell
# Navigate to PostgreSQL bin directory
cd "C:\Program Files\PostgreSQL\15\bin"

# Or just run psql if it's in your PATH
psql -U postgres
```

**macOS/Linux:**
```bash
psql -U postgres
```

### Step 3.3: Create the Database

In the PostgreSQL terminal, execute:

```sql
-- Create the database
CREATE DATABASE ucca;

-- Verify it was created
\l

-- Connect to the new database
\c ucca

-- Exit psql
\q
```

### Step 3.4: Verify Database Creation

```bash
# Back in regular terminal
psql -U postgres -d ucca -c "\dt"
# Should show: "Did not find any relations" (empty database is OK)
```

---

## Step 4: Set Up Environment Variables

Environment variables configure your application without changing code.

### Step 4.1: Locate .env File

```bash
# In server directory, check if .env exists
cd server
ls -la | grep .env
# or on Windows:
dir | findstr .env
```

### Step 4.2: Create/Edit .env File

The `.env` file should already exist. If not, create it:

```bash
# Create the file
# Windows (PowerShell)
New-Item -Path ".env" -ItemType File

# macOS/Linux
touch .env
```

### Step 4.3: Configure Environment Variables

Open `server/.env` in your text editor and set these values:

```env
# ==========================================
# BACKEND SERVER CONFIGURATION
# ==========================================
PORT=8000
CLIENT_URL=http://localhost:5173

# ==========================================
# DATABASE CONFIGURATION
# ==========================================
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ucca

# ==========================================
# AUTHENTICATION
# ==========================================
JWT_SECRET=your-super-secret-key-change-this-in-production
SESSION_SECRET=your-session-secret-key

# ==========================================
# GOOGLE OAUTH (Optional - for Google login)
# ==========================================
GOOGLE_CLIENT_ID=your_google_client_id_from_console
GOOGLE_CLIENT_SECRET=your_google_client_secret_from_console
GOOGLE_CALLBACK_URL=http://localhost:8000/api/auth/google/callback

# ==========================================
# EMAIL CONFIGURATION
# ==========================================
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
# Note: For Gmail, use an App Password, not your regular password
# See: https://support.google.com/accounts/answer/185833

# ==========================================
# AI IMAGE RECOGNITION SERVICE
# ==========================================
AI_SERVICE_URL=http://127.0.0.1:8000

# ==========================================
# WEB PUSH NOTIFICATIONS
# ==========================================
VAPID_PUBLIC_KEY=BJC7m2pOnIK_hJLUYM29QwhO6AVyHZgqJITDqZR_438KCamUZ-vh2IC5-0iVPT1VRtRIQIvFlXXNfzJoV5BoCH8
VAPID_PRIVATE_KEY=vb4OpuxRSPy2HdfC_hffcTVA2tSQxpirOb4wjZ1nFyw
VAPID_SUBJECT=mailto:your-email@gmail.com
```

### Step 4.4: Key Configuration Explanations

| Variable | Meaning | Default | Notes |
|----------|---------|---------|-------|
| PORT | Backend server port | 8000 | Don't change unless port is in use |
| CLIENT_URL | Frontend URL | localhost:5173 | Frontend will run on this |
| DB_USER | PostgreSQL username | postgres | Default PostgreSQL user |
| DB_PASSWORD | PostgreSQL password | postgres | Your PostgreSQL password |
| DB_HOST | Database location | localhost | localhost for local development |
| DB_PORT | PostgreSQL port | 5432 | Default PostgreSQL port |
| DB_NAME | Database name | ucca | Must match created database |
| JWT_SECRET | Token signing key | (required) | CHANGE in production! |
| EMAIL_USER | Sender email address | (required) | Gmail or other provider |
| EMAIL_PASS | Email app password | (required) | NOT your regular email password |

### ⚠️ Important Notes

1. **Never commit .env to Git** - It contains sensitive information
2. **Change JWT_SECRET in production** - Don't use test values
3. **Use Gmail App Password** - Not your regular email password
4. **Keep credentials secure** - Don't share .env file

---

## Step 5: Run Database Migrations

Migrations create tables and set up the database schema.

### Step 5.1: Create Initial Schema

You need to create the initial database schema. Find the main migration file:

```bash
# Check available migration files
cd server/migrations
ls -la
```

### Step 5.2: Load the Schema

We'll use a SQL script to create all tables. First, let's create the initial schema if not present:

```bash
# Go back to server directory
cd ..

# Create a file with initial schema
# Copy and paste the SQL below into a file named: init-schema.sql
```

Create a file `server/init-schema.sql` with this content:

```sql
-- ==========================================
-- MUSIC INSTRUMENT BORROWING SYSTEM
-- Initial Database Schema
-- ==========================================

-- ========== USERS TABLE ==========
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'borrower', -- borrower, staff, admin
    phone VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== EMAIL VERIFICATION TOKENS ==========
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    is_used BOOLEAN DEFAULT FALSE
);

-- ========== INSTRUMENTS TABLE ==========
CREATE TABLE IF NOT EXISTS instruments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity_total INTEGER DEFAULT 1,
    quantity_available INTEGER DEFAULT 1,
    category VARCHAR(100),
    condition VARCHAR(50) DEFAULT 'Good',
    qr_code VARCHAR(500),
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== BORROWS TABLE ==========
CREATE TABLE IF NOT EXISTS borrows (
    id SERIAL PRIMARY KEY,
    borrower_id INTEGER REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, returned
    approver_id INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    expected_return_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== BORROW ITEMS (Many-to-Many) ==========
CREATE TABLE IF NOT EXISTS borrow_items (
    id SERIAL PRIMARY KEY,
    borrow_id INTEGER REFERENCES borrows(id) ON DELETE CASCADE NOT NULL,
    instrument_id INTEGER REFERENCES instruments(id) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_numbers VARCHAR(255), -- e.g., "1,2,3" for multiple units
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== RETURNS TABLE ==========
CREATE TABLE IF NOT EXISTS returns (
    id SERIAL PRIMARY KEY,
    borrow_id INTEGER REFERENCES borrows(id) NOT NULL,
    returned_by INTEGER REFERENCES users(id) NOT NULL,
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    condition VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== BORROW PHOTOS ==========
CREATE TABLE IF NOT EXISTS borrow_photos (
    id SERIAL PRIMARY KEY,
    borrow_id INTEGER REFERENCES borrows(id) ON DELETE CASCADE,
    photo_url VARCHAR(500) NOT NULL,
    photo_type VARCHAR(50), -- 'borrow', 'return'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== STAFF SCHEDULE ==========
CREATE TABLE IF NOT EXISTS staff_schedules (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES users(id) NOT NULL,
    day_of_week VARCHAR(20),
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== NOTIFICATIONS ==========
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(50), -- 'info', 'warning', 'error', 'success'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== AUDIT LOG ==========
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(255),
    resource_type VARCHAR(100),
    resource_id INTEGER,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== CREATE INDEXES FOR PERFORMANCE ==========
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_verified ON users(is_verified);
CREATE INDEX idx_instruments_category ON instruments(category);
CREATE INDEX idx_instruments_quantity ON instruments(quantity_available);
CREATE INDEX idx_borrows_borrower_id ON borrows(borrower_id);
CREATE INDEX idx_borrows_status ON borrows(status);
CREATE INDEX idx_borrow_items_borrow_id ON borrow_items(borrow_id);
CREATE INDEX idx_borrow_items_instrument_id ON borrow_items(instrument_id);
CREATE INDEX idx_returns_borrow_id ON returns(borrow_id);
CREATE INDEX idx_borrow_photos_borrow_id ON borrow_photos(borrow_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);

-- ========== INSERT SAMPLE DATA ==========
INSERT INTO users (name, email, password, role, phone, is_verified) VALUES
('Admin User', 'admin@carsu.edu.ph', '$2b$10$YIjlrJwVeWc8x7.D8xE2BO6.0WkjP9XJ7k7K8L0M9N8.P0Q1R2S3T', 'admin', '09123456789', TRUE),
('Staff User', 'staff@carsu.edu.ph', '$2b$10$YIjlrJwVeWc8x7.D8xE2BO6.0WkjP9XJ7k7K8L0M9N8.P0Q1R2S3T', 'staff', '09123456790', TRUE),
('Borrower User', 'borrower@carsu.edu.ph', '$2b$10$YIjlrJwVeWc8x7.D8xE2BO6.0WkjP9XJ7k7K8L0M9N8.P0Q1R2S3T', 'borrower', '09123456791', TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO instruments (name, description, quantity_total, quantity_available, category, condition) VALUES
('Guitar', 'Classical acoustic guitar', 5, 5, 'String', 'Good'),
('Violin', 'Full-size violin', 3, 3, 'String', 'Good'),
('Trumpet', 'Brass trumpet', 4, 4, 'Brass', 'Good'),
('Drums', 'Complete drum set', 2, 2, 'Percussion', 'Good'),
('Flute', 'Metal flute', 6, 6, 'Woodwind', 'Good')
ON CONFLICT DO NOTHING;

-- Done!
-- This creates all necessary tables and sample data
```

### Step 5.3: Execute the Schema

```bash
# From server directory
# Option 1: Using psql
psql -U postgres -d ucca -f init-schema.sql

# Option 2: Using pgAdmin GUI
# 1. Open pgAdmin (http://localhost:5050)
# 2. Right-click on ucca database → Query Tool
# 3. Paste SQL content
# 4. Execute (F5)
```

### Step 5.4: Run Additional Migrations

```bash
# Apply other migrations
psql -U postgres -d ucca -f migrations/add_email_verification.sql
psql -U postgres -d ucca -f migrations/add_unit_number.sql
# ... and others as needed
```

### Step 5.5: Verify Schema

```bash
# Connect to database
psql -U postgres -d ucca

# List all tables
\dt

# You should see:
# - users
# - instruments
# - borrows
# - borrow_items
# - returns
# - borrow_photos
# - staff_schedules
# - notifications
# - audit_log
# - email_verification_tokens

# Exit
\q
```

---

## Step 6: Start the Backend Server

### Step 6.1: Ensure You're in Server Directory

```bash
# From LOGINAUTH root directory
cd server

# Verify you're in the right place
pwd  # macOS/Linux
cd   # Windows
# Should show: .../LOGINAUTH/server
```

### Step 6.2: Start the Server

```bash
# Start the development server with hot reload
npm start

# This runs: nodemon index.js
# nodemon watches for changes and restarts automatically
```

### Step 6.3: Expected Output

You should see:

```
> server@1.0.0 start
> nodemon index.js

[nodemon] X.XX.X
[nodemon] to restart at any time, type `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,json
[nodemon] starting `node index.js`
✅ Database connected successfully
🚀 Server running on port 8000
🔔 Notification scheduler started
✅ Server is ready for requests
```

### ✅ Success Indicators

- ✅ "Database connected successfully"
- ✅ "Server running on port 8000"
- ✅ No error messages
- ✅ No red text in console

---

## Step 7: Verify Backend is Running

### Test 1: Health Check via Terminal

```bash
# In a new terminal (keep server running in original)
curl http://localhost:8000/

# Or using Node/PowerShell
# Windows:
Invoke-WebRequest -Uri "http://localhost:8000/" -UseBasicParsing

# Should see:
# Cannot GET /
# (This is OK - just means server is responding)
```

### Test 2: Health Check Endpoint

```bash
# Test API endpoint
curl http://localhost:8000/api/auth/test

# Should return:
# {"message":"test is working"}
```

### Test 3: Database Connection

The server logs should show: `✅ Database connected successfully`

### Test 4: Browser Test

Open in your browser:
```
http://localhost:8000/
```

If server is running, you'll get a 404 (which is OK - no route defined for /)

---

## 🎯 Next Steps

✅ **Backend is now running!**

Now you need to:

1. **Set up the Frontend** → Follow [Frontend Setup Guide](2-FRONTEND-SETUP.md)
2. **Understand the API** → Check [API Reference](5-API-REFERENCE.md)
3. **Learn the architecture** → Read [System Architecture](4-SYSTEM-ARCHITECTURE.md)

### Quick Command Reference

```bash
# In server directory:

# Start backend
npm start

# Stop server
# Press: Ctrl + C

# Reinstall dependencies
npm install

# Clear npm cache
npm cache clean --force

# Check Node version
node --version

# Check npm version
npm --version
```

---

## ❌ Troubleshooting

### Issue: "Port 8000 already in use"

**Solution:**
```bash
# Windows: Find and kill process using port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# macOS/Linux: Find and kill process
lsof -i :8000
kill -9 <PID>

# Or change the port in .env
PORT=8001
```

### Issue: "Cannot connect to database"

**Checklist:**
- [ ] PostgreSQL is running (check Services on Windows)
- [ ] Database `ucca` exists: `psql -U postgres -l | grep ucca`
- [ ] Credentials in .env match your PostgreSQL setup
- [ ] PostgreSQL is on localhost:5432 (default)

**Solution:**
```bash
# Verify PostgreSQL is running and accessible
psql -U postgres -d ucca

# If that fails, check PostgreSQL installation
psql --version
```

### Issue: "Cannot find module 'express'"

**Solution:**
```bash
# Reinstall all dependencies
rm -rf node_modules
npm install
```

### Issue: Email not sending

**Checklist:**
- [ ] EMAIL_USER is set in .env
- [ ] EMAIL_PASS is an App Password (for Gmail)
- [ ] Gmail account has 2FA enabled
- [ ] Email service is properly configured

**For Gmail:**
1. Go to: https://myaccount.google.com/apppasswords
2. Create a new App Password
3. Copy it to EMAIL_PASS in .env

---

## 📚 Related Guides

- [Frontend Setup Guide](2-FRONTEND-SETUP.md)
- [Database Setup Guide](3-DATABASE-SETUP.md)
- [System Architecture](4-SYSTEM-ARCHITECTURE.md)
- [Troubleshooting Guide](../TROUBLESHOOTING.md)

---

**Status:** ✅ Ready for Development

Once backend is running, proceed to [Frontend Setup](2-FRONTEND-SETUP.md)!
