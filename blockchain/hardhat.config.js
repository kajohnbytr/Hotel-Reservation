require("@nomiclabs/hardhat-ethers");
const path = require("path");
const dotenv = require("dotenv");

// Prefer backend env as the single source of truth for chain URL and private key.
dotenv.config({ path: path.resolve(__dirname, "../backend/.env") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const sharedRpcUrl =
  process.env.ETH_PROVIDER_URL ||
  process.env.GANACHE_URL ||
  process.env.LOCALHOST_URL ||
  "http://127.0.0.1:8545";

module.exports = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    localhost: {
      url: sharedRpcUrl
    },
    ganache: {
      url: sharedRpcUrl,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : undefined
    }
  }
};