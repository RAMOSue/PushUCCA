# Complete API Reference Guide

## System Overview

This document provides comprehensive API endpoint documentation for the entire system, organized by function module.

**Base URL**: `http://localhost:5000/api` (Development) | `https://yourdomain.com/api` (Production)

**Authentication**: All secure endpoints require JWT Bearer token in Authorization header
```
Authorization: Bearer <jwt_token>
```

---

## Table of Contents

1. [Authentication Endpoints](#1-authentication-endpoints)
2. [User Profile Endpoints](#2-user-profile-endpoints)
3. [Borrowing Request Endpoints](#3-borrowing-request-endpoints)
4. [Inventory Management Endpoints](#4-inventory-management-endpoints)
5. [Performance Scheduling Endpoints](#5-performance-scheduling-endpoints)
6. [Master List Endpoints](#6-master-list-endpoints)
7. [Reporting & Analytics Endpoints](#7-reporting--analytics-endpoints)
8. [Settings & Configuration Endpoints](#8-settings--configuration-endpoints)
9. [Notification Endpoints](#9-notification-endpoints)
10. [Image Recognition Endpoints](#10-image-recognition-endpoints)
11. [Error Codes & Status Reference](#11-error-codes--status-reference)

---

## 1. Authentication Endpoints

### 1.1 Register User
**Endpoint**: `POST /auth/register`

**Description**: Create a new user account

**Access**: Public

**Request Body**:
```json
{
  "username": "string (3-50 chars, alphanumeric + underscore)",
  "email": "string (valid email format)",
  "password": "string (min 6 chars, must include uppercase, digit, special char)",
  "firstName": "string",
  "lastName": "string",
  "contactNumber": "string (10-15 digits)",
  "role": "borrower" // Always 'borrower' for registration; admin assigns roles
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "User registered successfully. Check email for verification.",
  "userId": "uuid",
  "email": "user@example.com"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid input validation
- `409 Conflict`: Username or email already exists
- `422 Unprocessable Entity`: Password doesn't meet requirements

---

### 1.2 Email Verification
**Endpoint**: `POST /auth/verify-email`

**Description**: Verify email address with token sent to user

**Access**: Public

**Request Body**:
```json
{
  "email": "string",
  "token": "string (UUID verification token)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Email verified successfully",
  "verified": true
}
```

**Error Responses**:
- `400 Bad Request`: Invalid or expired token
- `404 Not Found`: Email not found

---

### 1.3 Login
**Endpoint**: `POST /auth/login`

**Description**: Authenticate user and receive JWT token

**Access**: Public

**Request Body**:
```json
{
  "email": "string",
  "password": "string"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_string",
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "role": "borrower|staff|admin",
    "department_id": "uuid or null",
    "division_id": "uuid or null",
    "isVerified": true,
    "isActive": true
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid email or password
- `403 Forbidden`: Account not verified or deactivated
- `404 Not Found`: User doesn't exist

---

### 1.4 Logout
**Endpoint**: `POST /auth/logout`

**Description**: Invalidate current JWT token

**Access**: Protected (Authenticated users)

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 1.5 Refresh Token
**Endpoint**: `POST /auth/refresh-token`

**Description**: Get new JWT token using current token

**Access**: Protected (Authenticated users)

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "token": "new_jwt_token_string"
}
```

---

### 1.6 Request Password Reset
**Endpoint**: `POST /auth/request-password-reset`

**Description**: Send password reset link to email

**Access**: Public

**Request Body**:
```json
{
  "email": "string"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password reset link sent to email"
}
```

---

### 1.7 Reset Password
**Endpoint**: `POST /auth/reset-password`

**Description**: Reset password using token from email

**Access**: Public

**Request Body**:
```json
{
  "email": "string",
  "token": "string (UUID from email)",
  "newPassword": "string"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## 2. User Profile Endpoints

### 2.1 Get Current User Profile
**Endpoint**: `GET /profile/me`

**Description**: Fetch current authenticated user's profile

**Access**: Protected (All authenticated users)

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "contactNumber": "string",
    "role": "borrower|staff|admin",
    "department": {
      "id": "uuid",
      "name": "string",
      "description": "string"
    },
    "division": {
      "id": "uuid",
      "name": "string",
      "description": "string"
    },
    "profilePicture": "string (URL or null)",
    "isVerified": true,
    "isActive": true,
    "createdAt": "ISO8601 timestamp",
    "updatedAt": "ISO8601 timestamp"
  }
}
```

---

### 2.2 Update User Profile
**Endpoint**: `PUT /profile/me`

**Description**: Update current user's profile information

**Access**: Protected (All authenticated users)

**Request Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data (if uploading profile picture)
```

**Request Body**:
```json
{
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "contactNumber": "string (optional)",
  "profilePicture": "file (optional, max 5MB, image only)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": { /* updated user object */ }
}
```

---

### 2.3 Change Password
**Endpoint**: `PUT /profile/change-password`

**Description**: Change current password

**Access**: Protected (All authenticated users)

**Request Body**:
```json
{
  "currentPassword": "string",
  "newPassword": "string (must differ from current)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### 2.4 Get User by ID (Admin/Staff Only)
**Endpoint**: `GET /profile/:userId`

**Description**: Fetch specific user's profile

**Access**: Protected (Admin or Staff)

**Path Parameters**:
- `userId` (UUID): Target user ID

**Response** (200 OK):
```json
{
  "success": true,
  "data": { /* full user object */ }
}
```

---

### 2.5 Update User Role (Admin Only)
**Endpoint**: `PUT /profile/:userId/role`

**Description**: Change user's role and department/division assignment

**Access**: Protected (Admin only)

**Request Body**:
```json
{
  "role": "borrower|staff|admin",
  "department_id": "uuid (required for staff/admin)",
  "division_id": "uuid (optional, for granular assignment)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User role updated successfully",
  "data": { /* updated user object */ }
}
```

---

### 2.6 Deactivate/Reactivate User (Admin Only)
**Endpoint**: `PUT /profile/:userId/status`

**Description**: Deactivate or reactivate user account

**Access**: Protected (Admin only)

**Request Body**:
```json
{
  "isActive": boolean
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User status updated successfully",
  "data": { /* updated user object */ }
}
```

---

## 3. Borrowing Request Endpoints

### 3.1 Get All Borrowing Requests (Filtered by Role)
**Endpoint**: `GET /borrow/requests`

**Description**: Fetch borrowing requests (filtered by user role)
- **Borrower**: Only their own requests
- **Staff**: All requests in their department
- **Admin**: All requests in system

**Access**: Protected (All authenticated users)

**Query Parameters**:
- `status` (optional): pending|approved|rejected|completed
- `page` (optional): pagination (default: 1)
- `limit` (optional): items per page (default: 10)
- `sortBy` (optional): createdAt|status|dueDate (default: createdAt)
- `order` (optional): asc|desc (default: desc)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userName": "string",
      "userEmail": "string",
      "status": "pending|approved|rejected|completed",
      "borrowDate": "ISO8601",
      "dueDate": "ISO8601",
      "returnDate": "ISO8601 or null",
      "items": [
        {
          "inventoryItemId": "uuid",
          "itemName": "string",
          "category": "string",
          "quantity": "number",
          "unit": "string",
          "status": "available|pending|borrowed|returned"
        }
      ],
      "notes": "string or null",
      "approvedBy": "uuid or null",
      "approvalDate": "ISO8601 or null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 47,
    "itemsPerPage": 10
  }
}
```

---

### 3.2 Get Single Borrowing Request
**Endpoint**: `GET /borrow/requests/:requestId`

**Description**: Fetch single borrowing request details

**Access**: Protected (Requestor, Staff in same dept, or Admin)

**Path Parameters**:
- `requestId` (UUID): Borrowing request ID

**Response** (200 OK):
```json
{
  "success": true,
  "data": { /* complete request object with all details */ }
}
```

---

### 3.3 Create Borrowing Request
**Endpoint**: `POST /borrow/requests`

**Description**: Submit new borrowing request

**Access**: Protected (Borrower or Staff)

**Request Body**:
```json
{
  "items": [
    {
      "inventoryItemId": "uuid",
      "quantity": "number",
      "specifics": "string (optional - specific unit selection)"
    }
  ],
  "borrowDate": "ISO8601",
  "dueDate": "ISO8601",
  "performanceId": "uuid (optional - if for performance)",
  "notes": "string (optional)"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Borrow request submitted successfully",
  "data": {
    "id": "uuid",
    "status": "pending",
    "/* ... other fields */
  }
}
```

---

### 3.4 Approve Borrowing Request (Staff/Admin)
**Endpoint**: `PUT /borrow/requests/:requestId/approve`

**Description**: Approve a pending borrowing request

**Access**: Protected (Staff or Admin)

**Request Body**:
```json
{
  "reserveUnits": true, // Whether to automatically reserve units
  "notes": "string (optional)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Request approved successfully",
  "data": { /* updated request object */ }
}
```

---

### 3.5 Reject Borrowing Request
**Endpoint**: `PUT /borrow/requests/:requestId/reject`

**Description**: Reject a pending borrowing request

**Access**: Protected (Staff or Admin)

**Request Body**:
```json
{
  "rejectionReason": "string"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Request rejected successfully"
}
```

---

### 3.6 Return Borrowed Items
**Endpoint**: `PUT /borrow/requests/:requestId/return`

**Description**: Mark items as returned in a borrowing request

**Access**: Protected (Borrower who requested or Staff/Admin)

**Request Body**:
```json
{
  "items": [
    {
      "borrowingItemId": "uuid",
      "condition": "good|fair|damaged", // Item condition upon return
      "notes": "string (optional)"
    }
  ],
  "returnedDate": "ISO8601 (optional, defaults to now)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Items returned successfully",
  "data": { /* updated request object */ }
}
```

---

### 3.7 Get Borrowing History
**Endpoint**: `GET /borrow/history`

**Description**: Get historical borrowing records for current user

**Access**: Protected (Borrower gets own, Staff/Admin can filter)

**Query Parameters**:
- `userId` (optional): Filter by specific user (Admin/Staff only)
- `status` (optional): completed|returned
- `fromDate` (optional): ISO8601
- `toDate` (optional): ISO8601
- `page` (optional): pagination

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userName": "string",
      "items": ["item1", "item2"],
      "borrowDate": "ISO8601",
      "returnDate": "ISO8601",
      "duration": "number (days)",
      "status": "completed|returned"
    }
  ],
  "pagination": {}
}
```

---

## 4. Inventory Management Endpoints

### 4.1 Get Inventory Items
**Endpoint**: `GET /inventory/items`

**Description**: Fetch inventory items catalog

**Access**: Protected (All authenticated users for read; Staff/Admin for management)

**Query Parameters**:
- `category` (optional): String filter
- `available` (optional): true|false
- `search` (optional): Text search on name/description
- `page` (optional): pagination
- `limit` (optional): items per page

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "category": "string",
      "subcategory": "string",
      "image": "string (URL or null)",
      "quantity": "number (total units)",
      "available": "number (available units)",
      "unit": "string (pcs, sets, etc)",
      "damageRating": "number (0-100%)",
      "lastChecked": "ISO8601",
      "condition": "good|fair|damaged",
      "qrCode": "string (generated QR image URL)"
    }
  ],
  "pagination": {}
}
```

---

### 4.2 Get Single Inventory Item
**Endpoint**: `GET /inventory/items/:itemId`

**Description**: Fetch detailed inventory item with all units

**Access**: Protected (All authenticated users)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "category": "string",
    "/* ... basic fields ... */",
    "units": [
      {
        "id": "uuid",
        "serialNumber": "string",
        "condition": "good|fair|damaged",
        "status": "available|borrowed|reserved|maintenance",
        "borrowedBy": "uuid or null",
        "borrowDate": "ISO8601 or null",
        "dueDate": "ISO8601 or null",
        "location": "string",
        "notes": "string or null"
      }
    ]
  }
}
```

---

### 4.3 Create Inventory Item (Staff/Admin)
**Endpoint**: `POST /inventory/items`

**Description**: Add new inventory item to catalog

**Access**: Protected (Staff or Admin)

**Request Body**:
```json
{
  "name": "string (required)",
  "description": "string",
  "category": "string (required)",
  "subcategory": "string",
  "unit": "string (pcs, sets, etc)",
  "quantity": "number (initial quantity)",
  "image": "file (optional, multipart/form-data)",
  "location": "string"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Inventory item created successfully",
  "data": {
    "id": "uuid",
    /* ... item object ... */
  }
}
```

---

### 4.4 Update Inventory Item (Staff/Admin)
**Endpoint**: `PUT /inventory/items/:itemId`

**Description**: Update inventory item details

**Access**: Protected (Staff or Admin)

**Request Body**:
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "category": "string (optional)",
  "location": "string (optional)",
  "image": "file (optional, multipart/form-data)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Item updated successfully",
  "data": {}
}
```

---

### 4.5 Delete Inventory Item (Admin)
**Endpoint**: `DELETE /inventory/items/:itemId`

**Description**: Remove inventory item from catalog

**Access**: Protected (Admin only)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Item deleted successfully"
}
```

---

### 4.6 Add Units to Item (Staff/Admin)
**Endpoint**: `POST /inventory/items/:itemId/units`

**Description**: Add individual units/copies to inventory item

**Access**: Protected (Staff or Admin)

**Request Body**:
```json
{
  "quantity": "number (how many units to add)",
  "serialNumbers": ["SN001", "SN002"], // optional, auto-generated if not provided
  "condition": "good|fair|damaged",
  "location": "string"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Units added successfully",
  "data": {
    "addedCount": 5,
    "units": [ /* array of created unit objects */ ]
  }
}
```

---

### 4.7 Update Unit Status (Staff/Admin)
**Endpoint**: `PUT /inventory/items/:itemId/units/:unitId`

**Description**: Update individual unit status/condition

**Access**: Protected (Staff or Admin)

**Request Body**:
```json
{
  "condition": "good|fair|damaged",
  "status": "available|maintenance|reserved",
  "notes": "string (optional)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Unit updated successfully"
}
```

---

### 4.8 Generate QR Code (Staff/Admin)
**Endpoint**: `POST /inventory/items/:itemId/generate-qr`

**Description**: Generate and store QR code for inventory item

**Access**: Protected (Staff or Admin)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "QR code generated successfully",
  "data": {
    "qrCodeUrl": "string (image URL)",
    "qrData": "string (encoded QR payload)"
  }
}
```

---

### 4.9 Get Inventory Statistics
**Endpoint**: `GET /inventory/statistics`

**Description**: Fetch inventory analytics and reports

**Access**: Protected (Staff or Admin)

**Query Parameters**:
- `fromDate` (optional): ISO8601
- `toDate` (optional): ISO8601

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalItems": "number",
    "totalUnits": "number",
    "availableUnits": "number",
    "borrowedUnits": "number",
    "damagedUnits": "number",
    "categoryBreakdown": {
      "categoryName": "number (count)"
    },
    "conditionBreakdown": {
      "good": "number",
      "fair": "number",
      "damaged": "number"
    },
    "mostBorrowedItems": [
      {
        "itemId": "uuid",
        "name": "string",
        "borrowCount": "number"
      }
    ]
  }
}
```

---

## 5. Performance Scheduling Endpoints

### 5.1 Get All Performances
**Endpoint**: `GET /performance`

**Description**: Fetch performance schedules

**Access**: Protected (All authenticated users for read; Staff/Admin for management)

**Query Parameters**:
- `status` (optional): scheduled|completed|cancelled
- `fromDate` (optional): ISO8601
- `toDate` (optional): ISO8601
- `page` (optional): pagination

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "performanceDate": "ISO8601",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "location": "string",
      "performers": ["performer1", "performer2"],
      "borrowedItems": ["item1", "item2"],
      "createdBy": "uuid (staff member)",
      "status": "scheduled|completed|cancelled",
      "createdAt": "ISO8601"
    }
  ],
  "pagination": {}
}
```

---

### 5.2 Get Single Performance
**Endpoint**: `GET /performance/:performanceId`

**Description**: Fetch detailed performance information

**Access**: Protected (All authenticated users)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "performanceDate": "ISO8601",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "location": "string",
    "performers": [
      {
        "performerId": "uuid",
        "name": "string",
        "role": "string",
        "division": "string"
      }
    ],
    "borrowedItems": [
      {
        "itemId": "uuid",
        "name": "string",
        "quantity": "number",
        "requestStatus": "requested|approved|returned"
      }
    ],
    "notes": "string or null",
    "createdBy": "uuid",
    "approvedBy": "uuid or null",
    "status": "scheduled|completed|cancelled"
  }
}
```

---

### 5.3 Create Performance (Staff/Admin)
**Endpoint**: `POST /performance`

**Description**: Create new performance schedule

**Access**: Protected (Staff or Admin)

**Request Body**:
```json
{
  "title": "string (required)",
  "description": "string",
  "performanceDate": "ISO8601 (required)",
  "startTime": "HH:MM (required)",
  "endTime": "HH:MM (required)",
  "location": "string (required)",
  "performerIds": ["uuid", "uuid"], // Array of performer user IDs
  "borrowedItemIds": ["uuid", "uuid"], // Array of inventory item IDs needed
  "notes": "string (optional)"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Performance created successfully",
  "data": { /* performance object */ }
}
```

---

### 5.4 Update Performance (Staff/Admin)
**Endpoint**: `PUT /performance/:performanceId`

**Description**: Update performance details

**Access**: Protected (Staff or Admin who created, or Admin)

**Request Body**:
```json
{
  "title": "string (optional)",
  "description": "string (optional)",
  "performanceDate": "ISO8601 (optional)",
  "startTime": "HH:MM (optional)",
  "endTime": "HH:MM (optional)",
  "location": "string (optional)",
  "status": "scheduled|completed|cancelled (optional)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Performance updated successfully"
}
```

---

### 5.5 Add Performers to Performance
**Endpoint**: `POST /performance/:performanceId/performers`

**Description**: Add performers to existing performance

**Access**: Protected (Staff or Admin)

**Request Body**:
```json
{
  "performerIds": ["uuid", "uuid"]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Performers added successfully"
}
```

---

### 5.6 Remove Performer from Performance
**Endpoint**: `DELETE /performance/:performanceId/performers/:performerId`

**Description**: Remove performer from performance

**Access**: Protected (Staff or Admin)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Performer removed successfully"
}
```

