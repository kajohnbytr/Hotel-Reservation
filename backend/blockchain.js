import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env so ETH_PROVIDER_URL, PRIVATE_KEY, BOOKING_CONTRACT_ADDRESS are set when this module loads
dotenv.config({ path: path.resolve(__dirname, '.env') });

let bookingContract = null;

async function initBlockchain() {
  const providerUrl = process.env.ETH_PROVIDER_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.BOOKING_CONTRACT_ADDRESS;

  if (!providerUrl || !privateKey || !contractAddress) {
    console.warn('[Blockchain] Configuration missing. Set ETH_PROVIDER_URL, PRIVATE_KEY, and BOOKING_CONTRACT_ADDRESS in .env to record bookings on Ganache.');
    return;
  }

  console.log('[Blockchain] Initializing:', providerUrl, 'contract:', contractAddress);
  const provider = new ethers.providers.JsonRpcProvider(providerUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  const artifactFsPath = path.resolve(__dirname, '../blockchain/artifacts/contracts/Booking.sol/BookingContract.json');
  try {
    const json = JSON.parse(await fs.promises.readFile(artifactFsPath, 'utf-8'));
    const abi = json.abi || (json.default && json.default.abi);
    bookingContract = new ethers.Contract(contractAddress, abi, signer);
    console.log('[Blockchain] Ready. Bookings will be recorded on-chain.');
  } catch (err) {
    console.error('[Blockchain] Failed to load contract ABI at', artifactFsPath, err.message);
  }
}

export async function recordBookingOnChain({ guestName, roomName, checkIn, checkOut, total }) {
  if (!bookingContract) {
    // attempt to initialize lazily in case env vars were added after start
    await initBlockchain();
  }
  if (!bookingContract) {
    console.warn('[Blockchain] recordBookingOnChain skipped: contract not configured (check .env and restart server).');
    return null;
  }

  const checkInTs = Math.floor(new Date(checkIn).getTime() / 1000);
  const checkOutTs = Math.floor(new Date(checkOut).getTime() / 1000);
  try {
    console.log('[Blockchain] Sending createBooking tx...');
    const tx = await bookingContract.createBooking(guestName, roomName, checkInTs, checkOutTs, total);
    console.log('[Blockchain] Tx sent, hash:', tx.hash);
    const receipt = await tx.wait();
    console.log('[Blockchain] Mined, txHash:', receipt.transactionHash);
    return receipt.transactionHash;
  } catch (err) {
    console.error('[Blockchain] Error:', err.message || err);
    if (err.message && (err.message.includes('insufficient funds') || err.message.includes('nonce') || err.message.includes('CONNECTION'))) {
      console.error('[Blockchain] Tip: Ensure Ganache is running, PRIVATE_KEY is a funded account, and BOOKING_CONTRACT_ADDRESS is from a deploy on this Ganache.');
    }
    return null;
  }
}

// perform initial initialization, log errors if they occur
initBlockchain().catch((e) => console.error('Blockchain init failed', e));
