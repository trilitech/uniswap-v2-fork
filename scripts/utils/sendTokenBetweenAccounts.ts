import { ethers } from "hardhat";

// This is use to send tokens to pay gas on chains from your first account to the second
async function main() {
    const [owner, secondAccount] = await ethers.getSigners();

    if (!owner.address || !secondAccount.address) {
      console.log("Error: bad accounts set up");
      return;
    }
    console.log("Sending tokens...");
    const receipt = await owner.sendTransaction({to: secondAccount.address, value: ethers.parseEther("10.0")});
    await receipt.wait();
    console.log("Transaction hash:", receipt.hash);
    console.log("Tokens sent!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});