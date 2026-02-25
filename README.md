# Aurora Hotel Reservation

A full-stack hotel reservation app with a React + Vite frontend and Node.js/Express backend. Users can browse rooms, create an account, log in, and make reservations. Authentication is real (JWT + refresh tokens); bookings are stored in the browser (localStorage) and can be extended to use the backend.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Motion
- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT, bcrypt, nodemailer
- **Security:** Helmet, rate limiting, express-validator, password policy (length + complexity)

## Prerequisites

- Node.js 18+
- npm (or yarn/pnpm)
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- (Optional) SMTP for password-reset emails (e.g. Gmail, SendGrid)
- **Blockchain (optional):** [Node.js](https://nodejs.org), Hardhat, and an Ethereum-compatible node (local ganache/hardhat node or testnet). You'll also need a funded account/private key for contract deployment and an RPC URL.

## Quick start

### 1. Clone and install

```bash
git clone <repo-url>
cd Hotel-Reservation
npm install
cd backend && npm install && cd ..
```

### 2. Backend environment

Create `backend/.env` (see [Deployment & environment](docs/DEPLOYMENT.md)):

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/aurora
JWT_SECRET=<generate-a-long-random-secret>
CORS_ORIGIN=http://localhost:5173
# Optional: for password reset emails
# EMAIL_USER=...
# EMAIL_PASS=...

# Blockchain (optional) - configure if using on-chain recording
# ETH_PROVIDER_URL=http://127.0.0.1:8545         # or Infura/Alchemy RPC
# PRIVATE_KEY=0x...                                # account used to send transactions
# BOOKING_CONTRACT_ADDRESS=0x...                   # deployed contract address
```

### 3. Run

**Terminal 1 – backend**

```bash
cd backend
npm run dev
```

**Terminal 2 – frontend**

```bash
npm run dev
```

- Frontend: http://localhost:5173  
- Backend API: http://localhost:5000  

### 4. (Optional) AI chatbot and room recommendation

### 5. (Optional) Blockchain recording

If you'd like to record reservations on an Ethereum-compatible chain:

1. Install dependencies under `blockchain/`:
   ```bash
   cd blockchain
   npm install
   ```
2. Compile contract:
   ```bash
   npm run compile
   ```
3. Start a local node. You have several options:
   - **Hardhat** (default): `npx hardhat node` will launch a local chain on `http://127.0.0.1:8545`.
   - **Ganache**: either run the desktop app (default port 7545) or use the CLI with `npm run start:ganache` (a mnemonic is included for convenience).
   - **Public testnet/mainnet**: use an RPC URL from Infura/Alchemy and configure a funded account.
4. Deploy the contract and note the address:
   ```bash
   # to localhost/Hardhat
   npm run deploy:local
   # to Ganache
   npm run deploy:ganache
   ```
5. Set environment variables listed earlier (`ETH_PROVIDER_URL`, `PRIVATE_KEY`, `BOOKING_CONTRACT_ADDRESS`) in `backend/.env`.
6. Restart backend; bookings will emit on-chain events and store transaction hash when available.

If blockchain env vars are missing, on-chain calls are skipped and the app functions normally (with frontend hash simulation).


The in-app chatbot and “tell me your budget/guests” recommendation go through the backend. The backend proxies to two Python services. To enable them:

**Prerequisites:** Python 3, and for ML: `pip install flask flask-cors joblib` in `ai/`; for NLP: `pip install flask flask-cors requests` in `ai/`.

**Run order:**

1. **ML service (room recommendation)** – from project root:
   ```bash
   cd ai
   python ai_server.py
   ```
   Runs on port **5001**. Requires `ai/rating_model.pkl`.

2. **NLP chatbot (intents)** – in another terminal, same `ai/` folder:
   ```bash
   cd ai
   python chatbot_nlp.py
   ```
   Runs on port **5002**. Uses `ai/intents.json`.

3. **Backend** (Node) – as in step 3 above. It proxies:
   - `POST /api/ai/predict` → `http://127.0.0.1:5001/predict`
   - `POST /api/ai/chat` → `http://127.0.0.1:5002/chat`

4. **Frontend** – as in step 3 above. Chatbot calls the backend only (`VITE_API_URL`), so no direct Python URLs in the browser.

If the Python services are not running, the chatbot will show “offline” or “recommendation system unavailable” for those features.

### 5. Build for production

```bash
npm run build
cd backend && npm start
# Serve frontend build (e.g. static host or same server)
```

## Project structure

```
Hotel-Reservation/
├── backend/           # Express API
│   ├── config/       # DB connection
│   ├── middleware/   # auth, validation, rate limit (in routes)
│   ├── models/       # Mongoose (User)
│   ├── routes/       # auth, ai (proxy to Python ML/NLP)
│   ├── utils/        # sendEmail, passwordPolicy
│   └── server.js
├── docs/             # API, deployment, threat model
├── pages/             # React pages (Login, Signup, Booking, etc.)
├── components/
├── lib/               # store, passwordPolicy, utils
└── README.md
```

## Features

- **Auth:** Register, login, logout, forgot/reset password (OTP by email)
- **Security:** Password hashing (bcrypt), JWT (short-lived) + refresh token, rate limiting, Helmet, server-side validation, password policy (8+ chars, upper, lower, number, special)
- **UI:** Room list, details, booking flow, dark mode, responsive layout

## Documentation

- [API reference](docs/API.md) – endpoints, request/response shapes
- [Deployment & environment](docs/DEPLOYMENT.md) – env vars, production tips, troubleshooting
- [Security controls](SECURITY.md) – what we implement and how
- [Threat model](docs/THREAT-MODEL.md) – data flow, threats (STRIDE/OWASP), mitigations

## Credentials (development)

- Sign up with any name and email; use a password that meets the policy (8+ chars, upper, lower, number, special).
- For password reset, configure `EMAIL_*` in `backend/.env` or check server logs for the OTP in development.

## License

Private / educational use as applicable.
