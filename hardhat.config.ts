export { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-verify'
import 'hardhat-contract-sizer'
import 'solidity-coverage'

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  networks: {
    mode: {
      url: 'https://mainnet.mode.network/',
      ethNetwork: 'mode',
      chainId: 34443,
    },
    testnet: {
      url: 'https://sepolia.mode.network/',
      ethNetwork: 'sepolia',
      chainId: 919,
    },
  },
  etherscan: {
    apiKey: {
      testnet: 'api key',
      mode: 'api key',
    },
    customChains: [
      {
        network: 'mode',
        chainId: 34443,
        urls: {
          apiURL: 'https://explorer.mode.network/api/',
          browserURL: 'https://explorer.mode.network/',
        },
      },
      {
        network: 'testnet',
        chainId: 919,
        urls: {
          apiURL: 'https://sepolia.explorer.mode.network/api/',
          browserURL: 'https://sepolia.explorer.mode.network/',
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    sources: './contracts',
    tests: './test',
  },
  solidity: {
    compilers: [
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: '0.6.5',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
}
