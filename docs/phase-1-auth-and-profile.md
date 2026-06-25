# Phase 1 — Auth Hardening & User Profile

> **Status:** ✅ Complete  
> **Date:** 2026-06-19

---

## What Was Done

| # | Task | File Created / Modified |
|---|------|------------------------|
| 1.1 | Auth middleware — protects routes by verifying JWT | `src/middleware/auth.middleware.js` ✨ NEW |
| 1.2 | Role middleware — restricts routes by user role | `src/middleware/role.middleware.js` ✨ NEW |
| 1.3 | Logout endpoint | `src/modules/auth/controllers/local-auth.controller.js` ✏️ MODIFIED |
|     | | `src/modules/auth/routes/local-auth.routes.js` ✏️ MODIFIED |
| 1.4 | GET /api/users/profile | `src/modules/users/controllers/user.controller.js` ✨ NEW |
|     | | `src/modules/users/services/user.service.js` ✨ NEW |
|     | | `src/modules/users/routes/user.routes.js` ✨ NEW |
| 1.5 | PUT /api/users/profile | Same files as above |
|     | | `src/modules/users/validators/user.validator.js` ✨ NEW |
| 1.6 | Fixed .gitignore | `backend/.gitignore` ✏️ MODIFIED |
| 1.7 | Swagger schemas for profile | `src/config/swagger.js` ✏️ MODIFIED |
| 1.8 | Registered user routes | `src/app.js` ✏️ MODIFIED |

---

## New Endpoints Added

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/logout` | 🔒 Required | Clears cookies + deletes refresh token from DB |
| GET | `/api/users/profile` | 🔒 Required | Returns the logged-in user's profile |
| PUT | `/api/users/profile` | 🔒 Required | Updates profile fields (name, age, email, phoneNo) |

---

## File-by-File Explanation

### 1. `src/middleware/auth.middleware.js`

**Purpose:** Protects routes — only logged-in users can access them.

**How it works:**
1. Reads the `accessToken` from the HTTP-only cookie (`req.cookies.accessToken`)
2. Calls `verifyAccessToken()` from the existing JWT service to decode and validate the token
3. Uses the decoded `user_id` to fetch the full user document from MongoDB (excluding the password hash via `.select("-password")`)
4. Attaches the user document to `req.user` so any controller downstream can access it
5. If the token is missing, expired, or the user doesn't exist → returns `401`

**Usage in routes:**
```js
import { authenticate } from "../../../middleware/auth.middleware.js";

// Any route that needs login protection:
router.get("/profile", authenticate, getProfile);
```

**Why `req.user` instead of just `req.userId`?**  
By attaching the full user document, controllers don't need to make a separate database query every time they need user info (like role, email, name). This is a common Express pattern.

---

### 2. `src/middleware/role.middleware.js`

**Purpose:** Restricts access to specific roles (e.g., only `admin` can add trains, only `vendor` can add buses).

**How it works:**
- It's a **curried function** — you call `authorize("admin")` and it returns an Express middleware
- The returned middleware checks if `req.user.role` is in the allowed roles list
- If not → returns `403 Forbidden` with a descriptive message showing what roles are required

**Must be used AFTER `authenticate`** because it depends on `req.user` existing.

**Usage in routes:**
```js
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";

// Only admins:
router.post("/trains", authenticate, authorize("admin"), createTrain);

