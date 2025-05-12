require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.21',
        settings: {
          optimizer: {
            enabled: true,
            details: {
              yulDetails: {
                optimizerSteps: "u",
              },
            },
            runs: 13370
          },
          evmVersion: "london",
        }
      },
    ],
  },
  networks: {
    localhost: {
      allowUnlimitedContractSize: true,
      timeout: 1800000,
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      timeout: 1800000,
    },
    torus_testnet : {
      url: "https://rpc.testnet.toruschain.com",
      timeout: 1800000,
      accounts: [vars.get("PK")],
    },
  },
}
