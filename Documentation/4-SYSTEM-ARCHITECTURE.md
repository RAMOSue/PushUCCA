# 🏗️ System Architecture & Data Flow Guide

Complete guide to understanding how the Music Instrument Borrowing System works, including architecture, data flows, and component interactions.

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Layers](#system-layers)
3. [Data Models](#data-models)
4. [Authentication Flow](#authentication-flow)
5. [Borrowing Flow](#borrowing-flow)
6. [Return Flow](#return-flow)
7. [Component Interactions](#component-interactions)
8. [Database Relationships](#database-relationships)
9. [State Management](#state-management)
10. [File Upload Flow](#file-upload-flow)
11. [Notification System](#notification-system)

---

## 🏛️ Architecture Overview

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                PRESENTATION LAYER (Frontend)                 │
│  React Components, Pages, UI Logic @ localhost:5173          │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/JSON/REST API
                     ↓
┌─────────────────────────────────────────────────────────────┐
│               APPLICATION LAYER (Backend)                    │
│  Express Server, Controllers, Business Logic @ localhost:8000│
└────────────────────┬────────────────────────────────────────┘
                     │ SQL Queries
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              DATA LAYER (Database)                           │
│  PostgreSQL Database @ localhost:5432                        │
│  Tables: users, instruments, borrows, etc.                  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack by Layer

**Frontend Layer:**
```
React 19.1.0 (UI Framework)
  ├── React Router 7.6.3 (Page Navigation)
  ├── Axios (HTTP Client)
  ├── Context API (State Management)
  ├── Tailwind CSS 3.4.17 (Styling)
  ├── html5-qrcode (QR Scanning)
  ├── TensorFlow.js (ML)
  └── Recharts (Charts)
```

**Backend Layer:**
```
Express 5.1.0 (Web Framework)
  ├── Passport.js (Authentication)
  ├── JWT (Token Management)
  ├── Multer (File Uploads)
  ├── Nodemailer (Email)
  ├── Sharp (Image Processing)
  ├── node-cron (Scheduling)
  └── pg (Database Client)
```

**Data Layer:**
```
PostgreSQL 12+ (Relational Database)
  ├── 12 Core Tables
  ├── Foreign Key Relationships
  ├── 20+ Indexes for Performance
  └── 4 Analytical Views
```

---

## 🔄 System Layers

### Layer 1: Frontend (Client)

**Location:** `/client/src/`

**Responsibilities:**
- Display user interface
- Collect user input
- Send requests to backend API
- Manage local state (React Context)
- Handle client-side routing
- Validate inputs before sending

**Key Components:**
```
App.jsx
  ├── Routes (29 different pages)
  ├── Context Providers
  │   ├── UserContext (auth state)
  │   └── BorrowingContext (cart state)
  ├── Navbar & Layout
  └── Service Modules (api.js, auth.js, etc.)
```

### Layer 2: Backend (API Server)

**Location:** `/server/`

**Responsibilities:**
- Receive HTTP requests
- Validate data
- Execute business logic
- Query database
- Send JSON responses
- Handle authentication/authorization
- Process file uploads
- Send emails
- Manage scheduled tasks

**Request Flow in Backend:**
```
HTTP Request
  ↓
Express Middleware (cors, json parsing)
  ↓
Route Handler (e.g., POST /api/borrow/submit)
  ↓
Controller Function (e.g., submitBorrow)
  ↓
Service/Helper (if needed)
  ↓
Database Query
  ↓
Response JSON
  ↓
HTTP Response back to Client
```

### Layer 3: Database

**Location:** PostgreSQL at localhost:5432

**Responsibilities:**
- Persist all data
- Enforce data integrity
- Execute queries efficiently
- Maintain relationships
- Support transactions

**Database Structure:**
```
ucca (database)
  ├── users (authentication)
  ├── instruments (inventory)
  ├── borrows (transactions)
  ├── borrow_items (details)
  ├── returns (returns)
  ├── borrow_photos (documentation)
  ├── staff_schedules (availability)
  ├── notifications (alerts)
  ├── audit_log (tracking)
  └── ... (more tables)
```

---

## 💾 Data Models

### 1. Users Table

```sql
users {
  id: INTEGER PRIMARY KEY
  name: VARCHAR(255)
  email: VARCHAR(255) UNIQUE
  password: VARCHAR(255) -- bcrypt hashed
  role: VARCHAR(50) -- 'borrower', 'staff', 'admin'
  phone: VARCHAR(20)
  is_verified: BOOLEAN
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

**Example Row:**
```json
{
  "id": 1,
  "name": "John Student",
  "email": "john@carsu.edu.ph",
  "password": "$2b$10$xxxxx...", // hashed
  "role": "borrower",
  "phone": "09123456789",
  "is_verified": true,
  "created_at": "2026-03-01 10:00:00"
}
```

### 2. Instruments Table

```sql
instruments {
  id: INTEGER PRIMARY KEY
  name: VARCHAR(255)
  description: TEXT
  quantity_total: INTEGER
  quantity_available: INTEGER
  category: VARCHAR(100)
  condition: VARCHAR(50)
  qr_code: VARCHAR(500)
  image_url: VARCHAR(500)
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

**Example Row:**
```json
{
  "id": 1,
  "name": "Classical Guitar",
  "description": "6-string acoustic guitar",
  "quantity_total": 5,
  "quantity_available": 3,
  "category": "String",
  "condition": "Good",
  "qr_code": "data:image/png;base64,...",
  "image_url": "/uploads/guitar.jpg"
}
```

### 3. Borrows Table (Main Transaction)

```sql
borrows {
  id: INTEGER PRIMARY KEY
  borrower_id: INTEGER FOREIGN KEY -> users(id)
  created_at: TIMESTAMP
  status: VARCHAR(50) -- 'pending', 'approved', 'rejected', 'returned'
  approver_id: INTEGER FOREIGN KEY -> users(id)
  approved_at: TIMESTAMP
  expected_return_date: DATE
  updated_at: TIMESTAMP
}
```

**Example Row:**
```json
{
  "id": 10,
  "borrower_id": 5,
  "created_at": "2026-03-10 14:30:00",
  "status": "approved",
  "approver_id": 2,
  "approved_at": "2026-03-10 15:00:00",
  "expected_return_date": "2026-03-17"
}
```

### 4. Borrow Items Table (Many-to-Many)

```sql
borrow_items {
  id: INTEGER PRIMARY KEY
  borrow_id: INTEGER FOREIGN KEY -> borrows(id)
  instrument_id: INTEGER FOREIGN KEY -> instruments(id)
  quantity: INTEGER
  unit_numbers: VARCHAR(255) -- e.g., "1,2,3"
  status: VARCHAR(50)
  created_at: TIMESTAMP
}
```

**Example Row:**
```json
{
  "id": 20,
  "borrow_id": 10,
  "instrument_id": 1,
  "quantity": 2,
  "unit_numbers": "1,2",
  "status": "pending"
}
```

### 5. Returns Table

```sql
returns {
  id: INTEGER PRIMARY KEY
  borrow_id: INTEGER FOREIGN KEY -> borrows(id)
  returned_by: INTEGER FOREIGN KEY -> users(id)
  return_date: TIMESTAMP
  condition: VARCHAR(50)
  notes: TEXT
  created_at: TIMESTAMP
}
```

### 6. Photos Table

```sql
borrow_photos {
  id: INTEGER PRIMARY KEY
  borrow_id: INTEGER FOREIGN KEY -> borrows(id)
  photo_url: VARCHAR(500)
  photo_type: VARCHAR(50) -- 'borrow', 'return'
  created_at: TIMESTAMP
}
```

---

## 🔐 Authentication Flow

### Registration Flow

```
User (Frontend)
  │
  ├─→ Fill registration form
  │   - Name
  │   - Email (must be @carsu.edu.ph or @gmail.com)
  │   - Password
  │   - Phone
  │
  └─→ Click "Register"
       │
       ↓
       ┌──────────────────────────────────────────┐
       │ Frontend (client/src/pages/Register.jsx) │
       │ 1. Validate inputs                       │
       │ 2. Send POST /api/auth/register          │
       └──────────────────────────────────────────┘
            │
            │ HTTP POST (JSON)
            │ {
            │   "name": "John",
            │   "email": "john@carsu.edu.ph",
            │   "password": "pass123",
            │   "phone": "09123456789"
            │ }
            ↓
       ┌──────────────────────────────────────────┐
       │ Backend (authController.registerUser)    │
       │ 1. Validate email format                 │
       │ 2. Check if email already exists         │
       │ 3. Hash password with bcrypt             │
       │ 4. Create user in database (NOT verified)│
       │ 5. Create verification token            │
       │ 6. Send verification email              │
       │ 7. Return success response              │
       └──────────────────────────────────────────┘
            │
            │ Response JSON
            │ {
            │   "message": "Check your email...",
            │   "userId": 5,
            │   "expiresIn": "15 minutes"
            │ }
            ↓
       User receives email with verification code
```

### Login Flow

```
User (Frontend)
  │
  ├─→ Go to Login page
  │
  ├─→ Enter credentials
  │   - Email
  │   - Password
  │
  └─→ Click "Login"
       │
       ↓
       ┌──────────────────────────────────────────┐
       │ Frontend (client/src/pages/Login.jsx)   │
       │ 1. Validate inputs                       │
       │ 2. Send POST /api/auth/login             │
       └──────────────────────────────────────────┘
            │
            │ HTTP POST (JSON)
            │ {
            │   "email": "john@carsu.edu.ph",
            │   "password": "pass123"
            │ }
            ↓
       ┌──────────────────────────────────────────┐
       │ Backend (authController.loginUser)       │
       │ 1. Find user by email                    │
       │ 2. Compare password with bcrypt          │
       │ 3. Check if user is verified             │
       │ 4. Generate JWT token                    │
       │ 5. Return user data + token              │
       └──────────────────────────────────────────┘
            │
            │ Response JSON
            │ {
            │   "user": {
            │     "id": 5,
            │     "name": "John",
            │     "email": "john@carsu.edu.ph",
            │     "role": "borrower"
            │   },
            │   "token": "eyJhbGc..."
            │ }
            ↓
       Frontend stores token in Context/localStorage
            │
            ├─→ Set user in UserContext
            ├─→ Add token to axios headers
            └─→ Redirect to Dashboard
                │
                ├─→ All API calls now include JWT
                │   Authorization: Bearer eyJhbGc...
                │
                └─→ User authenticated ✅
```

### JWT Token Usage

**Every API request includes:**

```
Headers: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Backend validates:**

```javascript
// In authController.js
const token = req.headers.authorization?.split(' ')[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// decoded.userId = 5
// Now we know who the user is
```

---

## 📦 Borrowing Flow

### Step 1: Browse Instruments

```
User clicks "Browse Instruments"
  │
  ↓
Frontend: GET http://localhost:8000/api/inventory/get-items
  │
  ├─→ Validates JWT token
  ├─→ Queries instruments table
  └─→ Returns all instruments
       │
       ├─ id, name, quantity_available
       ├─ description, category, image
       └─ qr_code
         │
         ↓
   Display as cards/list
```

### Step 2: Add to Cart

```
User clicks "Add to Cart" on a guitar
  │
  ├─→ Instrument: Guitar (ID: 1)
  ├─→ Quantity: 1
  └─→ Unit: 1 (specific guitar unit)
       │
       ↓
    Frontend (borrowingContext.jsx)
       │
       ├─→ Add to cartItems array
       │   {
       │     "instrument_id": 1,
       │     "name": "Guitar",
       │     "quantity": 1,
       │     "unit_numbers": "1"
       │   }
       │
       ├─→ Update cart state
       ├─→ Save to localStorage
       └─→ Show toast: "Added to cart"
```

### Step 3: Take Photos

```
User goes to BorrowCart page
  │
  ├─→ Reviews items
  ├─→ Takes photos for each item
  │   └─→ Uses device camera
  │   └─→ Or uploads existing photos
  │
  └─→ Photos stored in state
```

### Step 4: Submit Borrow Request

```
User clicks "Submit Borrow Request"
  │
  ├─→ Collects:
  │   - All items in cart
  │   - All photos
  │   - Expected return date
  │
  ↓
POST http://localhost:8000/api/borrow/submit-borrow
{
  "items": [
    {
      "instrument_id": 1,
      "quantity": 2,
      "unit_numbers": "1,2"
    }
  ],
  "expected_return_date": "2026-03-17",
  "photos": ["base64_image_1", "base64_image_2"]
}
  │
  ↓
Backend (borrowController.submitBorrow)
  │
  ├─→ 1. Validate all items available
  │   └─→ Check quantities in instruments table
  │
  ├─→ 2. Create borrow record
  │   INSERT INTO borrows
  │   └─→ status = 'pending'
  │
  ├─→ 3. Create borrow_items
  │   INSERT INTO borrow_items (for each item)
  │
  ├─→ 4. Save photos
  │   - Convert base64 to image files
  │   - Save to /public/uploads/
  │   - Create borrow_photos records
  │
  ├─→ 5. Update quantities
  │   UPDATE instruments SET quantity_available = qty - borrowed
  │
  ├─→ 6. Send email to staff
  │   nodemailer.sendMail()
  │
  └─→ 7. Return success response
       │
       {
         "message": "Borrow request submitted",
         "borrow_id": 10,
         "status": "pending"
       }
       │
       ↓
   Frontend clears cart
   └─→ Redirect to MyBorrowedItems
```

---

## 🔄 Return Flow

### Staff Processing Return

```
User returns items to staff counter
  │
  ├─→ Staff scans QR or enters borrow ID
  ├─→ Staff checks physical items
  ├─→ Staff takes return photos
  └─→ Staff approves return
       │
       ↓
   Frontend: POST /api/borrow/process-return
   {
     "borrow_id": 10,
     "photos": ["base64_image"],
     "condition": "Good",
     "notes": "No damage"
   }
       │
       ↓
   Backend (borrowController.processReturn)
       │
       ├─→ 1. Validate borrow exists and is approved
       │
       ├─→ 2. Create return record
       │   INSERT INTO returns
       │
       ├─→ 3. Save return photos
       │   └─→ Store photos with photo_type = 'return'
       │
       ├─→ 4. Update quantities
       │   UPDATE instruments SET quantity_available = qty + returned
       │
       ├─→ 5. Update borrow status
       │   UPDATE borrows SET status = 'returned'
       │
       ├─→ 6. Send confirmation email
       │
       └─→ 7. Return success
            │
            ↓
   Frontend shows success toast
   User sees item in "Returned" status
```

---

## 🔌 Component Interactions

### React Component Hierarchy

```
App.jsx (Main Component)
  │
  ├─→ UserContextProvider
  │   └─→ Manages: user, isLoggedIn, isDarkMode
  │   └─→ Functions: login, logout, updateProfile
  │
  ├─→ BorrowingProvider
  │   └─→ Manages: cartItems, cartTotals
  │   └─→ Functions: addToCart, removeFromCart
  │
  ├─→ Navbar (Always visible)
  │
  └─→ Routes
      ├─→ / → Login
      ├─→ /register → Register
      ├─→ /dashboard → Dashboard
      ├─→ /browse-items → AvailableItems
      ├─→ /borrow-cart → BorrowCart
      ├─→ /my-borrowed → MyBorrowedItems
      ├─→ /borrow-history → BorrowerHistory
      ├─→ /return-items → ReturnItems
      ├─→ /scan-qr → ScanQR
      ├─→ /scanner → MusicInstrumentScanner
      ├─→ /staff/dashboard → DashboardStaff
      ├─→ /staff/borrow-cart → StaffBorrowCart
      ├─→ /staff/schedule → StaffSchedule
      ├─→ /admin/dashboard → DashboardAdmin
      ├─→ /admin/users → AdminUserManagement
      ├─→ /admin/inventory → ManageInventory
      ├─→ /admin/reports → AdminReports
      └─→ ... (12 more routes)
```

### Page Component Example: BorrowCart

```javascript
function BorrowCart() {
  // Get global state
  const { cartItems, removeFromCart } = useContext(BorrowingContext);
  const { user } = useContext(UserContext);
  
  // Local state for photos
  const [photos, setPhotos] = useState([]);
  
  // API calls
  const handleSubmit = async () => {
    const response = await API.post('/api/borrow/submit-borrow', {
      items: cartItems,
      photos: photos,
      expected_return_date: selectedDate
    });
  };
  
  return (
    <div>
      {/* Display cart items */}
      {cartItems.map(item => (
        <CartItemCard key={item.id} item={item} />
      ))}
      
      {/* Photo capture */}
      <BorrowPhotoCaptureModal />
      
      {/* Submit button */}
      <button onClick={handleSubmit}>Submit Borrow Request</button>
    </div>
  );
}
```

---

## 📊 Database Relationships

### Entity-Relationship Diagram (Text)

```
users (1) ──→ (many) borrows
  │
  ├─→ id PRIMARY KEY
  ├─→ name, email, role
  └─→ password (bcrypted)
       │
       ├──→ (1) borrows
       │   ├─→ id PRIMARY KEY
       │   ├─→ borrower_id FOREIGN KEY
       │   ├─→ status (pending/approved/returned)
       │   └─→ (many) borrow_items
       │       ├─→ id PRIMARY KEY
       │       ├─→ borrow_id FOREIGN KEY
       │       └─→ (1) instruments
       │           ├─→ id PRIMARY KEY
       │           ├─→ name, quantity_available
       │           └─→ (many) borrow_items
       │
       ├──→ (1) returns
       │   ├─→ id PRIMARY KEY
       │   └─→ borrow_id FOREIGN KEY
       │
       └──→ (many) notifications
           ├─→ id PRIMARY KEY
           └─→ user_id FOREIGN KEY
```

### Key Relationships

**One-to-Many:**
- 1 User → Many Borrows (one user borrows multiple times)
- 1 User → Many Staff Schedules (one staff has multiple shifts)
- 1 Borrow → Many Borrow Items (one borrow contains multiple instruments)
- 1 Borrow → Many Photos (one borrow has multiple photos)

**Many-to-Many (via junction table):**
- Users ↔ Instruments (through borrow_items)
- One user borrows many instruments
- One instrument can be borrowed by many users

---

## 🧠 State Management

### React Context Architecture

**UserContext (Authentication State)**

```javascript
// Global state
{
  user: {
    id: 5,
    name: "John Student",
    email: "john@carsu.edu.ph",
    role: "borrower"
  },
  isLoggedIn: true,
  isDarkMode: false,
  isLoading: false,
  error: null
}

// Available functions
{
  login(email, password): Promise
  logout(): void
  updateProfile(data): Promise
  setDarkMode(boolean): void
}
```

**BorrowingContext (Cart State)**

```javascript
// Global state
{
  cartItems: [
    {
      id: 1,
      instrument_id: 1,
      name: "Guitar",
      quantity: 1,
      unit_numbers: "1",
      image: "..."
    },
    // ... more items
  ],
  cartTotals: {
    totalItems: 2,
    totalQuantity: 3
  }
}

// Available functions
{
  addToCart(instrument, quantity, unitNumbers): void
  removeFromCart(itemId): void
  clearCart(): void
  updateQuantity(itemId, newQuantity): void
}
```

### State Flow Example

```
User clicks "Add to Guitar"
  │
  ├─→ BorrowCart component
  │   └─→ borrowingContext.addToCart(1, 1, "1")
  │
  ├─→ BorrowingContext state updates
  │   cartItems: [..., newGuitar]
  │
  ├─→ Component re-renders
  │   └─→ Shows new cart item
  │
  ├─→ localStorage updated
  │   └─→ Persists cart across page refresh
  │
  └─→ Toast notification shown
```

---

## 📤 File Upload Flow

### Photo Upload Process

```
User clicks "Take Photo"
  │
  ├─→ BorrowPhotoCaptureModal opens
  │   └─→ Requests camera permission
  │
  ├─→ User takes photo
  │   └─→ Image captured by html5-qrcode
  │
  └─→ Convert to Base64
       │
       ├─→ base64String = canvas.toDataURL('image/jpeg')
       │
       ├─→ Store in React state
       │   photoBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJ..."
       │
       └─→ Compress image
           └─→ Sharp will compress on backend
```

### Backend Processing

```
POST /api/borrow/submit-borrow
{
  items: [...],
  photos: ["data:image/jpeg;base64,..."],
  expected_return_date: "2026-03-17"
}
  │
  ├─→ Backend receives base64 strings
  │
  ├─→ For each photo:
  │   ├─→ Decode base64
  │   ├─→ Compress with Sharp
  │   ├─→ Save to disk
  │   │   /public/uploads/borrow_XXX_YYY.jpg
  │   │
  │   └─→ Store path in database
  │       borrow_photos.photo_url = "/uploads/borrow_XXX.jpg"
  │
  └─→ Return success response
       {
         "message": "Borrow request submitted",
         "borrow_id": 10,
         "photos_saved": 3
       }
```

---

## 🔔 Notification System

### Push Notifications Flow

```
User registers on the system
  │
  ├─→ App.jsx detects user is logged in
  │
  ├─→ Calls notificationService.init()
  │   └─→ Requests notification permission
  │
  ├─→ Browser shows permission dialog
  │   └─→ User clicks "Allow"
  │
  └─→ Subscribe to notifications
      │
      POST /api/notifications/subscribe
      {
        "subscription": {
          "endpoint": "https://...",
          "keys": {...}
        }
      }
       │
       ├─→ Save subscription in database
       │   notifications_subscriptions table
       │
       └─→ Ready for push notifications
```

### Sending Notifications

```
Event occurs (e.g., borrow approved)
  │
  ├─→ Backend detects event
  │   borrowController.approveBorrow()
  │
  ├─→ Create notification in database
  │   INSERT INTO notifications
  │
  ├─→ Send push notification
  │   notificationService.sendPushNotification(
  │     userId,
  │     "Borrow Approved",
  │     "Your borrow request #10 has been approved"
  │   )
  │
  ├─→ Browser shows notification
  │   ┌─────────────────────────────────┐
  │   │ 🔔 Borrow Approved             │
  │   │ Your borrow request #10 was... │
  │   └─────────────────────────────────┘
  │
  └─→ Email also sent (email notifications)
      nodemailer sends to user email
```

---

## 🔍 API Request/Response Flow

### Complete Example: Submit Borrow

```javascript
// FRONTEND: client/src/pages/BorrowCart.jsx
const handleSubmit = async () => {
  try {
    // 1. Prepare data
    const requestData = {
      items: [
        {
          instrument_id: 1,
          quantity: 2,
          unit_numbers: "1,2"
        }
      ],
      expected_return_date: "2026-03-17",
      photos: cartPhotos.map(p => p.base64)
    };
    
    // 2. Make API call
    const response = await axios.post(
      '/api/borrow/submit-borrow',
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // 3. Handle response
    console.log("Success:", response.data);
    // → { message: "Borrow request submitted", borrow_id: 10 }
    
  } catch (error) {
    console.error("Error:", error.response.data);
    // → { error: "Item not available" }
  }
};

// BACKEND: server/routes/borrowRoutes.js
router.post('/submit-borrow', authenticateToken, borrowController.submitBorrow);

// BACKEND: server/controllers/borrowController.js
const submitBorrow = async (req, res) => {
  try {
    const { items, expected_return_date, photos } = req.body;
    const userId = req.user.id;
    
    // 1. Validate token (done by authenticateToken middleware)
    // req.user is populated: { id: 5, email: "..." }
    
    // 2. Validate items available
    for (let item of items) {
      const result = await pool.query(
        'SELECT quantity_available FROM instruments WHERE id = $1',
        [item.instrument_id]
      );
      
      if (result.rows[0].quantity_available < item.quantity) {
        return res.status(400).json({ error: "Item not available" });
      }
    }
    
    // 3. Create borrow record
    const borrowResult = await pool.query(
      `INSERT INTO borrows (borrower_id, status, expected_return_date)
       VALUES ($1, 'pending', $2)
       RETURNING *`,
      [userId, expected_return_date]
    );
    const borrow_id = borrowResult.rows[0].id;
    
    // 4. Create borrow items
    for (let item of items) {
      await pool.query(
        `INSERT INTO borrow_items (borrow_id, instrument_id, quantity, unit_numbers)
         VALUES ($1, $2, $3, $4)`,
        [borrow_id, item.instrument_id, item.quantity, item.unit_numbers]
      );
    }
    
    // 5. Save photos
    for (let i = 0; i < photos.length; i++) {
      const photoPath = `/uploads/borrow_${borrow_id}_${i}.jpg`;
      // Save base64 to file
      fs.writeFileSync(photoPath, Buffer.from(photos[i], 'base64'));
      
      // Save to database
      await pool.query(
        `INSERT INTO borrow_photos (borrow_id, photo_url, photo_type)
         VALUES ($1, $2, 'borrow')`,
        [borrow_id, photoPath]
      );
    }
    
    // 6. Update quantities
    for (let item of items) {
      await pool.query(
        `UPDATE instruments
         SET quantity_available = quantity_available - $1
         WHERE id = $2`,
        [item.quantity, item.instrument_id]
      );
    }
    
    // 7. Send notification email
    await emailService.sendBorrowConfirmation(userId, borrow_id);
    
    // 8. Return response
    res.json({
      message: "Borrow request submitted",
      borrow_id: borrow_id,
      status: "pending"
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
```

---

## 📚 Summary

### Key Takeaways

1. **Three-Layer Architecture**
   - Frontend (React) → Backend (Express) → Database (PostgreSQL)
   - Clean separation of concerns

2. **Request/Response Pattern**
   - Frontend sends JSON via HTTP
   - Backend processes and queries database
   - Returns JSON responses

3. **Authentication**
   - Passwords hashed with bcrypt
   - JWT tokens for session management
   - Every API request validated

4. **Data Flow**
   - User actions → Frontend state update → API call
   - API processes → Database transaction → Response
   - Frontend updates UI based on response

5. **File Handling**
   - Photos converted to base64
   - Backend saves to disk
   - Path stored in database

6. **Notifications**
   - Stored in database
   - Sent via push notifications
   - Also sent via email

---

**Next:** Learn about specific APIs in [API Reference](5-API-REFERENCE.md)