// Vendors or admins:
router.post("/buses", authenticate, authorize("vendor", "admin"), createBus);
```

**HTTP Status Codes:**
- `401` — not logged in at all (from auth middleware)
- `403` — logged in but wrong role (from role middleware)

---

### 3. Logout (added to existing auth module)

**File:** `src/modules/auth/controllers/local-auth.controller.js`

**What was added:** A new `logout` export at the bottom of the file.

**How it works:**
1. Reads the `refreshToken` from the cookie
2. Deletes that token from the `RefreshToken` MongoDB collection (so it can't be reused)
3. Clears both `accessToken` and `refreshToken` cookies using `res.clearCookie()`
4. Returns `{ success: true, message: "Logged out successfully." }`

**Why delete from DB AND clear cookies?**  
- Clearing cookies = client-side session removal (browser forgets the tokens)
- Deleting from DB = server-side session invalidation (even if someone copied the token, it won't work on refresh)

**File:** `src/modules/auth/routes/local-auth.routes.js`

**What was added:**
- Imported the `logout` controller and `authenticate` middleware
- Added `router.post('/logout', authenticate, logout)` with full Swagger JSDoc annotations
- The logout route requires authentication — you must be logged in to log out

---

### 4. User Profile Service

**File:** `src/modules/users/services/user.service.js`

Contains two functions:

#### `getUserProfile(userId)`
- Simple lookup: `User.findById(userId).select("-password")`
- Throws `404` if user not found

#### `updateUserProfile(userId, updateData)`
- Accepts `{ name, age, email, phoneNo }` — all optional
- **Uniqueness checks:** Before updating email or phone, it checks if another user already has that value. If yes → throws `409 Conflict`
- Only updates fields that were actually provided (doesn't null out missing fields)
- Returns the updated user without the password field

**Why not just `User.findByIdAndUpdate()`?**  
Because we need to run uniqueness checks before saving. If we used `findByIdAndUpdate` directly, MongoDB would throw a cryptic `E11000` duplicate key error instead of our friendly `409` message.

---

### 5. User Profile Controller

**File:** `src/modules/users/controllers/user.controller.js`

Two thin controller functions that follow the same pattern as the auth controllers:

- **`getProfile`** — calls `getUserProfile(req.user._id)`, returns the data
- **`updateProfile`** — calls `updateUserProfile(req.user._id, req.body)`, returns the updated data

Both use `try/catch` with `next(error)` to forward errors to the global error handler.

---

### 6. User Validator

**File:** `src/modules/users/validators/user.validator.js`

**Schema:** `updateProfileSchema`

All fields are **optional** — the user can update just one field at a time. But when a field IS provided, it must pass validation:

| Field | Rules |
|-------|-------|
| `name` | String, 2–50 characters |
| `age` | Integer, 1–120 |
| `email` | Valid email format |
| `phoneNo` | Regex `/^\+?[1-9]\d{6,14}$/` (same pattern as auth validators) |

---

### 7. User Routes

**File:** `src/modules/users/routes/user.routes.js`

| Route | Middleware Chain |
|-------|-----------------|
| `GET /api/users/profile` | `authenticate` → `getProfile` |
| `PUT /api/users/profile` | `authenticate` → `validate(updateProfileSchema)` → `updateProfile` |

Both routes have full Swagger JSDoc annotations and reference the new schemas added to `swagger.js`.

---

### 8. Updated `app.js`

Added one import and one line:
```js
import userRouter from "./modules/users/routes/user.routes.js";
// ...
app.use("/api/users", userRouter);
```

---

### 9. Updated `swagger.js`

Added two new schemas to the `components.schemas` section:

- **`UpdateProfileRequest`** — describes the body for `PUT /api/users/profile`
- **`UserProfileResponse`** — describes the response shape with all user fields

---

### 10. Fixed `.gitignore`

Before: only `.env` was listed.  
After: added `node_modules` so the `node_modules/` directory is not tracked by git.

---

## Request Flow Diagram

```
Client Request (with accessToken cookie)
    │
    ▼
┌──────────────────────┐
│   authenticate()     │  ← Reads cookie, verifies JWT, loads user
│   middleware          │     Sets req.user = { _id, name, role, ... }
└──────────┬───────────┘
           │ (req.user now available)
           ▼
┌──────────────────────┐
│   authorize("admin") │  ← (Optional) Checks req.user.role
│   middleware          │     Returns 403 if wrong role
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   validate(schema)   │  ← (Optional) Validates req.body with Zod
│   middleware          │     Returns 400 if invalid
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Controller         │  ← Handles the request
│   (getProfile, etc.) │     Calls service layer
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│   Service Layer      │  ← Business logic + DB operations
│   (user.service.js)  │
└──────────────────────┘
```

---

## How to Test

After starting the server (`npm run dev`), test the new endpoints:

### 1. Register/Login first (to get cookies)
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "MyP@ssw0rd"}' \
  -c cookies.txt
```

### 2. Get profile
```bash
curl http://localhost:3000/api/users/profile \
  -b cookies.txt
```

### 3. Update profile
```bash
curl -X PUT http://localhost:3000/api/users/profile \
  -H "Content-Type: application/json" \
  -d '{"name": "Santhosh", "age": 25}' \
  -b cookies.txt
```

### 4. Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt -c cookies.txt
```

### 5. Verify logout worked (should return 401)
```bash
curl http://localhost:3000/api/users/profile \
  -b cookies.txt
```

Or use **Swagger UI** at `http://localhost:3000/api-docs` to test visually.
