export { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-contract-sizer'

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  networks: {
    mode: {
      url: 'https://mainnet.mode.network/',
      ethNetwork: 'mode',
      chainId: 34443,
    },
    mode_testnet: {
      url: 'https://sepolia.mode.network/',
      ethNetwork: 'sepolia',
      chainId: 919,
    },
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
