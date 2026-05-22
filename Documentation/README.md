# 🎵 Music Instrument Borrowing System - Developer Guide

Welcome to the **Music Instrument Borrowing System (UCCA)** - a comprehensive platform for managing musical instrument lending, borrowing, and inventory management.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [System Overview](#system-overview)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [Complete Setup Guides](#complete-setup-guides)
7. [Architecture & Flow](#architecture--flow)
8. [Features](#features)
9. [Troubleshooting](#troubleshooting)
10. [Additional Resources](#additional-resources)

---

## 🚀 Quick Start

**New to the project?** Follow these steps to get up and running in under 1 hour:

1. **Install Prerequisites** (30 minutes)
   - Node.js 16+ and npm
   - PostgreSQL 12+
   - Git

2. **Clone & Setup** (20 minutes)
   ```bash
   # Clone the repository
   git clone <repository-url>
   cd LOGINAUTH
   
   # Install dependencies
   npm install
   cd server && npm install && cd ..
   cd client && npm install && cd ..
   ```

3. **Configure Database** (10 minutes)
   - Create PostgreSQL database named `ucca`
   - Update `.env` files with credentials

4. **Start Development Servers** (5 minutes)
   ```bash
   # Terminal 1: Backend
   cd server
   npm start
   
   # Terminal 2: Frontend (in new terminal)
   cd client
   npm run dev
   ```

5. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - Default Login: See database setup

---

## 🏛️ System Overview

### What Does This System Do?

The **Music Instrument Borrowing System** is an integrated platform that allows:

- **Students/Borrowers** to:
  - Browse available instruments
  - Create borrow requests with photo documentation
  - Track borrowed items and return history
  - Scan QR codes or upload photos for automatic detection

- **Staff Members** to:
  - Manage borrow requests (approve/deny)
  - Process returns with photo capture
  - Create and manage borrower schedules
  - Process bulk borrowing operations

- **Administrators** to:
  - Manage user accounts and permissions
  - Control inventory and instrument information
  - Generate reports and analytics
  - Monitor system performance

### Key Capabilities

✅ **Multi-Unit Instrument Detection** - Automatically detect multiple instruments from photos  
✅ **QR Code Scanning** - Fast borrowing via QR code scanning  
✅ **Photo Documentation** - Required photos for all borrow/return operations  
✅ **Email Verification** - Secure user registration with email verification  
✅ **JWT Authentication** - Secure session management with JWT tokens  
✅ **Role-Based Access** - Borrower, Staff, and Admin roles with different permissions  
✅ **Staff Scheduling** - Schedule management for staff availability  
✅ **Notification System** - Real-time notifications and email alerts  
✅ **Analytics & Reports** - Comprehensive borrowing statistics and trends  

---

## 💻 Technology Stack

### Frontend
- **React 19.1.0** - Modern UI framework with hooks
- **Vite 7.0.0** - Fast build tool and dev server
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **React Router 7.6.3** - Client-side routing
- **Axios 1.10.0** - HTTP client for API calls
- **html5-qrcode** - QR code scanning from camera
- **TensorFlow.js** - ML for instrument detection
- **Recharts** - Data visualization and charts
- **Radix UI** - Accessible UI components
- **React Hot Toast** - Toast notifications

### Backend
- **Express 5.1.0** - Node.js web framework
- **Node.js 16+** - JavaScript runtime
- **PostgreSQL 12+** - Relational database
- **Passport.js** - Authentication middleware
- **JWT (jsonwebtoken)** - Token-based authentication
- **Bcrypt** - Password hashing
- **Multer** - File upload handling
- **Nodemailer** - Email sending
- **node-cron** - Scheduled tasks
- **Sharp** - Image processing
- **tesseract.js** - OCR for text recognition

### Database
- **PostgreSQL 12+** - Main relational database
- **pg (node-postgres)** - PostgreSQL client for Node.js

### DevOps & Deployment (Optional)
- **PM2** - Process manager for production
- **Nginx** - Reverse proxy
- **Let's Encrypt** - SSL/TLS certificates
- **Docker** - Containerization (optional)

---

## 📁 Project Structure

```
LOGINAUTH/
│
├── server/                          # 🔧 Backend (Express.js)
│   ├── controllers/                 # Business logic
│   │   ├── authController.js       # Authentication logic
│   │   ├── borrowController.js     # Borrowing operations
│   │   ├── inventoryController.js  # Inventory management
│   │   └── ... (6 more controllers)
│   │
│   ├── routes/                      # API endpoints
│   │   ├── authRoutes.js           # Auth endpoints
│   │   ├── borrowRoutes.js         # Borrow endpoints
│   │   ├── inventoryRoutes.js      # Inventory endpoints
│   │   └── ... (6 more routes)
│   │
│   ├── services/                    # Helper services
│   │   ├── emailService.js         # Email sending
│   │   ├── verificationService.js  # Email verification
│   │   └── notificationService.js  # Push notifications
│   │
│   ├── middleware/                  # Express middleware
│   │   ├── auth.js                 # Authentication middleware
│   │   └── errorHandler.js         # Error handling
│   │
│   ├── cron/                        # Scheduled tasks
│   │   └── notificationScheduler.js # Background jobs
│   │
│   ├── ml/                          # Machine learning models
│   │   └── instrumentDetector.js   # Instrument detection
│   │
│   ├── migrations/                  # Database migrations
│   │   ├── add_email_verification.sql
│   │   ├── add_unit_number.sql
│   │   └── ...
│   │
│   ├── public/                      # Static files
│   │   ├── uploads/                # User uploaded files
│   │   └── qr_codes/               # Generated QR codes
│   │
│   ├── index.js                    # Server entry point
│   ├── db.js                       # PostgreSQL connection
│   ├── passport.js                 # Passport configuration
│   ├── .env                        # Environment variables
│   ├── package.json                # Dependencies
│   └── package-lock.json
│
├── client/                          # 🎨 Frontend (React)
│   ├── src/
│   │   ├── pages/                  # Page components (29 pages)
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── AvailableItems.jsx
│   │   │   ├── BorrowCart.jsx
│   │   │   ├── StaffBorrowCart.jsx
│   │   │   └── ... (24 more pages)
│   │   │
│   │   ├── components/             # Reusable components
│   │   │   ├── Navbar.jsx
│   │   │   ├── AddToCartModal.jsx
│   │   │   ├── BorrowPhotoCaptureModal.jsx
│   │   │   └── ... (14 more components)
│   │   │
│   │   ├── context/                # React Context (state management)
│   │   │   ├── userContext.jsx     # Authentication state
│   │   │   └── borrowingContext.jsx# Cart/borrowing state
│   │   │
│   │   ├── services/               # API communication
│   │   │   ├── api.js              # Axios instance setup
│   │   │   ├── auth.js             # Auth API calls
│   │   │   ├── borrow.js           # Borrow API calls
│   │   │   └── ... (5 more services)
│   │   │
│   │   ├── assets/                 # Images and static files
│   │   ├── lib/                    # Utility functions
│   │   ├── App.jsx                 # Main app component
│   │   ├── main.jsx                # Entry point
│   │   └── index.css               # Global styles
│   │
│   ├── .env                        # Environment variables
│   ├── vite.config.js              # Vite configuration
│   ├── tailwind.config.js           # Tailwind configuration
│   ├── package.json                # Dependencies
│   └── package-lock.json
│
├── Documentation/                   # 📚 Guides & Documentation
│   ├── README.md                   # This file
│   ├── 1-BACKEND-SETUP.md          # Backend installation & setup
│   ├── 2-FRONTEND-SETUP.md         # Frontend installation & setup
│   ├── 3-DATABASE-SETUP.md         # Database configuration
│   ├── 4-SYSTEM-ARCHITECTURE.md    # System design & flow
│   ├── 5-API-REFERENCE.md          # API endpoints documentation
│   ├── 6-FEATURES-GUIDE.md         # Feature explanations
│   ├── 7-TESTING-VERIFICATION.md   # How to test the system
│   └── TROUBLESHOOTING.md          # Common issues & solutions
│
├── .env                            # Root environment (not used)
├── .gitignore                      # Git ignore patterns
├── package.json                    # Root package (minimal)
└── package-lock.json
```

---

## 🛠️ Getting Started

### Prerequisites

Before you begin, ensure you have installed:

- **Node.js** v16.0.0 or higher
  - Download: https://nodejs.org/
  - Verify: `node --version` and `npm --version`

- **PostgreSQL** v12 or higher
  - Download: https://www.postgresql.org/download/
  - Verify: `psql --version`

- **Git** (optional, for cloning)
  - Download: https://git-scm.com/

---

## 📚 Complete Setup Guides

Follow these step-by-step guides for detailed setup instructions:

### 1. **[Backend Setup Guide](1-BACKEND-SETUP.md)** ⭐ START HERE
   - Install backend dependencies
   - Configure PostgreSQL
   - Set environment variables
   - Run migrations
   - Start the Express server
   - Verify backend is working

### 2. **[Frontend Setup Guide](2-FRONTEND-SETUP.md)**
   - Install frontend dependencies
   - Configure API endpoints
   - Set environment variables
   - Start Vite dev server
   - Test frontend connectivity

### 3. **[Database Setup Guide](3-DATABASE-SETUP.md)**
   - Create PostgreSQL database
   - Execute schema and migrations
   - Load sample data
   - Verify database integrity

### 4. **[System Architecture Guide](4-SYSTEM-ARCHITECTURE.md)**
   - Understand system design
   - Learn data flow patterns
   - Component interactions
   - Authentication flow
   - File upload process

### 5. **[API Reference Guide](5-API-REFERENCE.md)**
   - All API endpoints documented
   - Request/response examples
   - Authentication details
   - Error codes and messages

### 6. **[Features Guide](6-FEATURES-GUIDE.md)**
   - Feature descriptions
   - How each feature works
   - User workflows
   - Admin workflows

### 7. **[Testing & Verification Guide](7-TESTING-VERIFICATION.md)**
   - How to test the system
   - Test scenarios
   - Verification checklist
   - Performance testing

### 8. **[Troubleshooting Guide](TROUBLESHOOTING.md)**
   - Common issues
   - Solutions
   - Debug tips
   - Contact information

---

## 🏗️ Architecture & Flow

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   CLIENT LAYER (React)                       │
│  Browser → Vite Dev Server @ localhost:5173                 │
│  Pages: Login, Dashboard, BorrowCart, etc.                  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP/AJAX (Axios)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER (Express)                       │
│  Backend @ localhost:8000                                    │
│  Routes: /api/auth, /api/borrow, /api/inventory, etc.       │
│  Controllers handle business logic                          │
└────────────────────┬────────────────────────────────────────┘
                     │ SQL Queries (pg)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│               DATABASE LAYER (PostgreSQL)                    │
│  Database: ucca @ localhost:5432                            │
│  12 Tables: users, instruments, borrows, etc.               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Example: Borrowing an Instrument

```
1. User clicks "Add to Cart"
   └→ Frontend (React) sends POST /api/borrow/add-to-cart
      └→ Backend receives request (borrowController.js)
         └→ Validates user & instrument
         └→ Creates cart entry in database
         └→ Returns success/error response
            └→ Frontend updates cart state (borrowingContext)
               └→ UI updates to show item in cart
                  └→ Toast notification shown to user
```

### Authentication Flow

```
1. User enters credentials
   └→ Frontend sends POST /api/auth/login
      └→ authController validates & checks database
         └→ Password verified with bcrypt
         └→ JWT token generated
         └→ Sent back to frontend
            └→ Token stored in context/state
            └→ User redirected to dashboard
               └→ All API calls now include JWT token
```

---

## ✨ Features

### User Features
- ✅ Register with email verification
- ✅ Browse available instruments
- ✅ Add items to borrowing cart
- ✅ Submit borrow requests with photos
- ✅ Track borrowed items
- ✅ View borrowing history
- ✅ Return borrowed items with photos
- ✅ Scan QR codes for quick borrowing
- ✅ Upload photos for automatic instrument detection
- ✅ Receive notifications

### Staff Features
- ✅ View pending borrow requests
- ✅ Approve/deny requests
- ✅ Process returns with photo documentation
- ✅ Manage availability schedule
- ✅ Bulk borrowing operations

### Admin Features
- ✅ User management (create, edit, delete)
- ✅ Inventory management
- ✅ View and analyze reports
- ✅ System configuration
- ✅ Staff schedule management

---

## 🔧 Troubleshooting

### Common Issues

**"Cannot connect to database"**
- Check PostgreSQL is running
- Verify credentials in .env files
- Ensure database `ucca` exists

**"Port 8000 already in use"**
- Change PORT in server/.env
- Or kill the process using port 8000

**"Frontend can't reach backend"**
- Check backend is running on http://localhost:8000
- Verify CORS settings in server/index.js
- Check axios.defaults.baseURL in client/src/App.jsx

**"npm install fails"**
- Clear npm cache: `npm cache clean --force`
- Delete node_modules: `rm -rf node_modules`
- Reinstall: `npm install`

For more issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 📞 Additional Resources

### Official Documentation
- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Guide](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Developer Guides in This Project
1. [Backend Setup](1-BACKEND-SETUP.md) - Server installation & configuration
2. [Frontend Setup](2-FRONTEND-SETUP.md) - Client installation & configuration
3. [Database Setup](3-DATABASE-SETUP.md) - PostgreSQL configuration
4. [System Architecture](4-SYSTEM-ARCHITECTURE.md) - Design patterns & flows
5. [API Reference](5-API-REFERENCE.md) - API documentation
6. [Features Guide](6-FEATURES-GUIDE.md) - Feature explanations
7. [Testing Guide](7-TESTING-VERIFICATION.md) - Test procedures

### Quick Links
- 📖 [See All Documentation Files](.) - Browse all guides
- 🐛 [Troubleshooting Guide](TROUBLESHOOTING.md) - Solve common problems
- 💾 [Database Guide](3-DATABASE-SETUP.md) - Database operations

---

## 🎯 Next Steps

1. **First time?** → Read the [Backend Setup Guide](1-BACKEND-SETUP.md)
2. **Need to understand the flow?** → Check [System Architecture](4-SYSTEM-ARCHITECTURE.md)
3. **Looking for API details?** → See [API Reference](5-API-REFERENCE.md)
4. **Having issues?** → Visit [Troubleshooting Guide](TROUBLESHOOTING.md)
5. **Want to test features?** → Follow [Testing Guide](7-TESTING-VERIFICATION.md)

---

**Last Updated:** March 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready

For questions or contributions, please contact the development team.
