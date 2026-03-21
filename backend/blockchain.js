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
let bookingProvider = null;
let bookingInterface = null;

function utf8Bytes(value) {
  if (typeof ethers.toUtf8Bytes === 'function') return ethers.toUtf8Bytes(value);
  return ethers.utils.toUtf8Bytes(value);
}

function keccak256Bytes(value) {
  if (typeof ethers.keccak256 === 'function') return ethers.keccak256(value);
  return ethers.utils.keccak256(value);
}

function solidityPackedKeccak(types, values) {
  if (typeof ethers.solidityPackedKeccak256 === 'function') {
    return ethers.solidityPackedKeccak256(types, values);
  }
  return ethers.utils.solidityKeccak256(types, values);
}

function isValidAddress(value) {
  if (!value) return false;
  if (typeof ethers.isAddress === 'function') {
    return ethers.isAddress(value);
  }
  return Boolean(ethers.utils?.isAddress?.(value));
}

function createProvider(providerUrl) {
  const ProviderCtor = ethers.JsonRpcProvider || ethers.providers?.JsonRpcProvider;
  if (!ProviderCtor) {
    throw new Error('No JsonRpcProvider constructor found on ethers package');
  }
  return new ProviderCtor(providerUrl);
}

function createInterface(abi) {
  const InterfaceCtor = ethers.Interface || ethers.utils?.Interface;
  if (!InterfaceCtor) {
    throw new Error('No Interface constructor found on ethers package');
  }
  return new InterfaceCtor(abi);
}

function getCreateBookingArgCount() {
  try {
    const fn = bookingContract?.interface?.getFunction?.('createBooking');
    return Array.isArray(fn?.inputs) ? fn.inputs.length : null;
  } catch {
    return null;
  }
}

function getAddressFromLatestDeploy() {
  try {
    const latestDeployPath = path.resolve(__dirname, '../blockchain/deploy.latest.json');
    const parsed = JSON.parse(fs.readFileSync(latestDeployPath, 'utf8'));
    if (isValidAddress(parsed?.address)) {
      return parsed.address;
    }
  } catch {
    return null;
  }
  return null;
}

async function initBlockchain() {
  const providerUrl = process.env.ETH_PROVIDER_URL || process.env.GANACHE_URL || process.env.LOCALHOST_URL;
  const privateKey = process.env.PRIVATE_KEY;
  let contractAddress = process.env.BOOKING_CONTRACT_ADDRESS;

  if (!contractAddress || !isValidAddress(contractAddress)) {
    const latestAddress = getAddressFromLatestDeploy();
    if (latestAddress) {
      contractAddress = latestAddress;
      console.log('[Blockchain] Using address from blockchain/deploy.latest.json:', contractAddress);
    }
  }

  if (!providerUrl || !privateKey || !contractAddress) {
    console.warn('[Blockchain] Configuration missing. Set ETH_PROVIDER_URL (or GANACHE_URL), PRIVATE_KEY, and BOOKING_CONTRACT_ADDRESS in .env to record bookings on Ganache.');
    return;
  }

  if (!isValidAddress(contractAddress)) {
    console.warn('[Blockchain] BOOKING_CONTRACT_ADDRESS is not a valid Ethereum address:', contractAddress);
    return;
  }

  console.log('[Blockchain] Initializing:', providerUrl, 'contract:', contractAddress);
  const provider = createProvider(providerUrl);
  bookingProvider = provider;
  const signer = new ethers.Wallet(privateKey, provider);

  if (signer.address && signer.address.toLowerCase() === contractAddress.toLowerCase()) {
    console.warn('[Blockchain] BOOKING_CONTRACT_ADDRESS matches your wallet address. This is usually incorrect; set it to the deployed contract address from blockchain/scripts/deploy.js output.');
  }

  const artifactFsPath = path.resolve(__dirname, '../blockchain/artifacts/contracts/Booking.sol/BookingContract.json');
  try {
    const json = JSON.parse(await fs.promises.readFile(artifactFsPath, 'utf-8'));
    const abi = json.abi || (json.default && json.default.abi);
    bookingInterface = createInterface(abi);
    bookingContract = new ethers.Contract(contractAddress, abi, signer);
    console.log('[Blockchain] Ready. Bookings will be recorded on-chain.');
  } catch (err) {
    console.error('[Blockchain] Failed to load contract ABI at', artifactFsPath, err.message);
  }
}

