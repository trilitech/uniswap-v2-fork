import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { blockConfirmation, developmentChains } from "../../helper-hardhat-config";
import { verify } from "../../scripts/utils/verify";
import { expandTo18Decimals } from "../../test/shared/utilities";
import { ethers } from "hardhat";
import { UniswapV2Factory } from "../../typechain-types";

const deployUniswapV2Pair: DeployFunction = async function(
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("----------------------------------------------------");
  log("Deploying UniswapV2Pair and waiting for confirmations...");
  // Deploy 2 fake tokens for testing the pair
  const tokenA = await deploy("TokenA", {
    contract: "contracts/core/test/ERC20.sol:ERC20",
    from: deployer,
    args: [expandTo18Decimals(10000n)],
    log: true,
    // we need to wait if on a live network so we can verify properly
    // waitConfirmations: blockConfirmation[network.name] || 1,
  });
  const tokenB = await deploy("TokenB", {
    contract: "contracts/core/test/ERC20.sol:ERC20",
    from: deployer,
    args: [expandTo18Decimals(10000n)],
    log: true,
    // we need to wait if on a live network so we can verify properly
    // waitConfirmations: blockConfirmation[network.name] || 1,
  });

  const uniswapV2Factory = await ethers.getContract('UniswapV2Factory', deployer) as UniswapV2Factory;

  // /!\ The UniswapV2Pair is created from the factory so the Pair contract is not set in hardhat-deploy env...
  // Verify the pair isn't already deployed
  let pairAddress = await uniswapV2Factory.getPair(tokenA.address, tokenB.address);
  if (pairAddress == ethers.ZeroAddress) {
    await (await uniswapV2Factory.createPair(tokenA.address, tokenB.address)).wait();
    pairAddress = await uniswapV2Factory.getPair(tokenA.address, tokenB.address);
    log("Pair successfully created:", pairAddress);
  } else {
    log("reusing pair:", pairAddress);
  }

  // verify if not on a local chain
  if (!developmentChains.includes(network.name)) {
    console.log("Wait before verifying");
    await verify(tokenA.address, [expandTo18Decimals(10000n)], "contracts/core/test/ERC20.sol:ERC20");
    await verify(tokenB.address, [expandTo18Decimals(10000n)], "contracts/core/test/ERC20.sol:ERC20");
    // try that
    // await verify(pairAddress, []);
  }
};

export default deployUniswapV2Pair;
deployUniswapV2Pair.tags = ["all", "core", "Pair", "UniswapV2Pair"];
deployUniswapV2Pair.dependencies = ["UniswapV2Factory"];