---

### 5.7 Get Performance Recommendations
**Endpoint**: `GET /performance/recommendations`

**Description**: Get recommended items for a performance based on past borrowing patterns

**Access**: Protected (Staff or Admin)

**Query Parameters**:
- `performanceType` (optional): String
- `limit` (optional): Number of recommendations (default: 5)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "itemId": "uuid",
      "name": "string",
      "category": "string",
      "frequency": "number (how often borrowed for performances)",
      "averageQuantity": "number",
      "confidence": "number (0-1, recommendation strength)"
    }
  ]
}
```

---

## 6. Master List Endpoints

### 6.1 Get Master List Items (Units)
**Endpoint**: `GET /masterList/units`

**Description**: Fetch configurable unit types (e.g., pcs, sets, bundles)

**Access**: Protected (Staff for read; Admin for management)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "abbreviation": "string",
      "description": "string",
      "createdAt": "ISO8601"
    }
  ]
}
```

---

### 6.2 Create Master List Unit (Admin)
**Endpoint**: `POST /masterList/units`

**Description**: Add new unit type to master list

**Access**: Protected (Admin only)

**Request Body**:
```json
{
  "name": "string (e.g., 'Piece', 'Set')",
  "abbreviation": "string (e.g., 'pcs', 'set')",
  "description": "string"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Unit created successfully",
  "data": {}
}
```