export function computeBookingFingerprint({ guestName, roomName, checkIn, checkOut, total }) {
  const checkInTs = Math.floor(new Date(checkIn).getTime() / 1000);
  const checkOutTs = Math.floor(new Date(checkOut).getTime() / 1000);
  const normalizedTotal = Number(total);

  const guestNameHash = keccak256Bytes(utf8Bytes(String(guestName || '').trim()));
  const roomNameHash = keccak256Bytes(utf8Bytes(String(roomName || '').trim()));
  const bookingRef = solidityPackedKeccak(
    ['bytes32', 'bytes32', 'uint64', 'uint64', 'uint128'],
    [guestNameHash, roomNameHash, checkInTs, checkOutTs, normalizedTotal]
  );

  return {
    checkInTs,
    checkOutTs,
    total: normalizedTotal,
    guestNameHash,
    roomNameHash,
    bookingRef,
  };
}

export async function verifyBookingFingerprintWithTx(txHash, expectedBookingRef) {
  if (!txHash) {
    return { checked: false, matched: false, reason: 'No txHash provided' };
  }

  if (!bookingProvider || !bookingInterface) {
    await initBlockchain();
  }

  if (!bookingProvider || !bookingInterface) {
    return { checked: false, matched: false, reason: 'Blockchain provider not initialized' };
  }

  try {
    const receipt = await bookingProvider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { checked: false, matched: false, reason: 'Transaction receipt not found' };
    }

    let foundEvent = false;
    let onChainBookingRef = null;

    for (const log of receipt.logs || []) {
      try {
        const parsed = bookingInterface.parseLog(log);
        if (parsed?.name === 'BookingCreated') {
          foundEvent = true;
          onChainBookingRef = String(parsed.args.bookingRef || parsed.args[6] || '').toLowerCase();
          break;
        }
      } catch {
        // Ignore logs from other contracts.
      }
    }

    if (!foundEvent) {
      return { checked: true, matched: false, reason: 'BookingCreated event not found in tx logs' };
    }

    const expected = String(expectedBookingRef || '').toLowerCase();
    const matched = expected !== '' && expected === onChainBookingRef;

    return {
      checked: true,
      matched,
      onChainBookingRef,
      expectedBookingRef: expected,
      txHash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    return {
      checked: false,
      matched: false,
      reason: error?.message || 'Failed to verify transaction receipt',
    };
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

  const fingerprint = computeBookingFingerprint({ guestName, roomName, checkIn, checkOut, total });
  const createBookingArgCount = getCreateBookingArgCount();

  try {
    console.log('[Blockchain] Sending createBooking tx...');
    let tx;

    if (createBookingArgCount === 5) {
      // Legacy contract signature: createBooking(string,string,uint256,uint256,uint256)
      tx = await bookingContract.createBooking(
        String(guestName || '').trim(),
        String(roomName || '').trim(),
        fingerprint.checkInTs,
        fingerprint.checkOutTs,
        fingerprint.total
      );
    } else {
      // Optimized signature: createBooking(bytes32,bytes32,uint64,uint64,uint128,bytes32)
      tx = await bookingContract.createBooking(
        fingerprint.guestNameHash,
        fingerprint.roomNameHash,
        fingerprint.checkInTs,
        fingerprint.checkOutTs,
        fingerprint.total,
        fingerprint.bookingRef
      );
    }

    console.log('[Blockchain] Tx sent, hash:', tx.hash);
    const receipt = await tx.wait();
    const minedHash = receipt?.hash || receipt?.transactionHash || tx.hash || null;
    console.log('[Blockchain] Mined, txHash:', minedHash);
    return minedHash;
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
