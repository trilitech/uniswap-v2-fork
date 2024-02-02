import { deployments, ethers, network } from "hardhat";
import { expect } from "chai";
import { UniswapV2Factory } from "../../typechain-types";
import { developmentChains } from "../../helper-hardhat-config";
import UniswapV2Pair from "../../artifacts/contracts/core/UniswapV2Pair.sol/UniswapV2Pair.json";
import { getCreate2Address } from "../shared/utilities";
import { Contract } from "ethers";

const setup = deployments.createFixture(async ({deployments, getNamedAccounts, ethers}, options) => {
  if (developmentChains.includes(network.name))
    await deployments.fixture(["UniswapV2Factory"]); // ensure you start from a fresh deployments
  const { deployer, assistant } = await getNamedAccounts();
  const uniswapV2Factory = await ethers.getContract('UniswapV2Factory', deployer) as UniswapV2Factory;

  return { deployer, assistant, uniswapV2Factory };
});

const TEST_ADDRESSES: [string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000'
]

// Only use for local tests to assure the good fork of the core
if (!developmentChains.includes(network.name)) {
  console.log("Test are setup only for local tests...");
} else {
  describe('UniswapV2Factory', () => {
    describe("Init", function () {
      it("feeTo, feeToSetter, allPairsLength", async function () {
        const { deployer, uniswapV2Factory } = await setup();
  
        expect(await uniswapV2Factory.feeTo()).to.eq(ethers.ZeroAddress);
        expect(await uniswapV2Factory.feeToSetter()).to.eq(deployer);
        expect(await uniswapV2Factory.allPairsLength()).to.eq(0);
    
      });
    });
    describe("Pair", function () {
      async function createPair(tokens: [string, string], uniswapV2Factory: UniswapV2Factory) {
        const bytecode = UniswapV2Pair.bytecode;
        const create2Address = getCreate2Address(await uniswapV2Factory.getAddress(), tokens, bytecode);
        await expect(uniswapV2Factory.createPair(...tokens))
          .to.emit(uniswapV2Factory, 'PairCreated')
          .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address, 1n);
    
        await expect(uniswapV2Factory.createPair(...tokens)).to.be.reverted; // UniswapV2: PAIR_EXISTS
        await expect(uniswapV2Factory.createPair(...tokens.slice().reverse() as any)).to.be.reverted; // UniswapV2: PAIR_EXISTS
        expect(await uniswapV2Factory.getPair(...tokens)).to.eq(create2Address);
        expect(await uniswapV2Factory.getPair(...tokens.slice().reverse() as any)).to.eq(create2Address);
        expect(await uniswapV2Factory.allPairs(0)).to.eq(create2Address);
        expect(await uniswapV2Factory.allPairsLength()).to.eq(1);
    
        const pair = new Contract(create2Address, JSON.stringify(UniswapV2Pair.abi), ethers.provider);
        expect(await pair.factory()).to.eq(await uniswapV2Factory.getAddress());
        expect(await pair.token0()).to.eq(TEST_ADDRESSES[0]);
        expect(await pair.token1()).to.eq(TEST_ADDRESSES[1]);
      }
  
      it("createPair", async function () {
        const { uniswapV2Factory } = await setup();
  
        await createPair(TEST_ADDRESSES, uniswapV2Factory);
      });
      it("createPair:reverse", async function () {
        const { uniswapV2Factory } = await setup();
  
        await createPair(TEST_ADDRESSES.slice().reverse() as [string, string], uniswapV2Factory);
      });
      it("createPair:gas", async function () {
        const { uniswapV2Factory } = await setup();
  
        const tx = await uniswapV2Factory.createPair(...TEST_ADDRESSES);
        const receipt = await tx.wait();
        if (receipt)
          // expect(receipt.gasUsed).to.eq(2512920); // original
          expect(receipt.gasUsed).to.be.below(4000000); // non-optimized
        else
          throw new Error("Error in the gas prediction");
      });    
      it("setFeeTo", async function () {
        const { uniswapV2Factory } = await setup();
        const [owner, account2] = await ethers.getSigners();
  
        await expect(uniswapV2Factory.connect(account2).setFeeTo(account2.address)).to.be.revertedWith('UniswapV2: FORBIDDEN');
        await uniswapV2Factory.setFeeTo(owner.address);
        expect(await uniswapV2Factory.feeTo()).to.eq(owner.address);
      });
      it("setFeeToSetter", async function () {
        const { uniswapV2Factory } = await setup();
        const [owner, account2] = await ethers.getSigners();
  
        await expect(uniswapV2Factory.connect(account2).setFeeToSetter(account2.address)).to.be.revertedWith('UniswapV2: FORBIDDEN');
        await uniswapV2Factory.setFeeToSetter(account2.address);
        expect(await uniswapV2Factory.feeToSetter()).to.eq(account2.address);
        await expect(uniswapV2Factory.setFeeToSetter(owner.address)).to.be.revertedWith('UniswapV2: FORBIDDEN');
      });
    });
  });
}