---

### 6.3 Get Master List Positions
**Endpoint**: `GET /masterList/positions`

**Description**: Fetch configurable position/role types (for performers)

**Access**: Protected (Staff for read; Admin for management)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "createdAt": "ISO8601"
    }
  ]
}
```

---

### 6.4 Create Master List Position (Admin)
**Endpoint**: `POST /masterList/positions`

**Description**: Add new position/role type

**Access**: Protected (Admin only)

**Request Body**:
```json
{
  "name": "string (e.g., 'Lead Performer', 'Backup')",
  "description": "string"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Position created successfully"
}
```

---

### 6.5 Get Master List Terms
**Endpoint**: `GET /masterList/terms`

**Description**: Fetch configurable borrowing terms/duration options

**Access**: Protected (Staff for read; Admin for management)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string (e.g., '1 Day', '1 Week')",
      "days": "number",
      "description": "string",
      "createdAt": "ISO8601"
    }
  ]
}
```

---

### 6.6 Create Master List Term (Admin)
**Endpoint**: `POST /masterList/terms`

**Description**: Add new borrowing term/duration option

**Access**: Protected (Admin only)

**Request Body**:
```json
{
  "name": "string",
  "days": "number (duration in days)",
  "description": "string"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Term created successfully"
}
```

---

### 6.7 Get Slideshow Images
**Endpoint**: `GET /masterList/slideshow`

