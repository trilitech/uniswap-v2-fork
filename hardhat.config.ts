import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import "hardhat-deploy";
import "hardhat-deploy-ethers";

const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "";
const SECOND_PRIVATE_KEY =
  process.env.SECOND_PRIVATE_KEY ||
  "";

const MUMBAI_RPC_URL =
  process.env.MUMBAI_RPC_URL ||
  "https://polygon-mumbai.g.alchemy.com/v2/your-api-key";
const POLYGONSCAN_API_KEY = 
  process.env.POLYGONSCAN_API_KEY || 
  "";
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ||
  "https://eth-sepolia.g.alchemy.com/v2/your-api-key";
const ETHERSCAN_API_KEY = 
  process.env.ETHERSCAN_API_KEY || 
  "";
const ETHERLINK_TESTNET_RPC_URL =
  process.env.ETHERLINK_TESTNET_RPC_URL ||
  "https://node.ghostnet.etherlink.com";
const ETHERLINK_API_KEY = 
  process.env.ETHERLINK_API_KEY || 
  "";
// const NIGHTLY_RPC_URL =
//   process.env.NIGHTLY_RPC_URL ||
//   "";
// // Specific private key for the nightly chain with founds
// const NIGHTLY_PRIVATE_KEY =
//   process.env.NIGHTLY_PRIVATE_KEY ||
//   "";
// const NIGHTLY_CHAINID =
//   Number(process.env.NIGHTLY_CHAINID) ||
//   31337; // local chainId -> will raise an error
// const NIGHTLY_EXPLORER =
//   process.env.NIGHTLY_EXPLORER ||
//   "";

// Binance Smart Chain
const BSC_TESTNET_URL =
  process.env.BSC_TESTNET_URL ||
  "https://bsc-testnet.publicnode.com";
const BSCSCAN_API_KEY =
  process.env.BSCSCAN_API_KEY ||
  "";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        }
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        }

      },
    ]
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
      chainId: 31337,
      accounts: ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"]
    },
    sepolia: {
      chainId: 11155111,
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY, SECOND_PRIVATE_KEY]
    },
    mumbai: {
      chainId: 80001,
      url: MUMBAI_RPC_URL,
      accounts: [PRIVATE_KEY, SECOND_PRIVATE_KEY],
    },
    etherlinkTestnet: {
      chainId: 128123,
      url: ETHERLINK_TESTNET_RPC_URL,
      accounts: [PRIVATE_KEY, SECOND_PRIVATE_KEY],
    },
    // nightly: {
    //   chainId: NIGHTLY_CHAINID,
    //   url: NIGHTLY_RPC_URL,
    //   accounts: [NIGHTLY_PRIVATE_KEY, PRIVATE_KEY]
    // },
    bscTestnet: {
      chainId: 97,
      url: BSC_TESTNET_URL,
      accounts: [PRIVATE_KEY],
    }
  },
  // hardhat-deploy named account system
  namedAccounts: {
    deployer: {
      default: 0, // Deployer will be the first private key above
    },
    assistant: {
      default: 1, // Assistant will be the second private key above
    }
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
      etherlink: ETHERLINK_API_KEY,
      // nightly: ETHERLINK_API_KEY,
      bscTestnet: BSCSCAN_API_KEY
    },
    customChains: [
      {
        network: "etherlink",
        chainId: 128123,
        urls: {
          // apiURL: "https://explorer.etherlink.com/api",
          apiURL: "https://testnet-explorer.etherlink.com/api",
          // browserURL: "https://explorer.etherlink.com"
          browserURL: "https://testnet-explorer.etherlink.com"
        }
      },
      // {
      //   network: "nightly",
      //   chainId: NIGHTLY_CHAINID,
      //   urls: {
      //     apiURL: `${NIGHTLY_EXPLORER}api`,
      //     browserURL: NIGHTLY_EXPLORER
      //   }
      // }
    ]
  }
};

export default config;
