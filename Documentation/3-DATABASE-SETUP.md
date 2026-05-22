# 💾 Database Setup & Configuration Guide

Complete guide to setting up and managing the PostgreSQL database for the Music Instrument Borrowing System.

---

## 📋 Table of Contents

1. [Database Overview](#database-overview)
2. [PostgreSQL Installation](#postgresql-installation)
3. [Create Database](#create-database)
4. [Schema & Tables](#schema--tables)
5. [Indexes & Performance](#indexes--performance)
6. [Sample Data](#sample-data)
7. [Database Operations](#database-operations)
8. [Backup & Restore](#backup--restore)
9. [Troubleshooting](#troubleshooting)

---

## 📊 Database Overview

### Database Name: `ucca`

```
ucca (Music Instrument Borrowing System)
├── 12 Core Tables
├── 20+ Performance Indexes
├── 4 Analytical Views
└── Foreign Key Relationships for data integrity
```

### Database Credentials (Default)

```env
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ucca
```

---

## 🔧 PostgreSQL Installation

### Windows

1. **Download PostgreSQL**
   - Visit: https://www.postgresql.org/download/windows/
   - Click latest version (e.g., 15.x)

2. **Run Installer**
   - Accept default options
   - Default port: 5432
   - Default superuser: postgres

3. **Verify Installation**
   ```bash
   # Open Command Prompt/PowerShell
   psql --version
   # Should show: psql (PostgreSQL) 15.x
   
   # Test connection
   psql -U postgres
   # Should connect to PostgreSQL
   \q  # exit
   ```

### macOS

```bash
# Using Homebrew (recommended)
brew install postgresql

# Start PostgreSQL service
brew services start postgresql

# Verify
psql --version
```

### Linux (Ubuntu/Debian)

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql

# Verify
psql --version
```

---

## 📁 Create Database

### Method 1: Using psql (Recommended)

```bash
# 1. Connect to PostgreSQL as superuser
psql -U postgres

# 2. Create the database
CREATE DATABASE ucca;

# 3. List databases to verify
\l

# Should see:
#  ucca  | postgres | ...

# 4. Connect to new database
\c ucca

# 5. Verify (should be empty)
\dt

# 6. Exit
\q
```

### Method 2: Using pgAdmin (GUI)

1. Open pgAdmin (usually at http://localhost:5050)
2. Right-click on "Databases"
3. Create → Database
4. Name: `ucca`
5. Click "Save"

### Verify Database Created

```bash
# Connect and check
psql -U postgres -d ucca -c "\dt"

# Should show: "Did not find any relations" (empty is OK)
```

---

## 🗂️ Schema & Tables

### Core Tables Structure

#### 1. Users Table

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    role VARCHAR(50) DEFAULT 'borrower',
    phone VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Store user accounts and authentication data

**Fields:**
- `id`: Unique user identifier
- `name`: Full name of user
- `email`: Email (unique, @carsu.edu.ph or @gmail.com)
- `password`: Bcrypt-hashed password
- `role`: 'borrower', 'staff', or 'admin'
- `phone`: Contact phone number
- `is_verified`: Email verified status
- `created_at`: Account creation time

#### 2. Instruments Table

```sql
CREATE TABLE instruments (
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
```

**Purpose:** Store instrument catalog and inventory

**Fields:**
- `id`: Unique instrument identifier
- `name`: Instrument name (e.g., "Classical Guitar")
- `description`: Details about instrument
- `quantity_total`: Total units owned
- `quantity_available`: Units available to borrow
- `category`: Type (String, Brass, Percussion, etc.)
- `condition`: Current condition status
- `qr_code`: QR code image (base64 or URL)
- `image_url`: Product image path

#### 3. Borrows Table

```sql
CREATE TABLE borrows (
    id SERIAL PRIMARY KEY,
    borrower_id INTEGER REFERENCES users(id) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    approver_id INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    expected_return_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Track borrow transactions/requests

**Fields:**
- `id`: Unique borrow request ID
- `borrower_id`: User who borrowed (FK to users)
- `status`: pending, approved, rejected, or returned
- `approver_id`: Staff who approved (FK to users)
- `expected_return_date`: When items should be returned
- `created_at`: Request submission time

#### 4. Borrow Items Table

```sql
CREATE TABLE borrow_items (
    id SERIAL PRIMARY KEY,
    borrow_id INTEGER REFERENCES borrows(id) ON DELETE CASCADE NOT NULL,
    instrument_id INTEGER REFERENCES instruments(id) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_numbers VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Items within each borrow request (junction table)

**Fields:**
- `id`: Item line ID
- `borrow_id`: Which borrow this belongs to (FK)
- `instrument_id`: Which instrument (FK)
- `quantity`: How many units borrowed
- `unit_numbers`: Specific unit numbers (e.g., "1,2,3")

#### 5. Returns Table

```sql
CREATE TABLE returns (
    id SERIAL PRIMARY KEY,
    borrow_id INTEGER REFERENCES borrows(id) NOT NULL,
    returned_by INTEGER REFERENCES users(id) NOT NULL,
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    condition VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Track when items are returned

#### 6. Borrow Photos Table

```sql
CREATE TABLE borrow_photos (
    id SERIAL PRIMARY KEY,
    borrow_id INTEGER REFERENCES borrows(id) ON DELETE CASCADE,
    photo_url VARCHAR(500) NOT NULL,
    photo_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Store photos for borrow/return documentation

#### 7. Staff Schedules Table

```sql
CREATE TABLE staff_schedules (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER REFERENCES users(id) NOT NULL,
    day_of_week VARCHAR(20),
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Track staff availability/working hours

#### 8. Notifications Table

```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message TEXT,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Store in-app notifications

#### 9. Email Verification Tokens Table

```sql
CREATE TABLE email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    is_used BOOLEAN DEFAULT FALSE
);
```

**Purpose:** Store email verification tokens for new registrations

#### 10. Audit Log Table

```sql
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(255),
    resource_type VARCHAR(100),
    resource_id INTEGER,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Track all important system actions for audit trail

#### 11. Performance Dancers Table

```sql
CREATE TABLE performance_dancers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    specialization VARCHAR(255),
    contact VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Store dancer performance data (if applicable)

#### 12. Performance Recommendations Table

```sql
CREATE TABLE performance_recommendations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    performer_id INTEGER REFERENCES performance_dancers(id),
    recommendation_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Track performance recommendations

---

## ⚡ Indexes & Performance

### Performance Indexes

Create these for faster queries:

```sql
-- User lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_verified ON users(is_verified);

-- Instrument lookups
CREATE INDEX idx_instruments_category ON instruments(category);
CREATE INDEX idx_instruments_quantity ON instruments(quantity_available);

-- Borrow tracking
CREATE INDEX idx_borrows_borrower_id ON borrows(borrower_id);
CREATE INDEX idx_borrows_status ON borrows(status);
CREATE INDEX idx_borrows_approver_id ON borrows(approver_id);

-- Borrow items
CREATE INDEX idx_borrow_items_borrow_id ON borrow_items(borrow_id);
CREATE INDEX idx_borrow_items_instrument_id ON borrow_items(instrument_id);

-- Returns
CREATE INDEX idx_returns_borrow_id ON returns(borrow_id);
CREATE INDEX idx_returns_returned_by ON returns(returned_by);

-- Photos
CREATE INDEX idx_borrow_photos_borrow_id ON borrow_photos(borrow_id);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Audit logs
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

### Create Indexes

```bash
# Save the SQL above to: server/indexes.sql
# Then run:
psql -U postgres -d ucca -f server/indexes.sql
```

---

## 🌱 Sample Data

### Insert Test Data

```sql
-- Insert test users
INSERT INTO users (name, email, password, role, phone, is_verified) VALUES
('Admin User', 'admin@carsu.edu.ph', 
 '$2b$10$YIjlrJwVeWc8x7.D8xE2BO6.0WkjP9XJ7k7K8L0M9N8.P0Q1R2S3T', 
 'admin', '09123456789', TRUE),
('Staff User', 'staff@carsu.edu.ph', 
 '$2b$10$YIjlrJwVeWc8x7.D8xE2BO6.0WkjP9XJ7k7K8L0M9N8.P0Q1R2S3T', 
 'staff', '09123456790', TRUE),
('Borrower User', 'borrower@carsu.edu.ph', 
 '$2b$10$YIjlrJwVeWc8x7.D8xE2BO6.0WkjP9XJ7k7K8L0M9N8.P0Q1R2S3T', 
 'borrower', '09123456791', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Insert test instruments
INSERT INTO instruments (name, description, quantity_total, quantity_available, category, condition) VALUES
('Classical Guitar', 'Full-size 6-string acoustic guitar', 5, 5, 'String', 'Good'),
('Violin', 'Full-size violin with bow', 3, 3, 'String', 'Good'),
('Trumpet', 'Brass trumpet', 4, 4, 'Brass', 'Good'),
('Drums', 'Complete drum set', 2, 2, 'Percussion', 'Good'),
('Flute', 'Metal concert flute', 6, 6, 'Woodwind', 'Good'),
('Piano Keyboard', 'Electronic keyboard', 2, 2, 'Keyboard', 'Good')
ON CONFLICT DO NOTHING;
```

**Password Note:** The hash above is for password "admin123456"

To generate your own hash:

```javascript
// In Node.js
const bcrypt = require('bcrypt');
const password = 'your_password_here';
const hashed = bcrypt.hashSync(password, 10);
console.log(hashed);
```

### Load Sample Data

```bash
# Save SQL to: server/sample-data.sql
# Then run:
psql -U postgres -d ucca -f server/sample-data.sql
```

---

## 🔍 Database Operations

### Query Examples

#### Get all borrowers

```sql
SELECT id, name, email, created_at 
FROM users 
WHERE role = 'borrower' 
ORDER BY created_at DESC;
```

#### Get available instruments

```sql
SELECT id, name, quantity_available, category
FROM instruments
WHERE quantity_available > 0
ORDER BY name;
```

#### Get pending borrow requests

```sql
SELECT 
  b.id,
  u.name as borrower,
  COUNT(bi.id) as item_count,
  b.created_at
FROM borrows b
JOIN users u ON b.borrower_id = u.id
LEFT JOIN borrow_items bi ON b.id = bi.borrow_id
WHERE b.status = 'pending'
GROUP BY b.id, u.name, b.created_at
ORDER BY b.created_at DESC;
```

#### Get borrow history for a user

```sql
SELECT 
  b.id,
  GROUP_CONCAT(i.name) as instruments,
  b.status,
  b.created_at,
  b.expected_return_date
FROM borrows b
JOIN borrow_items bi ON b.id = bi.borrow_id
JOIN instruments i ON bi.instrument_id = i.id
WHERE b.borrower_id = 5
GROUP BY b.id
ORDER BY b.created_at DESC;
```

### Common Maintenance Tasks

#### Check database size

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Count records in each table

```sql
SELECT tablename, 
       (SELECT count(*) FROM pg_class WHERE relname = tablename) as row_count
FROM pg_tables
WHERE schemaname = 'public';
```

#### Check unused indexes

```sql
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname NOT LIKE 'pg_toast%'
ORDER BY tablename, indexname;
```

---

## 💾 Backup & Restore

### Backup Database

```bash
# Full database backup
pg_dump -U postgres -d ucca -F c -b -v -f ucca_backup.dump

# Or as SQL file
pg_dump -U postgres -d ucca > ucca_backup.sql
```

### Restore Database

```bash
# From dump file
pg_restore -U postgres -d ucca -v ucca_backup.dump

# From SQL file
psql -U postgres -d ucca < ucca_backup.sql
```

### Automated Daily Backups (Linux)

Create `backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/ucca_backup_$DATE.sql"

pg_dump -U postgres -d ucca > $BACKUP_FILE

# Keep only last 7 days
find /backups -name "ucca_backup_*.sql" -mtime +7 -delete
```

Add to crontab:

```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup.sh
```

---

## ❌ Troubleshooting

### Issue: "Cannot connect to database"

**Solution:**
```bash
# Check if PostgreSQL is running
# Windows: Check Services
# macOS: brew services list
# Linux: systemctl status postgresql

# Test connection
psql -U postgres
# If this fails, PostgreSQL isn't running

# Start PostgreSQL
# Windows: Services → postgresql
# macOS: brew services start postgresql
# Linux: sudo systemctl start postgresql
```

### Issue: "Database does not exist"

**Solution:**
```bash
# Create the database
psql -U postgres -c "CREATE DATABASE ucca;"

# Verify
psql -U postgres -c "\l" | grep ucca
```

### Issue: "Permission denied"

**Solution:**
```bash
# Use correct credentials
psql -U postgres  # Use 'postgres' user
# Enter password when prompted

# Or specify in connection
psql -U postgres -h localhost -d ucca
```

### Issue: "Table already exists"

**Solution:**
```sql
-- Drop and recreate
DROP TABLE IF EXISTS users CASCADE;
-- Then create table again
```

---

## 📚 Next Steps

1. **Backend Setup** → [Backend Setup Guide](1-BACKEND-SETUP.md)
2. **Frontend Setup** → [Frontend Setup Guide](2-FRONTEND-SETUP.md)
3. **API Reference** → [API Reference](5-API-REFERENCE.md)

---

**Status:** ✅ Database Ready for Development