**Description**: Fetch images for dashboard slideshow

**Access**: Protected (All authenticated users for read; Admin for management)

**Query Parameters**:
- `page` (optional): pagination
- `limit` (optional): images per page

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "imageUrl": "string",
      "altText": "string",
      "order": "number",
      "isActive": boolean,
      "uploadedAt": "ISO8601"
    }
  ],
  "pagination": {}
}
```

---

### 6.8 Upload Slideshow Image (Admin)
**Endpoint**: `POST /masterList/slideshow`

**Description**: Upload new slideshow image

**Access**: Protected (Admin only)

**Request Headers**:
```
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>
```

**Request Fields**:
```
image: File (required, max 10MB)
altText: string (optional)
order: number (optional)
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "id": "uuid",
    "imageUrl": "string"
  }
}
```

---

### 6.9 Delete Slideshow Image (Admin)
**Endpoint**: `DELETE /masterList/slideshow/:imageId`

**Description**: Remove slideshow image

**Access**: Protected (Admin only)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

---

## 7. Reporting & Analytics Endpoints

### 7.1 Get Borrowing Statistics
**Endpoint**: `GET /report/borrowing-stats`

**Description**: Fetch borrowing analytics

**Access**: Protected (Staff or Admin)

**Query Parameters**:
- `fromDate` (optional): ISO8601
- `toDate` (optional): ISO8601
- `userId` (optional): Filter by specific borrower

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalRequests": "number",
    "approvedRequests": "number",
    "rejectedRequests": "number",
    "pendingRequests": "number",
    "averageApprovalTime": "number (hours)",
    "completionRate": "number (percent)",
    "topBorrowers": [
      {
        "userId": "uuid",
        "userName": "string",
        "requestCount": "number"
      }
    ],
    "topItems": [
      {
        "itemId": "uuid",
        "itemName": "string",
        "borrowCount": "number"
      }
    ]
  }
}
```

