import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { toast } from 'sonner';

interface Web3ContextType {
  account: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  contract: ethers.Contract | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  recordBookingOnChain: (guestName: string, roomName: string, checkIn: string, checkOut: string, total: number) => Promise<string | null>;
  switchToGanache: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

const BOOKING_CONTRACT_ABI = [
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

const GANACHE_CHAIN_ID = 5777;
const GANACHE_RPC_URL = 'http://127.0.0.1:7545';

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  // Check if wallet is already connected
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
            initializeProvider(accounts[0]);
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error);
        }
      }
    };

    checkConnection();
  }, []);

  const initializeProvider = async (selectedAccount: string) => {
    if (!window.ethereum) return;

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const selectedSigner = await browserProvider.getSigner();
      setProvider(browserProvider);
      setSigner(selectedSigner);

      // Get contract address from localStorage or use default
      const contractAddress = localStorage.getItem('bookingContractAddress');
      if (contractAddress) {
        const bookingContract = new ethers.Contract(
          contractAddress,
          BOOKING_CONTRACT_ABI,
          selectedSigner
        );
        setContract(bookingContract);
      }
    } catch (error) {
      console.error('Error initializing provider:', error);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error('MetaMask is not installed. Please install MetaMask to proceed.');
      return;
    }

    try {
      setIsConnecting(true);
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        await initializeProvider(accounts[0]);
        toast.success(`Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      }
    } catch (error: any) {
      if (error.code !== 4001) {
        toast.error('Failed to connect wallet');
        console.error('Connection error:', error);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setIsConnected(false);
    setProvider(null);
    setSigner(null);
    setContract(null);
    toast.info('Wallet disconnected');
  };

  const switchToGanache = async () => {
    if (!window.ethereum) {
      toast.error('MetaMask is not installed');
      return;
    }

    try {
      // Try to switch to Ganache (chainId 5777)
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ethers.toBeHex(GANACHE_CHAIN_ID) }],
      });
    } catch (switchError: any) {
      // If the chain doesn't exist, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: ethers.toBeHex(GANACHE_CHAIN_ID),
                chainName: 'Ganache',
                rpcUrls: [GANACHE_RPC_URL],
                nativeCurrency: {
                  name: 'Ether',
                  symbol: 'ETH',
                  decimals: 18,
                },
              },
            ],
          });
          toast.success('Ganache network added');
        } catch (addError) {
          toast.error('Failed to add Ganache network');
          console.error('Error adding network:', addError);
        }
      } else {
        toast.error('Failed to switch network');
        console.error('Error switching network:', switchError);
      }
    }
  };

  const recordBookingOnChain = async (
    guestName: string,
    roomName: string,
    checkIn: string,
    checkOut: string,
    total: number
  ): Promise<string | null> => {
    if (!contract || !signer) {
      toast.error('Wallet not connected or contract not initialized');
      return null;
    }

    try {
      const checkInTs = Math.floor(new Date(checkIn).getTime() / 1000);
      const checkOutTs = Math.floor(new Date(checkOut).getTime() / 1000);

      toast.loading('Recording booking on blockchain...');

      const tx = await contract.createBooking(guestName, roomName, checkInTs, checkOutTs, total);
      // wait for the tx to be broadcast (0 confirmations) so the UI resumes immediately
      const receipt = await tx.wait(0);

      toast.dismiss();
      toast.success('Booking broadcast; hash: ' + receipt.hash);
      return receipt.hash;
    } catch (error: any) {
      console.error('Error recording booking:', error);
      toast.error('Failed to record booking on blockchain: ' + error.message);
      return null;
    }
  };

  const value: Web3ContextType = {
    account,
    isConnected,
    isConnecting,
    provider,
    signer,
    contract,
    connectWallet,
    disconnectWallet,
    recordBookingOnChain,
    switchToGanache,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within Web3Provider');
  }
  return context;
}
