# Threat model

A short threat model for the Aurora Hotel Reservation app: data flow, trust boundaries, and mitigations aligned with STRIDE and OWASP Top 10 where relevant.

## 1. High-level data flow

```
[User Browser]
    | HTTPS (in production)
    v
[Frontend - React]
    | REST (JSON), Bearer JWT
    v
[Backend - Express]
    | Mongoose
    v
[MongoDB]
    |
    v (password reset)
[SMTP / Email]
```

**Trust boundaries:**

- Browser ↔ Frontend: user input (credentials, forms).
- Frontend ↔ Backend: API over network; backend trusts valid JWT.
- Backend ↔ MongoDB: backend is the only client; DB creds in env.
- Backend ↔ Email: outbound only; email content may include OTP.

## 2. STRIDE overview

| Threat | Mitigation |
|--------|------------|
| **S**poofing | Strong password policy, bcrypt, no credential stuffing (rate limit). JWT proves identity; refresh token rotation reduces token theft impact. |
| **T**ampering | Input validation (express-validator, password policy). Mongoose prevents injection. HTTPS in production. |
| **R**epudiation | Generic login errors (no “user exists” leak). No full audit log yet; can add auth-event logging. |
| **I**nformation disclosure | Passwords never logged or returned. .env not in repo. Generic error messages to client. |
| **D**enial of service | Rate limiting (global + auth). Body size limit. DB connection handling (retry in db.js). |
| **E**levation of privilege | Single user role; no admin path in this app. Protected routes require valid JWT only. |

## 3. OWASP Top 10 (mapping)

| Risk | How we address it |
|------|-------------------|
| A01 Broken Access Control | Protected routes use JWT; no role escalation in current design. |
| A02 Cryptographic Failures | Passwords hashed with bcrypt. TLS for DB and in production for HTTP. |
| A03 Injection | Mongoose ORM; no raw queries. Validated/sanitized input. |
| A04 Insecure Design | Rate limiting, password policy, short-lived tokens + refresh. |
| A05 Security Misconfiguration | Helmet, CORS from env, secrets in env. |
| A06 Vulnerable Components | Keep deps updated; run `npm audit`. |
| A07 Auth and Session Failures | JWT + refresh, secure password policy, generic login errors, logout clears tokens. |
| A08 Software and Data Integrity | No unsigned client-side code loading from untrusted sources; dependencies from npm. |
| A09 Logging and Monitoring Failures | Basic error logging; no PII in logs. Can add structured auth/audit logs. |
| A10 SSRF | No server-side fetch of user-supplied URLs in this app. |

## 4. Data flow diagram (simplified)

```
+----------+     +-------------+     +----------+
|  Browser |---->|   Express    |---->| MongoDB  |
|  (React) |     |   (Node)     |     |          |
+----------+     +-------------+     +----------+
     |                 |                   ^
     |  JWT / JSON     |  Mongoose         |
     |                 |                   |
     |                 v                   |
     |           +----------+              |
     |           |  Email   |  (OTP only)  |
     |           |  (SMTP)  |              |
     +---------->|          |--------------+
                +----------+
```

- User sends credentials or tokens from Browser to Express.
- Express validates input, checks JWT, talks to MongoDB; on forgot-password, sends OTP via email.
- No direct Browser → MongoDB or Browser → Email.

## 5. Assumptions and updates

- **Assumptions:** MongoDB and env are trusted; SMTP is outbound-only; frontend is not modified by an attacker (we still validate on backend).
- **Updates:** Revisit this document when adding file upload, admin roles, payments, or third-party integrations. Update mitigations and run a quick STRIDE/OWASP pass on new features.