---

### 7.2 Get Monthly Report
**Endpoint**: `GET /report/monthly`

**Description**: Fetch monthly borrowing report

**Access**: Protected (Admin)

**Query Parameters**:
- `month`: number (1-12)
- `year`: number

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "period": "string (e.g., 'January 2024')",
    "totalBorrowRequests": "number",
    "totalReturnedItems": "number",
    "averageBorrowDuration": "number (days)",
    "itemConditionReport": {
      "good": "number",
      "fair": "number",
      "damaged": "number"
    },
    "departmentMetrics": {
      "departmentName": {
        "requestCount": "number",
        "itemCount": "number",
        "damageRate": "number (percent)"
      }
    }
  }
}
```

---

### 7.3 Get Inventory Report
**Endpoint**: `GET /report/inventory`

**Description**: Fetch comprehensive inventory report

**Access**: Protected (Admin or Inventory Manager)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalItems": "number",
    "totalUnits": "number",
    "availableUnits": "number",
    "borrowedUnits": "number",
    "maintenanceUnits": "number",
    "damagedItems": "number",
    "lastUpdated": "ISO8601",
    "categoryReport": {
      "categoryName": {
        "itemCount": "number",
        "unitCount": "number",
        "availableCount": "number"
      }
    }
  }
}
```

