import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// load environment variables from parent .env if not already
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let bookingContract = null;

async function initBlockchain() {
  const providerUrl = process.env.ETH_PROVIDER_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.BOOKING_CONTRACT_ADDRESS;

  if (!providerUrl || !privateKey || !contractAddress) {
    console.warn('Blockchain configuration missing; skipping on-chain calls');
    return;
  }

  console.log('Initializing blockchain', { providerUrl, contractAddress });
  const provider = new ethers.providers.JsonRpcProvider(providerUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  const artifactFsPath = path.resolve(__dirname, '../blockchain/artifacts/contracts/Booking.sol/BookingContract.json');
  try {
    // read JSON directly since import assertions would be needed otherwise
    const json = JSON.parse(await fs.promises.readFile(artifactFsPath, 'utf-8'));
    const abi = json.abi || (json.default && json.default.abi);
    bookingContract = new ethers.Contract(contractAddress, abi, signer);
  } catch (err) {
    console.error('Unable to load ABI at', artifactFsPath, err);
  }
}

export async function recordBookingOnChain({ guestName, roomName, checkIn, checkOut, total }) {
  if (!bookingContract) {
    // attempt to initialize lazily in case env vars were added after start
    await initBlockchain();
  }
  if (!bookingContract) {
    console.warn('recordBookingOnChain called but bookingContract is not configured');
    return null;
  }

  const checkInTs = Math.floor(new Date(checkIn).getTime() / 1000);
  const checkOutTs = Math.floor(new Date(checkOut).getTime() / 1000);
  try {
    console.log('Sending transaction on chain');
    const tx = await bookingContract.createBooking(guestName, roomName, checkInTs, checkOutTs, total);
    console.log('Transaction sent, waiting for receipt');
    const receipt = await tx.wait();
    console.log('Transaction mined', receipt.transactionHash);
    return receipt.transactionHash;
  } catch (err) {
    console.error('Blockchain booking error:', err);
    return null;
  }
}

// perform initial initialization, log errors if they occur
initBlockchain().catch((e) => console.error('Blockchain init failed', e));
