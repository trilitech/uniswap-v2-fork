import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { blockConfirmation, developmentChains } from "../../helper-hardhat-config";
import { verify } from "../../scripts/utils/verify";
import { ethers } from "hardhat";
import { UniswapV2Factory } from "../../typechain-types";

const deployUniswapV2Factory: DeployFunction = async function(
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("----------------------------------------------------");
  log("Deploying UniswapV2Factory and waiting for confirmations...");
  const uniswapV2Factory = await deploy("UniswapV2Factory", {
    from: deployer,
    args: [deployer],
    log: true,
    // we need to wait if on a live network so we can verify properly
    waitConfirmations: blockConfirmation[network.name] || 1,
  });

  const uniswapV2FactoryContract = await ethers.getContract('UniswapV2Factory', deployer) as UniswapV2Factory;
  console.log(`\nCODE HASH: ${await uniswapV2FactoryContract.INIT_CODE_PAIR_HASH()}\n`);

  // verify if not on a local chain
  if (!developmentChains.includes(network.name)) {
    console.log("Wait before verifying");
    await verify(uniswapV2Factory.address, [deployer]);
  }
};

export default deployUniswapV2Factory;
deployUniswapV2Factory.tags = ["all", "core", "Factory", "UniswapV2Factory"];