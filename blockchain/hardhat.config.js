require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.18",
  networks: {
    localhost: {
      url: process.env.LOCALHOST_URL || "http://127.0.0.1:8545"
    },
    ganache: {
      // default port matches Ganache Desktop quickstart
      url: process.env.GANACHE_URL || "http://127.0.0.1:7545",
      // accounts are provided automatically by Ganache; you can override with PRIVATE_KEY env var
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : undefined
    }
  }
};