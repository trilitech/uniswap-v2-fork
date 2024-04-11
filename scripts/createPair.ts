import { ethers } from "hardhat";
import { UniswapV2Factory } from "../typechain-types";

async function main() {
  const [ owner ] = await ethers.getSigners();
  const WXTZ = "0xb1ea698633d57705e93b0e40c1077d46cd6a51d8";
  const eUSD = "0x1A71f491fb0Ef77F13F8f6d2a927dd4C969ECe4f";
  const factory = await ethers.getContractAt("UniswapV2Factory", "0x6981ad2272010a6EF341497D6c3d109F6B87f3D9") as UniswapV2Factory;

  await (await factory.createPair(
    WXTZ,
    eUSD
  )).wait();
  console.log("pair deployed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});