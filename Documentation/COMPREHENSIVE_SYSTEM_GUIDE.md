# COMPREHENSIVE SYSTEM GUIDE
## UCCA Inventory & Borrowing Management System

**Last Updated**: April 12, 2026  
**System Version**: 1.0.0  
**Capstone Project**: University Cultural Center Association (UCCA)

---

## 📋 TABLE OF CONTENTS

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Core Components](#core-components)
5. [Database Schema](#database-schema)
6. [User Roles & Permissions](#user-roles--permissions)
7. [Complete User Workflows](#complete-user-workflows)
8. [Feature Documentation](#feature-documentation)
9. [Installation & Setup](#installation--setup)
10. [Deployment Guide](#deployment-guide)
11. [API Reference](#api-reference)
12. [Troubleshooting](#troubleshooting)

---

## PROJECT OVERVIEW

### Purpose
The UCCA Inventory & Borrowing Management System is a comprehensive digital solution for managing the University Cultural Center Association's collection of indigenous musical instruments, traditional costumes, and accessories. It streamlines the borrowing process, tracks inventory, manages performances, and provides administrative oversight.

### Key Objectives
- ✅ Digitize inventory management
- ✅ Streamline borrowing workflows
- ✅ Provide multi-role access control
- ✅ Enable performance-based recommendations
- ✅ Support administrative reporting
- ✅ Integrate AI-powered item recognition
- ✅ Enable push notifications

### Target Users
- **Borrowers**: Students and faculty borrowing items
- **Staff**: Administrative staff approving requests and managing inventory
- **Admins**: System administrators configuring master lists and generating reports

### System Statistics
- **Core Tables**: 25+ database tables
- **Pages**: 40+ React pages
- **Components**: 30+ reusable React components
- **API Endpoints**: 100+ REST endpoints
- **User Roles**: 3 (borrower, staff, admin)
- **Supported Categories**: Costumes, Instruments, Accessories

---

## TECHNOLOGY STACK

### Backend
```
Framework:      Node.js + Express.js
Runtime:        Node.js 18+
Database:       PostgreSQL 12+
Auth:           JWT + Passport.js
File Storage:   Local filesystem
Notifications:  Web Push API (VAPID)
Jobs:           Node Cron
```

**Backend Dependencies**:
```javascript
{
  "express": "^5.1.0",
  "pg": "^8.16.3",
  "jsonwebtoken": "^9.0.2",
  "passport": "^0.7.0",
  "bcrypt": "^6.0.0",
  "multer": "^2.0.2",
  "sharp": "^0.34.5",
  "qrcode": "^1.5.4",
  "web-push": "^3.6.7",
  "node-cron": "^4.1.1",
  "nodemailer": "^7.0.5",
  "pdfkit": "^0.17.1",
  "cors": "^2.8.5",
  "cookie-parser": "^1.4.7"
}
```

### Frontend
```
Framework:      React 19+
Routing:        React Router v7.6.3
Build Tool:     Vite 7.0+
Styling:        Tailwind CSS 3.4+
Icons:          Lucide Icons
State:          React Context API
HTTP:           Axios
Notifications:  Web Push + Service Worker
```

**Frontend Dependencies**:
```javascript
{
  "react": "^19.1.0",
  "react-router-dom": "^7.6.3",
  "vite": "^7.0.0",
  "tailwindcss": "^3.4.17",
  "axios": "^1.10.0",
  "lucide-react": "^0.525.0",
  "react-hot-toast": "^2.5.2",
  "react-calendar": "^6.0.0",
  "html5-qrcode": "^2.3.8",
  "@tensorflow/tfjs": "^4.22.0",
  "dayjs": "^1.11.13",
  "framer-motion": "latest"
}
```

### Development Tools
```
Code Editor:    VS Code
Linting:        ESLint
Version Control: Git
Database Admin: pgAdmin / DBeaver
API Testing:    Postman / Thunder Client
```

---

## SYSTEM ARCHITECTURE

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                           │
│  Pages | Components | Services | Context | Hooks | Utils            │
│                      (Vite + Tailwind CSS)                          │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ HTTP/REST (Axios)
                  │
┌─────────────────▼───────────────────────────────────────────────────┐
│                      API GATEWAY (Express.js)                       │
│  Routes | Controllers | Middleware | Auth                          │
└─────────────────┬───────────────────────────────────────────────────┘
                  │ SQL/pg
                  │
┌─────────────────▼───────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                            │
│  Tables | Views | Indexes | Constraints                            │
└─────────────────────────────────────────────────────────────────────┘

Additional Services:
├─ File Storage (Local filesystem in /public/uploads)
├─ Email (Nodemailer + SMTP)
├─ Push Notifications (Web Push API + Service Worker)
├─ Job Scheduler (Node Cron)
└─ Image Processing (Sharp + JIMP)
```

### Request/Response Flow

```
1. User Action in Browser
   ↓
2. React Component triggers Axios call
   ↓
3. Frontend sends HTTP request to Express API
   ↓
4. Express Middleware processes request
   - JWT token validation
   - Role-based access control
   - Input validation
   ↓
5. Controller executes business logic
   ↓
6. Model queries PostgreSQL database
   ↓
7. Database returns data
   ↓
8. Controller formats response
   ↓
9. API returns JSON with status code
   ↓
10. Frontend receives response
    ↓
11. React updates UI state
    ↓
12. Component re-renders with new data
```

### File Structure

```
Project Root (LOGINAUTH)
├── client/                          (Frontend - React)
│   ├── src/
│   │   ├── App.jsx                 (Main app router)
│   │   ├── main.jsx                (Entry point)
│   │   ├── index.css               (Global styles)
│   │   ├── pages/                  (40+ pages by feature)
│   │   │   ├── Auth/               (Login, Register, Verify)
│   │   │   ├── Dashboard/
│   │   │   ├── Borrower/           (BorrowCart, MyItems, History, etc.)
│   │   │   ├── Staff/              (StaffCart, Schedule, MasterList)
│   │   │   ├── Admin/              (AdminReports, UserMgmt)
│   │   │   ├── Inventory/          (AvailableItems, Manage, Scanners)
│   │   │   ├── Settings/
│   │   │   └── Notifications/
│   │   ├── components/             (Reusable UI components)
│   │   │   ├── layout/
│   │   │   ├── navigation/
│   │   │   ├── modals/             (Action dialogs)
│   │   │   ├── ui/                 (shadcn/Radix components)
│   │   │   └── setup/
│   │   ├── context/                (React Context providers)
│   │   │   ├── userContext.jsx
│   │   │   ├── borrowingContext.jsx
│   │   │   ├── SidebarContext.jsx
│   │   │   └── LoginModalContext.jsx
│   │   ├── hooks/                  (Custom React hooks)
│   │   │   ├── useInactivityTimeout.jsx
│   │   │   └── useInactivityTimeout.js
│   │   ├── services/               (HTTP & business logic)
│   │   │   ├── borrowerService.js
│   │   │   ├── inventoryService.js
│   │   │   ├── notifications.js
│   │   │   └── reportService.js
│   │   ├── utils/                  (Utility functions)
│   │   │   ├── tokenManager.js     (Multi-user testing)
│   │   │   ├── reportGenerator.js
│   │   │   └── (more utilities)
│   │   └── assets/
│   ├── public/                     (Static files)
│   │   ├── manifest.json           (PWA manifest)
│   │   ├── service-worker.js       (Push notifications)
│   │   └── notification-setup.html
│   ├── context/                    (Alternative location)
│   ├── index.html                  (HTML template)
│   ├── vite.config.js              (Vite configuration)
│   ├── tailwind.config.js          (Tailwind configuration)
│   ├── package.json
│   └── README.md
│
├── server/                          (Backend - Express.js)
│   ├── index.js                    (Main server entry)
│   ├── db.js                       (PostgreSQL connection)
│   ├── passport.js                 (OAuth configuration)
│   ├── routes/                     (API routes)
│   │   ├── authRoutes.js           (Login, register)
│   │   ├── borrowRoutes.js         (Cart, requests, returns)
│   │   ├── inventoryRoutes.js      (Items, units, QR codes)
│   │   ├── performanceRoutes.js    (Events, scheduling)
│   │   ├── masterListRoutes.js     (Config management)
│   │   ├── profileRoutes.js        (User profiles)
│   │   ├── settingsRoutes.js       (User preferences)
│   │   ├── reportRoutes.js         (Reports, exports)
│   │   ├── notificationRoutes.js   (Push subscriptions)
│   │   ├── imageRecognitionRoutes.js (AI scanner)
│   │   └── (more routes)
│   ├── controllers/                (Business logic)
│   │   ├── authController.js
│   │   ├── borrowController.js
│   │   ├── inventoryController.js
│   │   ├── performanceController.js
│   │   ├── masterListController.js
│   │   ├── profileController.js
│   │   ├── reportController.js
│   │   ├── notificationController.js
│   │   └── (more controllers)
│   ├── models/                     (Database queries)
│   │   ├── user.js
│   │   ├── masterListModel.js      (Units, Positions, Terms)
│   │   ├── settingsModel.js
│   │   ├── slideshowImageModel.js
│   │   └── (more models)
│   ├── middleware/                 (Express middleware)
│   │   ├── requireRole.js          (Authorization)
│   │   └── auth.js                 (Authentication)
│   ├── migrations/                 (Database schema)
│   │   ├── add_division_to_users.sql
│   │   ├── add_unit_number.sql
│   │   ├── add_performance_dancers.sql
│   │   └── (20+ migration files)
│   ├── services/                   (Helper services)
│   │   ├── qrCodeDetectionService.js
│   │   ├── verificationService.js
│   │   ├── schoolIDDetectionService.js
│   │   └── (more services)
│   ├── helpers/                    (Utility functions)
│   │   └── auth.js
│   ├── cron/                       (Scheduled jobs)
│   │   ├── notificationScheduler.js
│   │   └── resendPendingNotifications.js
│   ├── ml/                         (Python ML models)
│   │   ├── model.py
│   │   ├── train.py
│   │   └── dataset/
│   ├── public/                     (Static files, uploads)
│   │   ├── uploads/
│   │   │   ├── borrow-photos/
│   │   │   ├── return-photos/
│   │   │   ├── profiles/
│   │   │   └── slideshow/
│   │   ├── qr_codes/
│   │   └── (other static files)
│   ├── package.json
│   ├── .env (secrets)
│   └── README.md
│
├── Documentation/                   (Project docs - THIS FOLDER)
│   ├── README.md                   (Project intro)
│   ├── 1-BACKEND-SETUP.md         (Backend installation)
│   ├── 2-FRONTEND-SETUP.md        (Frontend installation)
│   ├── 3-DATABASE-SETUP.md        (Database setup)
│   ├── 4-SYSTEM-ARCHITECTURE.md   (Architecture overview)
│   ├── 5-API-REFERENCE.md         (API endpoints)
│   ├── 6-FEATURES-GUIDE.md        (Feature documentation)
│   ├── COMPREHENSIVE_SYSTEM_GUIDE.md  (THIS FILE)
│   └── (30+ more documentation files)
│
└── .gitignore, .env.example, README.md (Root files)
```

---

## CORE COMPONENTS

### Frontend Core Architecture

#### React Context Providers
```javascript
// userContext.jsx - Global user state
const UserContext = {
  user: { id, email, name, role, division_id },
  darkMode: boolean,
  loading: boolean,
  setDarkMode: function,
  logout: function
}

// borrowingContext.jsx - Shopping cart state
const BorrowingContext = {
  cart: [ { unitId, name, size, category, ... } ],
  setCart: function,
  addToCart: function,
  requestId: string,
  setRequestId: function
}

// SidebarContext.jsx - Navigation state
const SidebarContext = {
  isOpen: boolean,
  setIsOpen: function,
  isMobile: boolean
}

// LoginModalContext.jsx - Modal visibility
const LoginModalContext = {
  isOpen: boolean,
  setIsOpen: function
}
```

#### Key Pages Overview

**Authentication Flow**
- Login.jsx → DashboardRouter → Role-based dashboard
- Register.jsx → Email verification → VerifyEmail.jsx → Login

**Borrower Workflow**
- AvailableItems.jsx (Browse) → BorrowCart.jsx (Add to cart) → Submit → MyBorrowedItems.jsx (Track)

**Staff Workflow**
- StaffSchedule.jsx (Create performance) → StaffBorrowCart.jsx (Borrow on behalf) → MasterList.jsx (Config)

**Admin Workflow**
- AdminUserManagement.jsx (Users) → AdminReports.jsx (Reports) → MasterList.jsx (Config)

### Backend Core Architecture

#### Express Server Structure
```javascript
// index.js - Entry point
const app = express();
app.use(middleware);
app.use('/api/auth', authRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/inventory', inventoryRoutes);
// ... more routes
app.listen(PORT);
```

#### Middleware Stack
1. **CORS** - Cross-origin requests
2. **Cookie Parser** - Session cookies
3. **Body Parser** - JSON payloads
4. **Static Files** - /public directory
5. **Authentication** - JWT verification
6. **Authorization** - Role-based access
7. **Error Handling** - Global error catcher

#### Database Connection
```javascript
// db.js - PostgreSQL pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
```

---

## DATABASE SCHEMA

### Core Tables (27 total)

#### Authentication & Users
- **users** - Borrower, staff, admin accounts
- **email_verification_tokens** - Email verification codes
- **user_profiles** - Additional user info (photos, IDs, birth certs)
- **user_settings** - User preferences (theme, notifications, etc.)
- **push_subscriptions** - Device push notification tokens

#### Borrowing System
- **borrowing_requests** - Item requests (reserved → approved → returned)
- **borrowing_items** - Line items per request with quantity tracking
- **inventory_items** - Item master data (costumes, instruments)
- **inventory_units** - Individual unit tracking per item

#### Organizational
- **divisions** - Organizational units (Dulimbay, Budjong, Kayam)
- **positions** - Job roles in organization
- **organizational_structures** - Links divisions ↔ positions
- **terms** - Academic periods
- **rules** - Organization rules/policies
- **event_types** - Performance categories

#### Performance Management
- **performances** - Events (date, location, borrowers, items)
- **performance_items** - Items allocated to performance
- **performance_borrowers** - Borrowers participating in performance
- **performance_recommendations** - Suggested items per borrower

#### Administrative
- **inventory_categories** - Inventory types (costume, instrument)
- **slideshow_images** - GetStarted page carousel
- **monthly_reports** - Generated monthly statistics
- **master_list_audit** - Change tracking for master lists

### Full Schema Relationships

```
users (1) ──→ (many) borrowing_requests
users (1) ──→ (many) performances
users (1) ──→ (1) user_profiles
users (1) ──→ (1) user_settings
users (1) ──→ (many) push_subscriptions
users (1) ──→ (1) divisions

borrowing_requests (1) ──→ (many) borrowing_items
borrowing_items (many) ──→ (1) inventory_units

inventory_items (1) ──→ (many) inventory_units
inventory_items (many) ──→ (many) performances

performances (1) ──→ (many) performance_items
performances (1) ──→ (many) performance_borrowers
performances (1) ──→ (many) performance_recommendations

divisions (1) ──→ (many) organizational_structures
positions (1) ──→ (many) organizational_structures
organizational_structures (many) ──→ (1) terms
positions (1) ──→ (many) position_permissions
```

### Critical Constraints

**Unique Constraints**:
- `users.email` - One account per email
- `user_settings.user_id` - One settings per user
- `push_subscriptions.endpoint` - One subscription per device
- `divisions.name` - No duplicate divisions
- `positions.name` - No duplicate positions
- `monthly_reports.month` - One report per month

**Foreign Key Constraints**:
- `borrowing_requests.borrower_id → users.id` (CASCADE)
- `borrowing_items.borrowing_id → borrowing_requests.id` (CASCADE)
- `inventory_units.inventory_item_id → inventory_items.id` (CASCADE)
- `users.division_id → divisions.id` (SET NULL)

**Indexes** (Performance):
- `users(email)`, `users(role)`, `users(division_id)`
- `borrowing_requests(borrower_id, status, request_date DESC)`
- `borrowing_items(borrowing_id, inventory_unit_id)`
- `inventory_items(name, category, collection_group)`
- `inventory_units(inventory_item_id, unit_number)`
- `performances(created_by, start_time DESC)`

---

## USER ROLES & PERMISSIONS

### Role-Based Access Control Matrix

| Feature | Borrower | Staff | Admin |
|---------|----------|-------|-------|
| **Browsing & Viewing** |
| View available items | ✅ | ✅ | ✅ |
| View performance recommendations | ✅ (in performance) | ✅ | ✅ |
| View own borrowing history | ✅ | ✅ | ✅ |
| View organization wide history | ❌ | ✅ | ✅ |
| View user profiles | ✅ | ✅ | ✅ |
| **Borrowing Operations** |
| Create borrow request | ✅ | ✅ (for others) | ❌ |
| View own requests | ✅ | ✅ | ✅ |
| Initiate return | ✅ | ✅ (for others) | ❌ |
| Submit photos during borrow/return | ✅ | ✅ | ❌ |
| **Request Approval** |
| Approve borrow requests | ❌ | ✅ | ✅ |
| Decline requests | ❌ | ✅ | ✅ |
| View approval queue | ❌ | ✅ | ✅ |
| **Inventory Management** |
| View inventory details | ✅ | ✅ | ✅ |
| Add/edit inventory items | ❌ | ✅ | ✅ |
| Delete inventory items | ❌ | ✅ (soft) | ✅ |
| Upload inventory images | ❌ | ✅ | ✅ |
| Generate QR codes | ❌ | ✅ | ✅ |
| **Scanning Features** |
| Scan QR codes | ✅ | ✅ | ❌ |
| Use AI instrument scanner | ✅ | ✅ | ❌ |
| **Performance Management** |
| View performances | ✅ (own) | ✅ | ✅ |
| Create performance | ❌ | ✅ | ✅ |
| Edit performance | ❌ | ✅ | ✅ |
| Delete performance | ❌ | ✅ | ✅ |
| **Master List Configuration** |
| View master list | ❌ | ✅ | ✅ |
| Create master list entity | ❌ | ✅ | ✅ |
| Edit master list entity | ❌ | ✅ | ✅ |
| Delete master list entity | ❌ | ✅ | ✅ |
| **Reporting** |
| View own statistics | ✅ | ✅ | ✅ |
| Generate reports | ❌ | ✅ | ✅ |
| Export reports (CSV/PDF) | ❌ | ✅ | ✅ |
| **Slideshow Management** |
| View GetStarted slideshow | ✅ | ✅ | ✅ |
| Edit slideshow images | ❌ | ✅ | ✅ |
| Upload slideshow images | ❌ | ✅ | ✅ |
| **User Management** |
| Register account (self) | ✅ | ✅ | ✅ |
| View user list | ❌ | ❌ | ✅ |
| Assign roles to users | ❌ | ❌ | ✅ |
| Deactivate user accounts | ❌ | ❌ | ✅ |
| **Settings** |
| View own settings | ✅ | ✅ | ✅ |
| Update own settings | ✅ | ✅ | ✅ |
| Push notification subscription | ✅ | ✅ | ✅ |

### Authentication Flow

```
User Opens App
    ↓
Check localStorage for JWT token
    ↓
If no token → Show Login page
If token exists → Validate at backend
    ↓
Valid token → Load user data
    ↓
Set UserContext with { user, role, permissions }
    ↓
Route to appropriate dashboard based on role
```

### Authorization Mechanism

```javascript
// Backend middleware
const ensureAuth = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({error: 'Not authenticated'});
  const decoded = jwt.verify(token, SECRET);
  req.user = decoded;
  next();
};

const ensureRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) 
    return res.status(403).json({error: 'Not authorized'});
  next();
};

// Usage in routes
app.get('/admin/users', ensureAuth, ensureRole(['admin']), adminUserController);
```

---

## COMPLETE USER WORKFLOWS

[Document continues with detailed user flows for each role...]

---

## FEATURE DOCUMENTATION

[Document continues with detailed feature explanations...]

---

## INSTALLATION & SETUP

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org))
- PostgreSQL 12+ ([Download](https://www.postgresql.org/download/))
- Git
- Postman (optional, for API testing)
- VS Code (recommended)

### Backend Setup

1. **Clone repository and navigate to server**
```bash
cd server
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. **Create PostgreSQL database**
```bash
createdb loginauth
```

5. **Run migrations**
```bash
npm run migrate
```

6. **Start backend server**
```bash
npm start
# Server runs on http://localhost:8000
```

### Frontend Setup

1. **Navigate to client directory**
```bash
cd client
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
# Create .env file
VITE_API_URL=http://localhost:8000
```

4. **Start development server**
```bash
npm run dev
# Frontend runs on http://localhost:5173
```

5. **Open in browser**
```
http://localhost:5173
```

---

## DEPLOYMENT GUIDE

[Deployment instructions for production...]

---

## API REFERENCE

[Complete API documentation...]

---

## TROUBLESHOOTING

[Common issues and solutions...]

---

**Documentation Version**: 1.0.0
**Last Updated**: April 12, 2026
**For Questions**: Refer to specific feature documentation or contact system administrator
