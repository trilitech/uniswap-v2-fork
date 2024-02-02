import { deployments, ethers, network } from "hardhat";
import { expect } from "chai";
import { ERC20, UniswapV2Factory } from "../../typechain-types";
import { developmentChains } from "../../helper-hardhat-config";
import { expandTo18Decimals } from "../shared/utilities";

const setup = deployments.createFixture(async ({deployments, getNamedAccounts, ethers}, options) => {
  if (developmentChains.includes(network.name))
    await deployments.fixture(["UniswapV2Pair"]); // ensure you start from a fresh deployments
  const { deployer, assistant } = await getNamedAccounts();
  const uniswapV2Factory = await ethers.getContract('UniswapV2Factory', deployer) as UniswapV2Factory;
  const tokenA = await ethers.getContract('TokenA', deployer) as ERC20;
  const tokenB = await ethers.getContract('TokenB', deployer) as ERC20;
  const uniswapV2PairAddress = await uniswapV2Factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
  const uniswapV2Pair = await ethers.getContractAt("contracts/core/interfaces/IUniswapV2Pair.sol:IUniswapV2Pair", uniswapV2PairAddress);
  const token0Address = await uniswapV2Pair.token0();
  const token0 = await tokenA.getAddress() === token0Address ? tokenA : tokenB;
  const token1 = await tokenA.getAddress() === token0Address ? tokenB : tokenA;

  console.log("uniswapV2Pair address:", await uniswapV2Pair.getAddress());
  return { deployer, assistant, uniswapV2Factory, uniswapV2Pair, token0, token1 };
});

const MINIMUM_LIQUIDITY = 10n ** 3n;

// Only use for local tests to assure the good fork of the core
if (!developmentChains.includes(network.name)) {
  console.log("Test are setup only for local tests...");
} else {
  describe('UniswapV2Pair', () => {
    it("mint", async function () {
      const { deployer, assistant, uniswapV2Factory, uniswapV2Pair, token0, token1 } = await setup();

      const token0Amount = expandTo18Decimals(1n);
      const token1Amount = expandTo18Decimals(4n);
      await token0.transfer(await uniswapV2Pair.getAddress(), token0Amount);
      await token1.transfer(await uniswapV2Pair.getAddress(), token1Amount);

      const expectedLiquidity = expandTo18Decimals(2n);
      await expect(uniswapV2Pair.mint(deployer))
        .to.emit(uniswapV2Pair, 'Transfer')
        .withArgs(ethers.ZeroAddress, ethers.ZeroAddress, MINIMUM_LIQUIDITY)
        .to.emit(uniswapV2Pair, 'Transfer')
        .withArgs(ethers.ZeroAddress, deployer, expectedLiquidity - MINIMUM_LIQUIDITY)
        .to.emit(uniswapV2Pair, 'Sync')
        .withArgs(token0Amount, token1Amount)
        .to.emit(uniswapV2Pair, 'Mint')
        .withArgs(deployer, token0Amount, token1Amount);

      expect(await uniswapV2Pair.totalSupply()).to.eq(expectedLiquidity);
      expect(await uniswapV2Pair.balanceOf(deployer)).to.eq(expectedLiquidity - MINIMUM_LIQUIDITY);
      expect(await token0.balanceOf(await uniswapV2Pair.getAddress())).to.eq(token0Amount);
      expect(await token1.balanceOf(await uniswapV2Pair.getAddress())).to.eq(token1Amount);
      const reserves = await uniswapV2Pair.getReserves();
      expect(reserves[0]).to.eq(token0Amount);
      expect(reserves[1]).to.eq(token1Amount);
    }).timeout(100000);
  });
}