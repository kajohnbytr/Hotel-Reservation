# API reference

Base URL (development): `http://localhost:5000`

All JSON request/response. Auth endpoints are rate-limited (see [SECURITY.md](../SECURITY.md)).

---

## Authentication

### POST `/api/users/register`

Create a new user.

**Request body:**

```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string (valid email)",
  "password": "string (min 8 chars, upper, lower, number, special)"
}
```

**Success (201):**

```json
{
  "_id": "ObjectId",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "token": "JWT access token",
  "refreshToken": "JWT refresh token",
  "expiresIn": 3600
}
```

**Errors:** 400 (validation / user exists), 500 (server error).

---

### POST `/api/users/login`

Log in with email and password.

**Request body:**

```json
{
  "email": "string",
  "password": "string"
}
```

**Success (200):** Same shape as register (includes `token`, `refreshToken`, `expiresIn`).

**Errors:** 400 (validation), 401 (invalid credentials), 429 (rate limit), 500.

---

### POST `/api/users/refresh`

Issue a new access token using a valid refresh token. Use when the access token expires (e.g. after 1 hour).

**Request:** Either

- Body: `{ "refreshToken": "JWT refresh token" }`, or  
- Header: `Authorization: Bearer <refresh token>`

**Success (200):**

```json
{
  "token": "new JWT access token",
  "expiresIn": 3600
}
```

**Errors:** 401 (missing/invalid refresh token).

---

### GET `/api/users/me`

Return the current user (requires valid access token).

**Headers:** `Authorization: Bearer <access token>`

**Success (200):**

```json
{
  "_id": "ObjectId",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

**Errors:** 401 (no token / invalid token).

---

### POST `/api/users/forgot-password`

Send a one-time code (OTP) to the user’s email for password reset.

**Request body:**

```json
{
  "email": "string (valid email)"
}
```

**Success (200):**

```json
{
  "message": "OTP sent to your email",
  "email": "string"
}
```

**Errors:** 404 (no account), 429 (rate limit), 500 (e.g. email send failure).

---

### POST `/api/users/reset-password`

Reset password using email + OTP + new password.

**Request body:**

```json
{
  "email": "string",
  "otp": "string (6-digit code from email)",
  "newPassword": "string (same policy as register)"
}
```

**Success (200):**

```json
{
  "message": "Password reset successful"
}
```

**Errors:** 400 (invalid/expired OTP or validation), 429 (rate limit), 500.

---

## AI (proxy to Python services)

These routes proxy to the ML (5001) and NLP (5002) Python services. If those services are not running, the backend returns 502.

### POST `/api/ai/predict`

Room recommendation from guests/nights/budget. Body: `{ "guests": number, "nights": number, "price": number }`. Returns `{ "room", "predicted_rating", "message" }`.

### POST `/api/ai/chat`

Chatbot reply. Body: `{ "message": "string" }`. Returns `{ "reply": "string" }`.

---

## Rate limits

- **Global:** 200 requests per 15 minutes per IP.
- **Auth routes** (register, login, forgot-password, reset-password): 10 requests per 15 minutes per IP.

When exceeded, responses are **429** with body `{ "message": "Too many requests..." }`.

---

## Token expiry

- **Access token:** 1 hour. Use for `Authorization: Bearer <token>` on protected routes.
- **Refresh token:** 7 days. Use with `POST /api/users/refresh` to get a new access token without re-login.
