import { ethers } from "hardhat";
import { ERC20, UniswapV2Router02 } from "../typechain-types";

async function main() {
  const [ owner ] = await ethers.getSigners();
  const tokenC = await ethers.getContract("TokenC") as ERC20;
  const tokenD = await ethers.getContract("TokenD") as ERC20;
  const router = await ethers.getContract("UniswapV2Router02") as UniswapV2Router02;

  // approve the router to move tokens
  await (await tokenC.approve(await router.getAddress(), ethers.MaxUint256)).wait();
  await (await tokenD.approve(await router.getAddress(), ethers.MaxUint256)).wait();

  const receipt = await (await router.addLiquidity(
    await tokenC.getAddress(),
    await tokenD.getAddress(),
    5n * 10n ** 18n,
    10n * 10n ** 18n,
    0,
    0,
    owner.address,
    ethers.MaxUint256,
    // GAS PROBLEM ON ETHERLINK - TODO REMOVE THIS ONCE CORRECTED
    // { gasLimit: network.name == "etherlink" || network.name == "nightly" ? estimatedGas * 2n : estimatedGas }
  )).wait();

  console.log("The transaction made through!!");
  console.log(receipt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});