import { deployments, ethers, network } from "hardhat";
import { expect } from "chai";
import { ERC20, UniswapV2Factory, UniswapV2Router02, uniswap } from "../../typechain-types";
import { developmentChains } from "../../helper-hardhat-config";
import { expandTo18Decimals } from "../shared/utilities";

const MINIMUM_LIQUIDITY = 10n ** 3n;

const setup = deployments.createFixture(async ({deployments, getNamedAccounts, ethers}, options) => {
  if (developmentChains.includes(network.name))
    await deployments.fixture(["UniswapV2Pair", "UniswapV2Router02"]); // ensure you start from a fresh deployments
  const { deployer } = await getNamedAccounts();
  const uniswapV2Factory = await ethers.getContract('UniswapV2Factory', deployer) as UniswapV2Factory;
  const tokenA = await ethers.getContract('TokenA', deployer) as ERC20;
  const tokenB = await ethers.getContract('TokenB', deployer) as ERC20;
  const uniswapV2PairAddress = await uniswapV2Factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
  const uniswapV2Pair = (await ethers.getContractAt("contracts/core/interfaces/IUniswapV2Pair.sol:IUniswapV2Pair", uniswapV2PairAddress));
  const token0Address = await uniswapV2Pair.token0();
  const token0 = await tokenA.getAddress() === token0Address ? tokenA : tokenB;
  const token1 = await tokenA.getAddress() === token0Address ? tokenB : tokenA;
  const uniswapV2Router02 = await ethers.getContract('UniswapV2Router02', deployer) as UniswapV2Router02;

  return { deployer, uniswapV2Factory, uniswapV2Pair, token0, token1, uniswapV2Router02 };
});

