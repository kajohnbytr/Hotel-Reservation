import { ethers } from 'ethers';

export const BOOKING_CONTRACT_ABI = [
  {
    inputs: [
      { internalType: 'string', name: 'guestName', type: 'string' },
      { internalType: 'string', name: 'roomName', type: 'string' },
      { internalType: 'uint256', name: 'checkIn', type: 'uint256' },
      { internalType: 'uint256', name: 'checkOut', type: 'uint256' },
      { internalType: 'uint256', name: 'total', type: 'uint256' },
    ],
    name: 'createBooking',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'string', name: 'guestName', type: 'string' },
      { indexed: false, internalType: 'string', name: 'roomName', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'checkIn', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'checkOut', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'total', type: 'uint256' },
    ],
    name: 'BookingCreated',
    type: 'event',
  },
];

export const GANACHE_CHAIN_ID = 5777;
export const GANACHE_RPC_URL = 'http://127.0.0.1:7545';

/**
 * Get a contract instance connected to Ganache
 * @param contractAddress The deployed contract address
 * @param signer The ethers signer (from MetaMask or other provider)
 * @returns Contract instance
 */
export function getBookingContract(contractAddress: string, signer: ethers.Signer) {
  return new ethers.Contract(contractAddress, BOOKING_CONTRACT_ABI, signer);
}

/**
 * Save contract address to localStorage
 * @param address The contract address
 */
export function saveContractAddress(address: string) {
  localStorage.setItem('bookingContractAddress', address);
}

/**
 * Get saved contract address from localStorage
 * @returns The saved contract address or null
 */
export function getSavedContractAddress(): string | null {
  return localStorage.getItem('bookingContractAddress');
}

/**
 * Validate if a string is a valid Ethereum address
 * @param address The address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEthereumAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Format Ethereum address for display
 * @param address Full address
 * @param chars Number of chars to show at start/end
 * @returns Shortened address (e.g., 0x1234...5678)
 */
export function formatAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