---

### 7.4 Get System Health Report
**Endpoint**: `GET /report/system-health`

**Description**: Fetch system performance and health metrics

**Access**: Protected (Admin only)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "uptime": "string (e.g., '45 days 3 hours')",
    "activeUsers": "number",
    "pendingRequests": "number",
    "overdueBorrows": "number",
    "databaseStatus": "healthy|warning|error",
    "fileStorageUsage": "string (e.g., '2.5 GB of 10 GB')",
    "lastMaintenanceDate": "ISO8601",
    "recommendedActions": ["string"]
  }
}
```

---

## 8. Settings & Configuration Endpoints

### 8.1 Get System Settings (Admin)
**Endpoint**: `GET /settings`

**Description**: Fetch system configuration settings

**Access**: Protected (Admin only)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "siteName": "string",
    "siteDescription": "string",
    "maintenanceMode": boolean,
    "inactivityTimeout": "number (seconds)",
    "maxBorrowDuration": "number (days)",
    "emailNotificationsEnabled": boolean,
    "pushNotificationsEnabled": boolean,
    "fileUploadMaxSize": "number (bytes)",
    "qrCodeGenerationEnabled": boolean,
    "imageRecognitionEnabled": boolean
  }
}
```

---

### 8.2 Update System Settings (Admin)
**Endpoint**: `PUT /settings`

