# Security documentation

This document describes the security controls implemented in the Aurora Hotel Reservation project, aligned with common checklist criteria (authentication, input validation, database, documentation).

## 1. Authentication

| Control | Implementation |
|--------|----------------|
| **Password storage** | Passwords hashed with **bcrypt** (salt rounds 10) in `backend/models/user.js`. Never stored in plain text. |
| **Session / tokens** | **JWT** access token (short-lived, 1h) and **refresh token** (7d). Tokens stored client-side; logout clears both. |
| **Login error handling** | Generic message only: "Invalid email or password" (no user enumeration). |
| **Brute force protection** | **Rate limiting** on auth routes: 10 requests per 15 minutes per IP for login, register, forgot/reset password (`backend/routes/auth.js`). |
| **Token validation** | Access token verified on every protected request via `protect` middleware; refresh endpoint re-issues access token using valid refresh token. |
| **Password policy** | **Length + complexity**: min 8 characters, at least one uppercase, one lowercase, one number, one special character. Enforced server-side in `backend/utils/passwordPolicy.js` and `backend/middleware/validate.js` for register and reset-password; frontend hints in `lib/passwordPolicy.ts`. |
| **Logout** | Logout clears access token and refresh token from client storage (`lib/store.ts`). |

## 2. Input validation

| Control | Implementation |
|--------|----------------|
| **Server-side validation** | **express-validator** on all auth endpoints: register, login, forgot-password, reset-password. Email format, required fields, length caps, normalized email. |
| **SQL / NoSQL injection** | **Mongoose ORM** only; no raw queries. **NoSQL sanitization** middleware strips `$` and dotted keys from `req.body` and `req.query` so operator injection (e.g. `{ email: { $gt: "" } }`) is rejected. |
| **XSS** | React escapes output by default. No `dangerouslySetInnerHTML` on user input. |
| **API validation** | Request body validated with express-validator and custom password policy before processing. |
| **CSRF** | API uses **Bearer token in Authorization header** (no cookie-based session for API auth). Same-origin CORS and token reduce CSRF surface; state-changing operations require valid JWT. |

## 3. Database and configuration

| Control | Implementation |
|--------|----------------|
| **Credential storage** | DB and secrets in **environment variables** only (`backend/.env`). `.env` is in `.gitignore`; no secrets in repo. |
| **Connection security** | MongoDB connection uses **TLS** when using `mongodb+srv://` (e.g. Atlas). |

## 4. HTTP and application security

| Control | Implementation |
|--------|----------------|
| **Security headers** | **Helmet** middleware in `backend/server.js` (e.g. X-Content-Type-Options, X-Frame-Options). |
| **Rate limiting** | **express-rate-limit**: global (200 req/15 min per IP) and stricter auth limiter (10 req/15 min per IP for login/register/forgot/reset). |
| **Body size** | `express.json({ limit: '10kb' })` to limit request body size. |

## 5. What we don’t do (and options)

- **MFA/2FA:** Not implemented. Could be added (e.g. TOTP) for admin or all users.
- **Vault:** Secrets are in `.env`; for higher assurance, use a secret manager (e.g. HashiCorp Vault, cloud secrets).
- **Audit logging:** No structured audit log of DB actions; only console error logging. Can be added (e.g. log auth events and failures).
- **Backup:** No backup/restore automation in repo; should be handled by MongoDB Atlas or ops.
- **CSP:** No Content-Security-Policy header; React and static assets. Can be added in production for defense in depth.

## 6. Reporting security issues

If you find a security vulnerability, please report it responsibly (e.g. to the course instructor or repo owner) rather than opening a public issue. Include steps to reproduce and impact.

---

*Last updated to reflect current codebase (auth, validation, rate limiting, password policy, tokens, docs).*
