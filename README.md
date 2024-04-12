# Uniswap v2 fork

This repository contains a fork of [UniswapV2]("https://github.com/Uniswap") contracts (core and periphery) using hardhat and hardhat-deploy.

First things to do after cloning is to install dependencies:
```
npm install
```

You need to create a `.env` file that match the `hardhat.config.ts`:
```
PRIVATE_KEY=<your-private-key>
SECOND_PRIVATE_KEY=<your-private-key>

SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-api-key>
ETHERSCAN_API_KEY=<your-api-key>

MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/<your-api-key>
POLYGONSCAN_API_KEY=<your-api-key>

ETHERLINK_RPC_URL=https://node.ghostnet.etherlink.com
ETHERLINK_API_KEY=YOUCANCOPYME0000000000000000000000

NIGHTLY_RPC_URL=https://node.<deployment-date>.etherlink-nightly.tzalpha.net/
NIGHTLY_EXPLORER=https://explorer.<deployment-date>.etherlink-nightly.tzalpha.net/
NIGHTLY_CHAINID=<deployment-date>
NIGHTLY_PRIVATE_KEY=<nightly-private-key>
```

---

## 0. Deploy Uniswap v2 protocol

### Deploy factory (core)

You can then start by deploying the factory of UniswapV2 from the core:
```
npx hardhat deploy --tags UniswapV2Factory --network <your-network>
```

**Important:** you need to copy the code hash printed during the deployment. If you missed it, you can go on the explorer and in the read contract part, find the `INIT_CODE_PAIR_HASH`.

### Deploy Router (periphery)

The first thing you need to do is to modify the hash in the library `contracts/periphery/libraries/UniswapV2Library.sol` line 24 with your own code hash from the deployment of your factory (without the 0x):
```
hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f' // init code hash
```

Then you have two possibilities:
1. you want to deploy a new WETH contract with the router
2. you want to use an already deployd WETH contract

#### Deploy with a new WETH contract

You don't need to change anything in the code, just run the command:
```
npx hardhat deploy --tags UniswapV2Router02 --network <your-network>
```

#### Deploy without a new WETH contract

You need to remove `"WETH9"` the line 41 in the `deploy/periphery/02-deploy-UniswapV2Router02.ts` like so:
```
deployUniswapV2Router02.dependencies = ["UniswapV2Factory"]; // remove "WETH9" if you want to deploy the Router without deploying a WETH contract
```

Then you can specify the address of the WETH contract you want to use on the line 19 in the same file:
```
// const wethAddress = await (await ethers.getContract("WETH9")).getAddress();
const wethAddress = "weth_address";
```

You can finally run the command:
```
npx hardhat deploy --tags UniswapV2Router02 --network <your-network>
```

## 1. Set up the pair

You should have the protocol itself deployed. You now need to create a pair from the factory.

Here is the command to deploy 2 new ERC20 tokens and their pair on the Uniswap protocol:
```
npx hardhat deploy --tags UniswapV2Pair --network <your-network>
```

**Note:** if you want to use 2 existing tokens for the pair, you have to modify the `deploy/core/02-deploy-UniswapV2Pair.ts` script.

## 2., 3. and 4. Tests

If you want to launch the tests, you can run:
```
npx hardhat test test/periphery/UniswapV2Router02.ts --network <your-network>
```

**Note:** you can the launch each test individually by using the `--grep` flag and the name of the test after. Example:
```
npx hardhat test test/periphery/UniswapV2Router02.ts --network <your-network> --grep "addLiquidity"
```

## NEW. Scenario create pair + add liquidity in one tx

Instead of setting up the pair, we will just deploy the tokens and then let the router with `addLiquidity` both deploys the pair and adds liquidity.

**Note:** Remember that you still have to deploy the factory and the router before you can use it!

Deploy the 2 tokens:
```
npx hardhat deploy --tags Tokens --network <your-network>
```

By default the test is disabled, you have to remove the 'x' in front of the test line 286 in `test/periphery/UniswapV2Router02.ts`.

Then you can run the script like so:
```
npx hardhat test test/periphery/UniswapV2Router02.ts --network <your-network> --grep "SPECIAL TEST"
```