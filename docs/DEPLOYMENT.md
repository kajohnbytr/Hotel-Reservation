# Deployment and environment

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 5000). |
| `MONGO_URI` | Yes | MongoDB connection string (e.g. `mongodb://localhost:27017/aurora` or `mongodb+srv://user:pass@cluster.mongodb.net/aurora`). |
| `JWT_SECRET` | Yes | Long, random secret for signing JWTs (e.g. 32+ chars). Generate with `openssl rand -hex 32`. |
| `CORS_ORIGIN` | No | Allowed frontend origin (default: `http://localhost:5173`). In production set to your frontend URL (e.g. `https://yourdomain.com`). |
| `EMAIL_USER` | For reset | SMTP user for sending password-reset emails. |
| `EMAIL_PASS` | For reset | SMTP password or app password. |

Never commit `.env` or put secrets in the repo. Use your platform’s secret/config (e.g. Vercel, Railway, Render env vars).

---

## Same cluster, multiple projects (no extra cost)

If you have **one MongoDB cluster** (e.g. Atlas free tier) and **multiple projects**, you do **not** need a second cluster. Use **different database names** in the connection string. One cluster can hold many databases.

| Project        | MONGO_URI (same host, different database) |
|----------------|------------------------------------------|
| Hotel Reservation (this app) | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/aurora` |
| Other project                | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/myotherproject` |

- **Same** cluster host, username, password.
- **Different** path after the host: `/aurora` vs `/myotherproject` — that path is the **database name**.
- Data is fully separate: this app’s `users` collection lives in the `aurora` database; the other project’s collections live in its own database.
- No extra charge: multiple databases on one cluster are included.

For this project, keep the database name you use today (e.g. `aurora`). For each other project, set `MONGO_URI` to the same cluster URL but with a different database name (e.g. `myotherproject`).

---

## Production checklist

1. **Secrets:** Set `JWT_SECRET`, `MONGO_URI`, and if used `EMAIL_*` in the host’s environment; do not use defaults from development.
2. **CORS:** Set `CORS_ORIGIN` to the exact frontend URL (e.g. `https://aurora.example.com`).
3. **MongoDB:** Prefer MongoDB Atlas (or similar) with TLS. Restrict IP access if possible.
4. **HTTPS:** Serve frontend and API over HTTPS. Many hosts provide TLS automatically.
5. **Build:** Run `npm run build` for the frontend and serve the `dist/` folder (or deploy to a static host). Run backend with `npm start` (or your process manager).

---

## Deploying backend (examples)

- **Railway / Render / Fly.io:** Connect repo, set env vars, set start command to `node server.js` (or `npm start`) from the `backend` directory (or set root to `backend`).
- **VPS:** Use a process manager (e.g. PM2): `pm2 start server.js --name aurora-api -i 1` inside `backend/`.

---

## Deploying frontend

- **Vite build:** `npm run build` → `dist/`. Serve with Nginx, Apache, or a static host (Vercel, Netlify, etc.).
- **API URL:** Set `VITE_API_URL` at **build time** to your backend URL (e.g. `https://api.yourdomain.com`). The frontend will use it for all API calls.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| **CORS errors in browser** | Backend `CORS_ORIGIN` must match the frontend origin (scheme + host + port). No trailing slash. |
| **401 on /me or after refresh** | Token expired or invalid. Ensure frontend stores and sends `Authorization: Bearer <token>`. Use refresh endpoint when you get 401. |
| **MongoDB connection fails** | Verify `MONGO_URI`, network access (Atlas IP allowlist, VPC), and TLS. Check backend logs. |
| **Password reset email not sent** | Configure `EMAIL_USER` and `EMAIL_PASS`; check SMTP restrictions (e.g. “less secure apps”, app passwords). In dev you can log OTP in server console. |
| **Rate limit (429)** | Wait for the time window to reset or increase limits in code for development (not recommended in production without a good reason). |

---

## Maintenance

- Keep dependencies updated (`npm audit`, `npm update`).
- Rotate `JWT_SECRET` if compromised; users will need to log in again.
- Back up MongoDB according to your provider (Atlas backups, snapshots, etc.).
