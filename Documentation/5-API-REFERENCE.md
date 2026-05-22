# 🔗 API Reference - Complete Endpoints Documentation

Complete documentation of all API endpoints for the Music Instrument Borrowing System.

---

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [Inventory Endpoints](#inventory-endpoints)
4. [Borrow Endpoints](#borrow-endpoints)
5. [Return Endpoints](#return-endpoints)
6. [Profile Endpoints](#profile-endpoints)
7. [Report Endpoints](#report-endpoints)
8. [Notification Endpoints](#notification-endpoints)
9. [Error Codes](#error-codes)
10. [Response Formats](#response-formats)

---

## 🌐 API Overview

### Base URL

```
Development: http://localhost:8000
Production: https://your-domain.com
```

### Common Headers

**All requests should include:**

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Example:**

```bash
curl -X GET http://localhost:8000/api/borrow/my-borrows \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

### Response Format

```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

---

## 🔐 Authentication Endpoints

### 1. Register New User

**Endpoint:**
```
POST /api/auth/register
```

**Request Body:**
```json
{
  "name": "John Student",
  "email": "john@carsu.edu.ph",
  "password": "Pass123456",
  "phone": "09123456789"
}
```

**Response (Success - 200):**
```json
{
  "message": "Registration successful! Check your email for the verification code.",
  "userId": 5,
  "email": "john@carsu.edu.ph",
  "expiresIn": "15 minutes"
}
```

**Response (Error - 400):**
```json
{
  "error": "Only @carsu.edu.ph or @gmail.com email addresses are allowed"
}
```

**Rules:**
- Email must end with @carsu.edu.ph or @gmail.com
- Password minimum 6 characters
- Phone number required
- Returns verification code sent to email

---

### 2. Login

**Endpoint:**
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "john@carsu.edu.ph",
  "password": "Pass123456"
}
```

**Response (Success - 200):**
```json
{
  "user": {
    "id": 5,
    "name": "John Student",
    "email": "john@carsu.edu.ph",
    "role": "borrower",
    "phone": "09123456789",
    "is_verified": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsImlhdCI6MTY0Njc3MjAwMH0..."
}
```

**Response (Error - 401):**
```json
{
  "error": "Invalid credentials"
}
```

**Response (Error - 403):**
```json
{
  "error": "Please verify your email first"
}
```

---

### 3. Verify Email

**Endpoint:**
```
POST /api/auth/verify-email
```

**Request Body:**
```json
{
  "token": "123456",
  "email": "john@carsu.edu.ph"
}
```

**Response (Success - 200):**
```json
{
  "message": "Email verified successfully!",
  "user": {
    "id": 5,
    "email": "john@carsu.edu.ph",
    "is_verified": true
  }
}
```

---

### 4. Logout

**Endpoint:**
```
POST /api/auth/logout
Authorization: Bearer <TOKEN>
```

**Response (Success - 200):**
```json
{
  "message": "Logged out successfully"
}
```

---

### 5. Get Current User

**Endpoint:**
```
GET /api/auth/me
Authorization: Bearer <TOKEN>
```

**Response (Success - 200):**
```json
{
  "user": {
    "id": 5,
    "name": "John Student",
    "email": "john@carsu.edu.ph",
    "role": "borrower"
  }
}
```

---

## 📦 Inventory Endpoints

### 1. Get All Instruments

**Endpoint:**
```
GET /api/inventory/get-items
Authorization: Bearer <TOKEN>
```

**Query Parameters:**
```
?category=String&search=Guitar&limit=10&offset=0
```

**Response (Success - 200):**
```json
{
  "instruments": [
    {
      "id": 1,
      "name": "Classical Guitar",
      "description": "6-string acoustic",
      "quantity_total": 5,
      "quantity_available": 3,
      "category": "String",
      "condition": "Good",
      "image_url": "/uploads/guitar.jpg",
      "qr_code": "data:image/png;base64,..."
    },
    {
      "id": 2,
      "name": "Violin",
      "description": "Full-size violin",
      "quantity_total": 3,
      "quantity_available": 2,
      "category": "String",
      "condition": "Good",
      "image_url": "/uploads/violin.jpg"
    }
  ],
  "total": 2,
  "limit": 10,
  "offset": 0
}
```

---

### 2. Get Single Instrument

**Endpoint:**
```
GET /api/inventory/get-item/:id
Authorization: Bearer <TOKEN>
```

**Response (Success - 200):**
```json
{
  "instrument": {
    "id": 1,
    "name": "Classical Guitar",
    "description": "6-string acoustic guitar",
    "quantity_total": 5,
    "quantity_available": 3,
    "category": "String",
    "condition": "Good",
    "created_at": "2026-03-01 10:00:00",
    "updated_at": "2026-03-10 14:30:00"
  }
}
```

---

### 3. Search Instruments

**Endpoint:**
```
GET /api/inventory/search
Authorization: Bearer <TOKEN>
```

**Query Parameters:**
```
?q=Guitar&category=String&inStock=true
```

**Response (Success - 200):**
```json
{
  "results": [
    {
      "id": 1,
      "name": "Classical Guitar",
      "category": "String",
      "quantity_available": 3
    }
  ],
  "count": 1
}
```

---

## 🛒 Borrow Endpoints

### 1. Submit Borrow Request

**Endpoint:**
```
POST /api/borrow/submit-borrow
Authorization: Bearer <TOKEN>
```

**Request Body:**
```json
{
  "items": [
    {
      "instrument_id": 1,
      "quantity": 2,
      "unit_numbers": "1,2"
    },
    {
      "instrument_id": 2,
      "quantity": 1,
      "unit_numbers": "1"
    }
  ],
  "expected_return_date": "2026-03-17",
  "photos": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABA...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."
  ]
}
```

**Response (Success - 201):**
```json
{
  "message": "Borrow request submitted successfully",
  "borrow_id": 10,
  "status": "pending",
  "created_at": "2026-03-10 14:30:00",
  "items": 2,
  "photos_saved": 2
}
```

**Response (Error - 400):**
```json
{
  "error": "Guitar (Unit 1) is not available"
}
```

**Rules:**
- All items must be available in requested quantities
- Photos are required (at least 1)
- Expected return date must be in future
- Reduces quantity_available immediately

---

### 2. Get My Borrow Requests

**Endpoint:**
```
GET /api/borrow/my-borrows
Authorization: Bearer <TOKEN>
```

**Query Parameters:**
```
?status=pending&limit=10&offset=0
```

**Response (Success - 200):**
```json
{
  "borrows": [
    {
      "id": 10,
      "status": "pending",
      "created_at": "2026-03-10 14:30:00",
      "expected_return_date": "2026-03-17",
      "items": [
        {
          "id": 20,
          "instrument": "Classical Guitar",
          "quantity": 2,
          "unit_numbers": "1,2",
          "status": "pending"
        }
      ]
    }
  ],
  "total": 1
}
```

---

### 3. Get Single Borrow Request

**Endpoint:**
```
GET /api/borrow/:borrowId
Authorization: Bearer <TOKEN>
```

**Response (Success - 200):**
```json
{
  "borrow": {
    "id": 10,
    "borrower_id": 5,
    "status": "approved",
    "created_at": "2026-03-10 14:30:00",
    "approved_at": "2026-03-10 15:00:00",
    "expected_return_date": "2026-03-17",
    "items": [
      {
        "instrument_id": 1,
        "name": "Classical Guitar",
        "quantity": 2,
        "unit_numbers": "1,2"
      }
    ],
    "photos": [
      {
        "id": 1,
        "photo_url": "/uploads/borrow_10_0.jpg",
        "photo_type": "borrow",
        "created_at": "2026-03-10 14:30:00"
      }
    ]
  }
}
```

---

### 4. Get Pending Borrow Requests (Staff/Admin)

**Endpoint:**
```
GET /api/borrow/pending-requests
Authorization: Bearer <TOKEN>
Role: staff, admin
```

**Response (Success - 200):**
```json
{
  "pending": [
    {
      "id": 10,
      "borrower": "John Student",
      "items_count": 2,
      "created_at": "2026-03-10 14:30:00",
      "total_items": 3
    }
  ],
  "total": 1
}
```

---

### 5. Approve Borrow Request (Staff/Admin)

**Endpoint:**
```
POST /api/borrow/approve-borrow
Authorization: Bearer <TOKEN>
Role: staff, admin
```

**Request Body:**
```json
{
  "borrow_id": 10,
  "notes": "Approved for 1 week"
}
```

**Response (Success - 200):**
```json
{
  "message": "Borrow request approved",
  "borrow_id": 10,
  "status": "approved",
  "approved_at": "2026-03-10 15:00:00"
}
```

**Actions:**
- Updates borrow status to "approved"
- Sends email to borrower
- Creates notification

---

### 6. Reject Borrow Request (Staff/Admin)

**Endpoint:**
```
POST /api/borrow/reject-borrow
Authorization: Bearer <TOKEN>
Role: staff, admin
```

**Request Body:**
```json
{
  "borrow_id": 10,
  "reason": "Insufficient available units"
}
```

**Response (Success - 200):**
```json
{
  "message": "Borrow request rejected",
  "borrow_id": 10,
  "status": "rejected"
}
```

**Actions:**
- Updates status to "rejected"
- Restores quantities to instruments
- Sends email to borrower with reason
- Creates notification

---

## 🔄 Return Endpoints

### 1. Process Return

**Endpoint:**
```
POST /api/borrow/process-return
Authorization: Bearer <TOKEN>
Role: staff, admin
```

**Request Body:**
```json
{
  "borrow_id": 10,
  "photos": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."
  ],
  "condition": "Good",
  "notes": "No damage observed"
}
```

**Response (Success - 200):**
```json
{
  "message": "Return processed successfully",
  "borrow_id": 10,
  "return_id": 5,
  "status": "returned",
  "items_returned": 2
}
```

**Actions:**
- Creates return record
- Saves return photos
- Updates borrow status to "returned"
- Restores quantities to instruments
- Sends confirmation email
- Creates notification

---

### 2. Get Return History

**Endpoint:**
```
GET /api/borrow/returns
Authorization: Bearer <TOKEN>
```

**Response (Success - 200):**
```json
{
  "returns": [
    {
      "id": 5,
      "borrow_id": 10,
      "return_date": "2026-03-16 16:00:00",
      "condition": "Good",
      "returned_by": "Staff User",
      "items": [
        {
          "instrument": "Classical Guitar",
          "quantity": 2,
          "unit_numbers": "1,2"
        }
      ]
    }
  ],
  "total": 1
}
```

---

## 👤 Profile Endpoints

### 1. Get User Profile

**Endpoint:**
```
GET /api/profile/me
Authorization: Bearer <TOKEN>
```

**Response (Success - 200):**
```json
{
  "user": {
    "id": 5,
    "name": "John Student",
    "email": "john@carsu.edu.ph",
    "role": "borrower",
    "phone": "09123456789",
    "is_verified": true,
    "created_at": "2026-03-01 10:00:00"
  }
}
```

---

### 2. Update Profile

**Endpoint:**
```
PUT /api/profile/update
Authorization: Bearer <TOKEN>
```

**Request Body:**
```json
{
  "name": "John Doe",
  "phone": "09987654321"
}
```

**Response (Success - 200):**
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": 5,
    "name": "John Doe",
    "email": "john@carsu.edu.ph",
    "phone": "09987654321"
  }
}
```

---

### 3. Change Password

**Endpoint:**
```
POST /api/profile/change-password
Authorization: Bearer <TOKEN>
```

**Request Body:**
```json
{
  "old_password": "OldPass123",
  "new_password": "NewPass456"
}
```

**Response (Success - 200):**
```json
{
  "message": "Password changed successfully"
}
```

---

## 📊 Report Endpoints

### 1. Get Borrow Statistics

**Endpoint:**
```
GET /api/reports/borrow-stats
Authorization: Bearer <TOKEN>
Role: staff, admin
```

**Query Parameters:**
```
?startDate=2026-01-01&endDate=2026-03-10&groupBy=daily
```

**Response (Success - 200):**
```json
{
  "statistics": {
    "total_borrows": 45,
    "pending": 5,
    "approved": 35,
    "returned": 40,
    "rejected": 0,
    "most_borrowed": "Classical Guitar",
    "borrow_trend": [
      {
        "date": "2026-03-10",
        "count": 5,
        "returned": 3
      }
    ]
  }
}
```

---

### 2. Get User Borrowing History

**Endpoint:**
```
GET /api/reports/user-history/:userId
Authorization: Bearer <TOKEN>
Role: admin
```

**Response (Success - 200):**
```json
{
  "user": "John Student",
  "total_borrows": 12,
  "active_borrows": 2,
  "returned": 10,
  "history": [
    {
      "borrow_id": 10,
      "items": ["Guitar", "Violin"],
      "status": "pending",
      "created_at": "2026-03-10"
    }
  ]
}
```

---

## 🔔 Notification Endpoints

### 1. Get User Notifications

**Endpoint:**
```
GET /api/notifications
Authorization: Bearer <TOKEN>
```

**Query Parameters:**
```
?limit=20&unread=true
```

**Response (Success - 200):**
```json
{
  "notifications": [
    {
      "id": 1,
      "title": "Borrow Approved",
      "message": "Your borrow request #10 has been approved",
      "type": "success",
      "is_read": false,
      "created_at": "2026-03-10 15:00:00"
    }
  ],
  "unread_count": 3
}
```

---

### 2. Mark Notification as Read

**Endpoint:**
```
PUT /api/notifications/:notificationId/read
Authorization: Bearer <TOKEN>
```

**Response (Success - 200):**
```json
{
  "message": "Notification marked as read",
  "notification_id": 1
}
```

---

### 3. Subscribe to Push Notifications

**Endpoint:**
```
POST /api/notifications/subscribe
Authorization: Bearer <TOKEN>
```

**Request Body:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "auth": "...",
      "p256dh": "..."
    }
  }
}
```

**Response (Success - 200):**
```json
{
  "message": "Subscribed to notifications",
  "subscription_saved": true
}
```

---

## ⚠️ Error Codes

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 400 | Bad Request | Missing required field |
| 401 | Unauthorized | No token provided |
| 403 | Forbidden | Token invalid or expired |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Email already registered |
| 500 | Server Error | Database error |

### Common Error Responses

**Missing Token (401):**
```json
{
  "error": "No token provided",
  "code": "MISSING_TOKEN"
}
```

**Invalid Token (401):**
```json
{
  "error": "Invalid or expired token",
  "code": "INVALID_TOKEN"
}
```

**Insufficient Permissions (403):**
```json
{
  "error": "You do not have permission to access this resource",
  "code": "INSUFFICIENT_PERMISSIONS"
}
```

**Resource Not Found (404):**
```json
{
  "error": "Borrow request not found",
  "code": "NOT_FOUND"
}
```

**Validation Error (400):**
```json
{
  "error": "Validation failed",
  "fields": {
    "email": "Email is required",
    "password": "Password must be at least 6 characters"
  }
}
```

---

## 📋 Response Formats

### Success Response

```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* additional info */ }
}
```

### Paginated Response

```json
{
  "data": [ /* array of items */ ],
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "pages": 10,
    "current_page": 1
  }
}
```

---

## 🔑 Authentication Token Usage

### Obtaining a Token

```bash
# 1. Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@carsu.edu.ph",
    "password": "Pass123456"
  }'

# Response includes "token"
```

### Using the Token

```bash
# Include in Authorization header
curl -X GET http://localhost:8000/api/borrow/my-borrows \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Token Expiration

- Tokens expire after 24 hours
- Re-login to get a new token
- Expired token returns 401 Unauthorized

---

## 📚 Related Guides

- [System Architecture](4-SYSTEM-ARCHITECTURE.md) - Understand how APIs are used
- [Testing Guide](7-TESTING-VERIFICATION.md) - How to test APIs
- [Backend Setup](1-BACKEND-SETUP.md) - Running the backend

---

**Last Updated:** March 2026  
**Version:** 1.0  
**Status:** ✅ Complete API Documentation
