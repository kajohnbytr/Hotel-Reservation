# How to Open Ganache (Beginner Guide)

Ganache is a local, fake “blockchain” on your computer so you can test the hotel app’s “record on blockchain” feature without using real money.

---

## Option 1: Ganache Desktop (easiest)

This is the one the app expects by default (port **7545**).

### Step 1: Download

1. Go to **https://trufflesuite.com/ganache/**
2. Click **Download** and choose the version for your OS (Windows / Mac / Linux).
3. Install it like any normal app.

### Step 2: Open and start

1. **Open Ganache** (from Start Menu or Applications).
2. On the first screen, click **“Quick Start”** (or “New Workspace” if you see that).
3. A local blockchain starts. You’ll see:
   - **RPC URL**: `http://127.0.0.1:7545`
   - A list of **10 test accounts** with fake ETH.

### Step 3: You’re done

- Leave Ganache **running** (window can be minimized).
- The **backend** records bookings on-chain when you have the contract deployed and `.env` set (see below).

---

## Why don’t I see transactions in Ganache?

The backend sends a transaction to Ganache **only when all of this is true**:

1. **Ganache is running** on port **7545** (Ganache Desktop default) **before** you start the backend.
2. **The booking contract is deployed to this Ganache session.**  
   Each time you click “Quick Start” in Ganache, you get a **new chain**. Old contract addresses no longer exist. You must deploy again and update `.env`.
3. **`backend/.env`** has the right values:
   - `ETH_PROVIDER_URL=http://127.0.0.1:7545`
   - `BOOKING_CONTRACT_ADDRESS=` the address printed when you deploy (see below)
   - `PRIVATE_KEY=` a private key from one of the 10 accounts shown in Ganache (the first account has ETH; right‑click it → “Copy Private Key”)

### Deploy the contract and get the address

1. **Start Ganache Desktop** and click **Quick Start** (leave it open).
2. In a terminal, from the **project root**:
   ```bash
   cd blockchain
   npm install
   npm run compile
   ```
3. Copy the **PRIVATE_KEY** from Ganache (first account, right‑click → Copy Private Key). Then run deploy **with that key** so the deployer account has ETH:
   ```bash
   # Windows (PowerShell): set env for this session then deploy
   $env:PRIVATE_KEY="0xYourPrivateKeyFromGanacheFirstAccount"
   $env:GANACHE_URL="http://127.0.0.1:7545"
   npx hardhat run scripts/deploy.js --network ganache
   ```
   Or on Mac/Linux:
   ```bash
   PRIVATE_KEY=0xYourPrivateKeyFromGanacheFirstAccount GANACHE_URL=http://127.0.0.1:7545 npx hardhat run scripts/deploy.js --network ganache
   ```
4. The script will print something like: **`BookingContract deployed to: 0x...`**
5. Copy that address into `backend/.env` as **`BOOKING_CONTRACT_ADDRESS=0x...`**
6. In `backend/.env`, set **`PRIVATE_KEY=`** to the **same** private key (first Ganache account) so the backend can send transactions.
7. **Restart the backend** (stop and run `npm run dev` again in the `backend` folder).

After that, when you book a room in the app, the backend will send a transaction to Ganache and you’ll see it under **Transactions** in the Ganache window. If it still doesn’t work, check the **backend terminal** for `[Blockchain]` messages (e.g. “Configuration missing”, “Sending createBooking tx…”, or an error).

---

## Option 2: Ganache from the terminal (CLI)

You can also start Ganache from the project with npm. This runs on port **8545**, not 7545.

1. Open a terminal in the project folder.
2. Run:
   ```bash
   cd blockchain
   npm install
   npm run start:ganache
   ```
3. Ganache will run in that terminal. Leave it open.

**Note:** The hotel app’s **frontend** is configured for Ganache Desktop (port **7545**). If you use this CLI (port 8545), you’d need to either:
- Use the **backend** with `ETH_PROVIDER_URL=http://127.0.0.1:8545` and deploy the contract to this node, or  
- Change the app’s Ganache RPC URL to `http://127.0.0.1:8545` if you want the browser to talk to this node.

For a beginner, **Option 1 (Ganache Desktop)** is simpler and matches the app’s default setup.

---

## Quick checklist (transactions on Ganache)

| Step | What to do |
|------|------------|
| 1 | Install Ganache Desktop, open it, click **Quick Start** (port 7545). |
| 2 | In `blockchain/`: run `npm install`, `npm run compile`, then deploy with the first account’s private key (see “Deploy the contract and get the address” above). |
| 3 | Put the **deployed contract address** in `backend/.env` as `BOOKING_CONTRACT_ADDRESS=0x...`. |
| 4 | Put the **same account’s private key** in `backend/.env` as `PRIVATE_KEY=0x...`, and `ETH_PROVIDER_URL=http://127.0.0.1:7545`. |
| 5 | Restart the backend. Book a room in the app; the transaction should appear in Ganache. |

If you only want to **use the hotel app without blockchain**, you don’t need Ganache at all—just run the backend and frontend as in the main README.