// Tests both local and on-chain
describe('UniswapV2Router02', () => {
  // Swap token0 for token1 from the pool
  it("swapTokensForExactTokens", async function () {
    const { deployer, uniswapV2Pair, token0, token1, uniswapV2Router02 } = await setup();
    const pairAddress = await uniswapV2Pair.getAddress();
    let token0PairBalance = await token0.balanceOf(pairAddress);
    let token1PairBalance = await token1.balanceOf(pairAddress);
    const token0AmountNeeded = expandTo18Decimals(5n); // amount of token 0 in the pool
    const token1AmountNeeded = expandTo18Decimals(10n); // amount of token 1 in the pool
    const outputAmount = expandTo18Decimals(1n); // amount of token 1 asked by the user

    // add liquidity if needed
    if (token0PairBalance < token0AmountNeeded && token1PairBalance < token1AmountNeeded) {
      await (await token0.transfer(pairAddress, token0AmountNeeded - token0PairBalance)).wait();
      await (await token1.transfer(pairAddress, token1AmountNeeded - token1PairBalance)).wait();
      await (await uniswapV2Pair.mint(deployer)).wait(); // mint LP tokens
      token0PairBalance = await token0.balanceOf(pairAddress);
      token1PairBalance = await token1.balanceOf(pairAddress);
    }

    // amount of token 0 user will need to send
    const expectedSwapAmount = await uniswapV2Router02.getAmountIn(outputAmount, await token0.balanceOf(pairAddress), await token1.balanceOf(pairAddress));

    // snapshot user balance before executions
    const userBalance0AtStart = await token0.balanceOf(deployer);
    const userBalance1AtStart = await token1.balanceOf(deployer);
    const pairBalance0AtStart = await token0.balanceOf(pairAddress);
    const pairBalance1AtStart = await token1.balanceOf(pairAddress);

    // Swap and check events
    await token0.approve(await uniswapV2Router02.getAddress(), ethers.MaxUint256);
    await expect(
      uniswapV2Router02.swapTokensForExactTokens(
        outputAmount, // amount out
        ethers.MaxUint256, // amount in max
        [await token0.getAddress(), await token1.getAddress()], // path
        deployer, // to
        ethers.MaxUint256 // deadline
      )
    )
      .to.emit(token0, 'Transfer')
      .withArgs(deployer, await uniswapV2Pair.getAddress(), expectedSwapAmount) // token0 transfer from user to the pool
      .to.emit(token1, 'Transfer')
      .withArgs(await uniswapV2Pair.getAddress(), deployer, outputAmount) // token1 transfer from pool to user
      .to.emit(uniswapV2Pair, 'Sync')
      .withArgs(token0PairBalance + expectedSwapAmount, token1PairBalance - outputAmount) // sync balance of token0 and token1
      .to.emit(uniswapV2Pair, 'Swap')
      .withArgs(await uniswapV2Router02.getAddress(), expectedSwapAmount, 0, 0, outputAmount, deployer); // swap event

    // Check the balances after swap for user
    expect(await token0.balanceOf(deployer)).to.equal(userBalance0AtStart - expectedSwapAmount);
    expect(await token1.balanceOf(deployer)).to.equal(userBalance1AtStart + outputAmount);
    // Check the balances after swap for pair
    expect(await token0.balanceOf(pairAddress)).to.equal(pairBalance0AtStart + expectedSwapAmount);
    expect(await token1.balanceOf(pairAddress)).to.equal(pairBalance1AtStart - outputAmount);

    // remove liquidity
    const lpBalance = await uniswapV2Pair.balanceOf(deployer);
    if (lpBalance > 0) {
      await uniswapV2Pair.transfer(pairAddress, lpBalance);
      await (await uniswapV2Pair.burn(deployer)).wait(); // burn LP tokens
    }
  }).timeout(100000);

  // Add liquidity for token0 token1 in the pool
  it("addLiquidity", async function () {
    const { deployer, uniswapV2Pair, token0, token1, uniswapV2Router02 } = await setup();
    // Setup
    const token0Amount = expandTo18Decimals(5n);
    const token1Amount = expandTo18Decimals(10n);
    const pairAddress = await uniswapV2Pair.getAddress();
    const pairBalance0AtStart = await token0.balanceOf(pairAddress);
    const pairBalance1AtStart = await token1.balanceOf(pairAddress);
    const lpBalanceAtStart = await uniswapV2Pair.balanceOf(deployer);

    // Calculate the amount of token 1 optimised keep by the pool during the add liquidity
    const pairReservesBefore = await uniswapV2Pair.getReserves();
    const token1Optimised = pairReservesBefore[0] > 0n ? await uniswapV2Router02.quote(token0Amount, pairReservesBefore[0], pairReservesBefore[1]) : token1Amount;

    // Add liquidity
    await (await token0.approve(await uniswapV2Router02.getAddress(), ethers.MaxUint256)).wait();
    await (await token1.approve(await uniswapV2Router02.getAddress(), ethers.MaxUint256)).wait();
    await expect(
      uniswapV2Router02.addLiquidity(
        await token0.getAddress(),
        await token1.getAddress(),
        token0Amount,
        token1Amount,
        0,
        0,
        deployer,
        ethers.MaxUint256
      )
    )
      .to.emit(token0, 'Transfer')
      .withArgs(deployer, pairAddress, token0Amount) // token0 transfer from user to the Router
      .to.emit(token1, 'Transfer')
      .withArgs(deployer, pairAddress, token1Optimised) // token1 transfer from user to the Router
      .to.emit(uniswapV2Pair, 'Sync')
      .withArgs(pairBalance0AtStart + token0Amount, pairBalance1AtStart + token1Optimised) // sync balance of token0 and token1
      .to.emit(uniswapV2Pair, 'Mint')
      .withArgs(await uniswapV2Router02.getAddress(), token0Amount, token1Optimised); // pair mint lp tokens for the user

    // Check user have more lp than before
    expect(await uniswapV2Pair.balanceOf(deployer)).to.be.greaterThan(lpBalanceAtStart); 

    // Remove liquidity
    const lpBalance = await uniswapV2Pair.balanceOf(deployer);
    if (lpBalance > 0) {
      await uniswapV2Pair.transfer(pairAddress, lpBalance);
      await (await uniswapV2Pair.burn(deployer)).wait(); // burn LP tokens
    }
  }).timeout(100000);

  // Remove liquidity for token0 token1 in the pool
  it("removeLiquidity", async function () {
    const { deployer, uniswapV2Pair, token0, token1, uniswapV2Router02 } = await setup();
    const pairAddress = await uniswapV2Pair.getAddress();
    let lpBalanceAtStart = await uniswapV2Pair.balanceOf(deployer);
    // Check if you have LP Tokens, add liquidity if you don't
    if (lpBalanceAtStart < 1) {
      await (await token0.transfer(pairAddress, expandTo18Decimals(5n))).wait();
      await (await token1.transfer(pairAddress, expandTo18Decimals(10n))).wait();
      await (await uniswapV2Pair.mint(deployer)).wait(); // mint LP tokens
      lpBalanceAtStart = await uniswapV2Pair.balanceOf(deployer);
    }
    const userToken0Balance = await token0.balanceOf(deployer);
    const userToken1Balance = await token1.balanceOf(deployer);
    const pairToken0Balance = await token0.balanceOf(pairAddress);
    const pairToken1Balance = await token1.balanceOf(pairAddress);
    const liquidity = lpBalanceAtStart; // same as lp balance because I will send all my lp to the pair
    const totalSupply = await uniswapV2Pair.totalSupply();
    const amountToken0Received = liquidity * pairToken0Balance / totalSupply;
    const amountToken1Received = liquidity * pairToken1Balance / totalSupply;

    // Remove liquidity
    await uniswapV2Pair.approve(await uniswapV2Router02.getAddress(), ethers.MaxUint256);
    await expect(
      uniswapV2Router02.removeLiquidity(
        await token0.getAddress(),
        await token1.getAddress(),
        lpBalanceAtStart,
        0,
        0,
        deployer,
        ethers.MaxUint256
      )
    )
      .to.emit(uniswapV2Pair, 'Transfer')
      .withArgs(deployer, pairAddress, lpBalanceAtStart) // lp tokens transfer from user to pair
      .to.emit(uniswapV2Pair, 'Transfer')
      .withArgs(pairAddress, ethers.ZeroAddress, lpBalanceAtStart) // lp tokens transfer from pair to address zero -> burn
      .to.emit(token0, 'Transfer')
      .withArgs(pairAddress, deployer, amountToken0Received) // token0 transfer from pair to the user
      .to.emit(token1, 'Transfer')
      .withArgs(pairAddress, deployer, amountToken1Received) // token1 transfer from pair to the user
      .to.emit(uniswapV2Pair, 'Sync')
      .withArgs(pairToken0Balance - amountToken0Received, pairToken1Balance - amountToken1Received) // sync balance of token0 and token1
      .to.emit(uniswapV2Pair, 'Burn')
      .withArgs(await uniswapV2Router02.getAddress(), amountToken0Received, amountToken1Received, deployer); // burn event emitted by the router

    // User's lp balance should be empty
    expect(await uniswapV2Pair.balanceOf(deployer)).to.eq(0);
    // User's tokens balance should be increased
    expect(await token0.balanceOf(deployer)).to.eq(userToken0Balance + amountToken0Received);
    expect(await token1.balanceOf(deployer)).to.eq(userToken1Balance + amountToken1Received);
  }).timeout(100000);
});