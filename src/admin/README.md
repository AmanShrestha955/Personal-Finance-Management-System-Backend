# Admin Module Documentation

## Overview

The admin module provides backend functionality for the admin dashboard and admin authentication system.

## Files in Admin Module

### 1. **adminModels.js**

Defines the Admin schema with the following fields:

- `name`: Admin's full name
- `email`: Admin's email (unique)
- `password`: Hashed password
- `role`: Admin role (superadmin, admin, moderator)
- `status`: Account status (active, inactive, suspended)
- `permissions`: Array of permissions
- `lastLogin`: Timestamp of last login
- `loginAttempts`: Number of failed login attempts
- `isLocked`: Account lock status
- `lockedUntil`: When the account lock expires
- `createdBy`: Reference to the admin who created this admin account
- `timestamps`: Auto-generated createdAt and updatedAt

### 2. **adminController.js**

Contains all business logic for admin operations:

#### Authentication

- `adminLogin`: Authenticates admin user and returns JWT token
  - Validates email and password
  - Implements account locking after 5 failed attempts
  - Updates last login timestamp
  - Checks admin account status

#### Dashboard & Statistics

- `getDashboardStats`: Retrieves comprehensive dashboard statistics
  - Total users, active users, families, transactions, budgets
  - User growth data for last 6 months
  - Recent transactions
  - Transaction statistics by category

#### User Management

- `getAllUsers`: Retrieve paginated list of users with search
- `getUserDetails`: Get detailed information about a specific user
- `suspendUser`: Suspend a user account with reason
- `unsuspendUser`: Reactivate a suspended user

#### Transaction Management

- `getAllTransactions`: Retrieve all transactions with filters (userId, type, date range)

#### Family Management

- `getAllFamilies`: Get all families with pagination and search

### 3. **adminRoute.js**

Defines all admin API routes:

#### Public Routes

- `POST /auth/admin-login` - Admin authentication

#### Protected Routes (Requires Authentication Middleware)

- `GET /auth/dashboard/stats` - Get dashboard statistics
- `GET /auth/users` - Get all users (paginated)
- `GET /auth/users/:userId` - Get specific user details
- `PUT /auth/users/:userId/suspend` - Suspend user
- `PUT /auth/users/:userId/unsuspend` - Unsuspend user
- `GET /auth/transactions` - Get all transactions
- `GET /auth/families` - Get all families

## Integration with Main App

The admin router is integrated in `src/app.js`:

```javascript
const adminRouter = require("./admin/adminRoute.js");
app.use("/api/auth", adminRouter);
```

## Database Models Used

The admin module interacts with the following models:

- **Admin**: Admin user accounts
- **User**: Regular user accounts
- **Family**: Family groups
- **Transaction**: Financial transactions
- **Budget**: User budgets

## Security Features

1. **Password Hashing**: Uses bcrypt for password encryption
2. **JWT Authentication**: Token-based authentication for protected routes
3. **Account Locking**: Automatic account lock after 5 failed login attempts (30 minutes)
4. **Role-Based Access**: Different admin roles (superadmin, admin, moderator)
5. **Permission System**: Granular permission control
6. **Status Verification**: Checks if admin account is active before login
7. **Login Tracking**: Records last login time and login attempts

## Frontend Integration

The admin module works with the following frontend pages:

- `/admin-sign-in` - Admin login page
- `/admin` - Admin dashboard
- `/admin/users` - User management
- `/admin/transactions` - Transaction monitoring
- `/admin/families` - Family management

## Usage Examples

### Admin Login

```
POST /api/auth/admin-login
Body: {
  "email": "admin@example.com",
  "password": "password123"
}
Response: {
  "token": "jwt_token",
  "message": "Admin login successful",
  "admin": { "id", "name", "email", "role" }
}
```

### Get Dashboard Stats

```
GET /api/auth/dashboard/stats
Headers: { "Authorization": "Bearer jwt_token" }
Response: {
  "stats": { totalUsers, activeUsers, totalFamilies, totalTransactions, totalBudgets },
  "userGrowthData": [...],
  "recentTransactions": [...],
  "transactionByCategory": [...]
}
```

### Get All Users

```
GET /api/auth/users?page=1&limit=10&search=john
Headers: { "Authorization": "Bearer jwt_token" }
```

## Next Steps

1. **Create Admin Seed Script**: Add initial admin user creation script
2. **Create Admin Middleware**: Add middleware to verify admin role and permissions
3. **Add Logging**: Implement audit logging for admin actions
4. **Add Rate Limiting**: Implement rate limiting for login endpoint
5. **Create Additional Admin Pages**:
   - Reports and analytics
   - System settings
   - Admin management
   - Audit logs
   - Notifications management

## Models Update

The User model should include the following fields if not already present:

- `isSuspended`: Boolean to track if user is suspended
- `suspensionReason`: Reason for suspension
- `suspendedAt`: When user was suspended
- `lastLogin`: Last login timestamp

The Family model should include:

- `owner`: Reference to User model
- `members`: Array of User references
- `name`: Family name

These fields are used in the admin controller for filtering and retrieving data.