**Description**: Update system configuration

**Access**: Protected (Admin only)

**Request Body**:
```json
{
  "siteName": "string (optional)",
  "siteDescription": "string (optional)",
  "maintenanceMode": boolean (optional),
  "inactivityTimeout": "number (optional)",
  "maxBorrowDuration": "number (optional)",
  "emailNotificationsEnabled": boolean (optional),
  "pushNotificationsEnabled": boolean (optional)
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Settings updated successfully"
}
```

---

### 8.3 Get Notification Preferences
**Endpoint**: `GET /settings/notifications`

**Description**: Fetch user's notification preferences

**Access**: Protected (All authenticated users)

**Request Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "emailNotifications": boolean,
    "pushNotifications": boolean,
    "borrowingReminders": boolean,
    "returnReminders": boolean,
    "systemUpdates": boolean
  }
}
```

---

### 8.4 Update Notification Preferences
**Endpoint**: `PUT /settings/notifications`

**Description**: Update user's notification preferences

**Access**: Protected (All authenticated users)

**Request Body**:
```json
{
  "emailNotifications": boolean,
  "pushNotifications": boolean,
  "borrowingReminders": boolean,
  "returnReminders": boolean,
  "systemUpdates": boolean
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Preferences updated successfully"
}
```

---

## 9. Notification Endpoints

### 9.1 Get User Notifications
**Endpoint**: `GET /notifications`

**Description**: Fetch user's notification history

**Access**: Protected (All authenticated users)

**Query Parameters**:
- `read` (optional): true|false (filter by read status)
- `type` (optional): borrowing|system|performance (filter by type)
- `page` (optional): pagination

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "borrowing|system|performance",
      "title": "string",
      "message": "string",
      "isRead": boolean,
      "createdAt": "ISO8601",
      "relatedId": "uuid or null"
    }
  ],
  "pagination": {}
}
```

---

### 9.2 Mark Notification as Read
**Endpoint**: `PUT /notifications/:notificationId/read`

**Description**: Mark single notification as read

**Access**: Protected (Notification owner)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

### 9.3 Mark All Notifications as Read
**Endpoint**: `PUT /notifications/read-all`

**Description**: Mark all notifications as read

**Access**: Protected (Current user)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

### 9.4 Delete Notification
**Endpoint**: `DELETE /notifications/:notificationId`

**Description**: Delete single notification

**Access**: Protected (Notification owner or Admin)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

---

### 9.5 Send Push Notification (Admin)
**Endpoint**: `POST /notifications/push`

**Description**: Send push notification to users

**Access**: Protected (Admin only)

**Request Body**:
```json
{
  "recipientIds": ["uuid"] or "all",
  "title": "string",
  "message": "string",
  "action": "string (optional, e.g., 'action-name')"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification sent to X recipients"
}
```

---

## 10. Image Recognition Endpoints

### 10.1 Scan Item via Image Recognition
**Endpoint**: `POST /image-recognition/scan`

**Description**: Identify inventory item using AI image recognition (TensorFlow.js)

**Access**: Protected (Staff or borrowing context)

**Request Headers**:
```
Content-Type: multipart/form-data
```

**Request Fields**:
```
image: File (required, image file)
threshold: number (optional, 0-1, confidence threshold, default: 0.7)
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "detectedItems": [
      {
        "itemId": "uuid or null (if recognized)",
        "itemName": "string (if recognized)",
        "confidence": "number (0-1)",
        "boundingBox": {
          "x": "number",
          "y": "number",
          "width": "number",
          "height": "number"
        }
      }
    ],
    "overallConfidence": "number (0-1)",
    "processingTime": "number (ms)",
    "suggestedItems": [
      {
        "itemId": "uuid",
        "itemName": "string",
        "similarity": "number (0-1)"
      }
    ]
  }
}
```

