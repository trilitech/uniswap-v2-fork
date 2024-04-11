import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { blockConfirmation, developmentChains } from "../../helper-hardhat-config";
import { verify } from "../../scripts/utils/verify";
import { expandTo18Decimals } from "../../test/shared/utilities";

// This is used to deploy 2 ERC20 tokens under names TokenC and TokenD
const deployTokens: DeployFunction = async function(
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("----------------------------------------------------");
  log("Deploying 2 ERC20 tokens and waiting for confirmations...");
  // Deploy 2 fake tokens
  const tokenC = await deploy("TokenC", {
    contract: "contracts/core/test/ERC20.sol:ERC20",
    from: deployer,
    args: [expandTo18Decimals(10000n)],
    log: true,
    // we need to wait if on a live network so we can verify properly
    waitConfirmations: blockConfirmation[network.name] || 1,
  });
  const tokenD = await deploy("TokenD", {
    contract: "contracts/core/test/ERC20.sol:ERC20",
    from: deployer,
    args: [expandTo18Decimals(10000n)],
    log: true,
    // we need to wait if on a live network so we can verify properly
    waitConfirmations: blockConfirmation[network.name] || 1,
  });

  // verify if not on a local chain
  if (!developmentChains.includes(network.name)) {
    console.log("Wait before verifying");
    await verify(tokenC.address, [expandTo18Decimals(10000n)], "contracts/core/test/ERC20.sol:ERC20");
    await verify(tokenD.address, [expandTo18Decimals(10000n)], "contracts/core/test/ERC20.sol:ERC20");
  }
};

export default deployTokens;
deployTokens.tags = ["tokens", "Tokens"];
