import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { blockConfirmation, developmentChains } from "../../helper-hardhat-config";
import { verify } from "../../scripts/utils/verify";
import { ethers } from "hardhat";

const deployUniswapV2Router02: DeployFunction = async function(
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments, network,  } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("----------------------------------------------------");
  log("Deploying UniswapV2Router02 and waiting for confirmations...");

  // Change this manually if you want to modify the addresses used by the router
  const factoryAddress = await (await ethers.getContract("UniswapV2Factory")).getAddress();
  const wethAddress = await (await ethers.getContract("WETH9")).getAddress();

  const uniswapV2Router02 = await deploy("UniswapV2Router02", {
    from: deployer,
    args: [
        factoryAddress, // factory
        wethAddress // weth
    ],
    log: true,
    // we need to wait if on a live network so we can verify properly
    waitConfirmations: blockConfirmation[network.name] || 1,
  });

  // verify if not on a local chain
  if (!developmentChains.includes(network.name)) {
    console.log("Wait before verifying");
    await verify(uniswapV2Router02.address, [factoryAddress, wethAddress]);
  }
};

export default deployUniswapV2Router02;
deployUniswapV2Router02.tags = ["all", "periphery", "UniswapV2Router02"];
deployUniswapV2Router02.dependencies = ["UniswapV2Factory", "WETH9"]; // remove "WETH9" if you want to deploy the Router without deploying a WETH contract
deployUniswapV2Router02.runAtTheEnd = true;