**Error Responses**:
- `400 Bad Request`: No image provided or invalid format
- `422 Unprocessable Entity`: Image too small or unrecognizable
- `503 Service Unavailable`: ML service unavailable

---

### 10.2 Get Image Recognition Confidence Threshold
**Endpoint**: `GET /image-recognition/settings`

**Description**: Fetch current AI recognition sensitivity settings

**Access**: Protected (Admin)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "defaultThreshold": "number",
    "minThreshold": "number",
    "maxThreshold": "number",
    "modelVersion": "string",
    "lastTrained": "ISO8601",
    "accuracy": "number (percent)"
  }
}
```

---

### 10.3 Update Recognition Settings (Admin)
**Endpoint**: `PUT /image-recognition/settings`

**Description**: Adjust AI recognition parameters

**Access**: Protected (Admin only)

**Request Body**:
```json
{
  "defaultThreshold": "number (0-1)",
  "minThreshold": "number"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Settings updated successfully"
}
```

---

## 11. Error Codes & Status Reference

### HTTP Status Codes

| Code | Meaning | Context |
|------|---------|---------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful resource creation |
| 204 | No Content | Successful deletion with no response body |
| 400 | Bad Request | Invalid request parameters/body syntax |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Authenticated but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource creation conflict (duplicate, etc) |
| 422 | Unprocessable Entity | Valid format but semantic error (invalid data) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error (contact admin) |
| 503 | Service Unavailable | Service temporarily down |

### Common Error Response Format

```json
{
  "success": false,
  "message": "User-friendly error message",
  "error": {
    "code": "ERROR_CODE",
    "details": "Technical details (optional)",
    "field": "fieldName (optional, for validation errors)"
  }
}
```

### Standard Error Codes

| Code | Meaning | HTTP |
|------|---------|------|
| INVALID_CREDENTIALS | Email or password incorrect | 401 |
| TOKEN_EXPIRED | JWT token expired | 401 |
| TOKEN_INVALID | JWT token invalid/malformed | 401 |
| UNAUTHORIZED_ROLE | User role insufficient for operation | 403 |
| NOT_FOUND | Resource doesn't exist | 404 |
| DUPLICATE_EMAIL | Email already registered | 409 |
| DUPLICATE_USERNAME | Username already taken | 409 |
| VALIDATION_ERROR | Request data validation failed | 422 |
| INSUFFICIENT_INVENTORY | Not enough items available | 422 |
| INVALID_DATE_RANGE | Date range invalid | 422 |
| DUPLICATE_PERFORMANCE | Performance already scheduled for date | 409 |

---

## Authentication & Security

### JWT Token Structure

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJ1c2VySWQiOiJ1dWlkIiwicm9sZSI6ImJvcnJvd2VyIiwiaWF0IjoxNjc2NzY...
[signature]
```

**Token Payload**:
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "borrower|staff|admin",
  "iat": 1676767200,
  "exp": 1676853600 // Expires in 24 hours
}
```

### Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Auth endpoints**: 5 requests per 15 minutes per IP
- **Search endpoints**: 200 requests per 15 minutes per user
- **Admin endpoints**: 50 requests per 15 minutes per user

---

## Request/Response Examples

### Example: Login Request
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "borrower@example.com",
    "password": "SecurePassword123!"
  }'
```

### Example: Create Borrowing Request
```bash
curl -X POST http://localhost:5000/api/borrow/requests \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "inventoryItemId": "550e8400-e29b-41d4-a716-446655440000",
        "quantity": 3
      }
    ],
    "borrowDate": "2024-01-15T09:00:00Z",
    "dueDate": "2024-01-20T09:00:00Z",
    "notes": "For upcoming performance"
  }'
```

### Example: Get Inventory Items
```bash
curl -X GET "http://localhost:5000/api/inventory/items?category=Instruments&available=true&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

## Additional Notes

- All timestamps are in ISO 8601 format with UTC timezone
- All IDs are UUIDs (v4) unless otherwise specified
- File uploads must respect MIME type validation and size limits
- Pagination defaults: page=1, limit=10
- Sorting: Default order is descending by date
- Sensitive data (passwords, tokens) are never returned in responses

---

**Last Updated**: January 2024
**API Version**: 1.0
**Documentation Version**: 1.0
