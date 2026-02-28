# MetaMask & Remix Integration Guide

This guide explains how to deploy the Booking smart contract using Remix IDE and interact with it using MetaMask.

## Prerequisites

1. **MetaMask Extension** - Install from [metamask.io](https://metamask.io)
2. **Ganache Desktop** - Download from [trufflesuite.com/ganache](https://www.trufflesuite.com/ganache)
3. **Remix IDE** - Available at [remix.ethereum.org](https://remix.ethereum.org)
4. **ethers.js** - Already included in this project

## Step-by-Step Setup

### 1. Start Ganache Local Blockchain

- Open Ganache Desktop
- Click "Quick Start" to start a local blockchain
- By default, it runs on `http://127.0.0.1:7545`
- Note the RPC URL and available test accounts (they have pre-funded ETH)

### 2. Open Remix IDE

1. Go to [remix.ethereum.org](https://remix.ethereum.org)
2. In the left sidebar, click "File Explorer"
3. Create a new file: `Booking.sol`
4. Copy the contract code from `blockchain/contracts/Booking.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BookingContract {
    struct Booking {
        address user;
        string guestName;
        string roomName;
        uint256 checkIn;
        uint256 checkOut;
        uint256 total;
    }

    event BookingCreated(
        address indexed user,
        string guestName,
        string roomName,
        uint256 checkIn,
        uint256 checkOut,
        uint256 total
    );

    function createBooking(
        string calldata guestName,
        string calldata roomName,
        uint256 checkIn,
        uint256 checkOut,
        uint256 total
    ) external {
        emit BookingCreated(msg.sender, guestName, roomName, checkIn, checkOut, total);
    }
}
```

### 3. Compile the Contract in Remix

1. Click the "Solidity Compiler" icon in the left sidebar
2. Select compiler version `0.8.18` or higher
3. Click "Compile Booking.sol"
4. Ensure there are no errors

### 4. Connect MetaMask to Ganache

1. Open MetaMask extension
2. Click the network dropdown (top of popup)
3. Click "Add a custom network"
4. Configure with Ganache details:
   - **Network Name**: Ganache
   - **RPC URL**: http://127.0.0.1:7545
   - **Chain ID**: 5777
   - **Currency Symbol**: ETH
5. Click "Save" and switch to Ganache network
6. Import an account from Ganache:
   - Copy a private key from Ganache (right-click on account)
   - In MetaMask, click account icon → "Import Account"
   - Paste private key and click "Import"

### 5. Deploy Contract Using Remix

1. In Remix, click "Deploy & Run Transactions" (4th icon in left sidebar)
2. **Environment dropdown**: Select "Injected Provider - MetaMask"
3. MetaMask will prompt you to connect - approve it
4. **Contract dropdown**: Select "BookingContract"
5. Click "Deploy" (orange button)
6. MetaMask will show a transaction confirmation
7. Click "Confirm" to complete deployment
8. **Important**: Copy the contract address from Remix console (deployment logs)

### 6. Configure Contract Address in App

1. Save the deployed contract address
2. Open the hotel app and navigate to a room
3. Click "Connect Wallet" button (top right)
4. MetaMask will prompt - click "Connect"
5. The address field will show your wallet address
6. Go to booking page - the contract address will be set automatically

Alternatively, manually save in browser console:
```javascript
localStorage.setItem('bookingContractAddress', '0xYourContractAddressHere');
```

## Testing the Integration

### Make a Test Booking

1. Select a room and click "Book Now"
2. Fill in booking details (dates, guests)
3. Click "Confirm"
4. During the blockchain step:
   - If wallet is connected: MetaMask will prompt for transaction approval
   - Sign the transaction
   - View transaction hash in confirmation page
5. The booking is now recorded on Ganache blockchain!

### Verify on Ganache

1. Open Ganache
2. Click the "Transactions" tab
3. You'll see your booking transaction recorded with:
   - Guest name, room name, check-in/check-out dates
   - Transaction hash
   - From address (your wallet)

## Key Features

### MetaMask Connect Component
- Located in `components/MetaMaskConnect.tsx`
- Shows wallet address when connected
- One-click disconnect
- Auto-detects Ganache network

### Web3 Context (lib/web3Context.tsx)
- Manages MetaMask connection state
- Provides contract interaction methods
- Handles gas-free transactions
- Error handling and user notifications

### Booking Integration (pages/Booking.tsx)
- Records booking on-chain if wallet connected
- Falls back to local recording if not connected
- Shows transaction hash on confirmation
- Integrates with existing booking flow

## Troubleshooting

### MetaMask Not Connecting
- Ensure MetaMask is installed and unlocked
- Check that you're on Ganache network in MetaMask
- Try refreshing the page

### Contract Address Not Found
- Ensure you saved the address in browser
- Check localStorage: Open DevTools → Console → `localStorage.getItem('bookingContractAddress')`

### Transaction Failed
- Check gas in MetaMask account (should have plenty from Ganache)
- Ensure contract address is correct
- Verify Ganache is still running

### Network Mismatch
- Make sure MetaMask and Ganache are on same network
- Ganache: http://127.0.0.1:7545 (Port 7545)
- Chain ID: 5777

## Advanced: Using Hardhat Instead

If you prefer Hardhat over Remix:

```bash
cd blockchain
npx hardhat compile
npx hardhat run scripts/deploy.js --network ganache
```

The contract address will be logged to console. Set it in localStorage as above.

## Security Notes

⚠️ **Important for Production**

- This setup is for development/testing only
- Never use real funds with Ganache
- Use test accounts only
- Implement proper access control in production
- Add payment processing (not on blockchain)
- Store sensitive data off-chain

## Resources

- [Remix Documentation](https://remix-ide.readthedocs.io/)
- [MetaMask Docs](https://docs.metamask.io/)
- [Ganache Documentation](https://www.trufflesuite.com/docs/ganache/overview)
- [Solidity Docs](https://docs.soliditylang.org/)
- [ethers.js v6 Docs](https://docs.ethers.org/v6/)
