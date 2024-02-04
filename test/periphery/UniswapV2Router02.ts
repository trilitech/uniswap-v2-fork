import { deployments, ethers, network } from "hardhat";
import { expect } from "chai";
import { ERC20, UniswapV2Factory, UniswapV2Router02, uniswap } from "../../typechain-types";
import { developmentChains } from "../../helper-hardhat-config";
import { expandTo18Decimals } from "../shared/utilities";

const MINIMUM_LIQUIDITY = 10n ** 3n;

const setup = deployments.createFixture(async ({deployments, getNamedAccounts, ethers}, options) => {
  // if (developmentChains.includes(network.name))
  //   await deployments.fixture(["UniswapV2Pair", "UniswapV2Router02"]); // ensure you start from a fresh deployments
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
    const token0Amount = expandTo18Decimals(5n); // amount of token 0 in the pool
    const token1Amount = expandTo18Decimals(10n); // amount of token 1 in the pool
    const expectedSwapAmount = 557227237267357629n; // amount of token 0 user will need to send
    const outputAmount = expandTo18Decimals(1n); // amount of token 1 asked by the user

    // add liquidity
    const pairToken0Before = await token0.balanceOf(pairAddress);
    const pairToken1Before = await token1.balanceOf(pairAddress);
    console.log("pair token0 balance:", await token0.balanceOf(pairAddress));
    console.log("pair token1 balance:", await token1.balanceOf(pairAddress));

    if (pairToken0Before > token0Amount || pairToken1Before > token1Amount)
      throw new Error("Error: too much tokens are in the pair, re deploy a new one");
    await (await token0.transfer(await uniswapV2Pair.getAddress(), token0Amount - pairToken0Before)).wait();
    await (await token1.transfer(await uniswapV2Pair.getAddress(), token1Amount - pairToken1Before)).wait();
    await (await uniswapV2Pair.mint(deployer)).wait(); // mint LP tokens

    console.log("pair token0 balance:", await token0.balanceOf(pairAddress));
    console.log("pair token1 balance:", await token1.balanceOf(pairAddress));

    console.log("quote:", await uniswapV2Router02.getAmountIn(outputAmount, token0Amount, token1Amount));

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
      .withArgs(token0Amount + expectedSwapAmount, token1Amount - outputAmount) // sync balance of token0 and token1
      .to.emit(uniswapV2Pair, 'Swap')
      .withArgs(await uniswapV2Router02.getAddress(), expectedSwapAmount, 0, 0, outputAmount, deployer); // swap event
    // Check the balances after swap for user
    expect(await token0.balanceOf(deployer)).to.equal(userBalance0AtStart - expectedSwapAmount);
    expect(await token1.balanceOf(deployer)).to.equal(userBalance1AtStart + outputAmount);
    // Check the balances after swap for pair
    expect(await token0.balanceOf(pairAddress)).to.equal(pairBalance0AtStart + expectedSwapAmount);
    expect(await token1.balanceOf(pairAddress)).to.equal(pairBalance1AtStart - outputAmount);

    // remove liquidity
    await uniswapV2Pair.transfer(pairAddress, await uniswapV2Pair.balanceOf(deployer));
    await (await uniswapV2Pair.burn(deployer)).wait(); // burn LP tokens

    console.log("pair token0 balance:", await token0.balanceOf(pairAddress));
    console.log("pair token1 balance:", await token1.balanceOf(pairAddress));
  }).timeout(100000);

  // Add liquidity for token0 token1 in the pool
  it("addLiquidity", async function () {
    const { deployer, uniswapV2Pair, token0, token1, uniswapV2Router02 } = await setup();
    // Setup
    const token0Amount = expandTo18Decimals(1n);
    const token1Amount = expandTo18Decimals(5n);
    const pairAddress = await uniswapV2Pair.getAddress();
    const pairBalance0AtStart = await token0.balanceOf(pairAddress);
    const pairBalance1AtStart = await token1.balanceOf(pairAddress);
    const lpBalanceAtStart = await uniswapV2Pair.balanceOf(deployer);

    console.log("pair token0 balance:", await token0.balanceOf(pairAddress));
    console.log("pair token1 balance:", await token1.balanceOf(pairAddress));

    // Calculate the amount of token1 optimised keep by the pool during the add liquidity
    const pairReservesBefore = await uniswapV2Pair.getReserves();
    console.log("reserve:", pairReservesBefore);
    const token1Optimised = pairReservesBefore[0] > 0n ? await uniswapV2Router02.quote(token0Amount, pairReservesBefore[0], pairReservesBefore[1]) : token1Amount;
    console.log("WOOOOOWWW:", token1Optimised);

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
      .withArgs(deployer, pairAddress, token0Amount)
      .to.emit(token1, 'Transfer')
      .withArgs(deployer, pairAddress, token1Optimised)
      .to.emit(uniswapV2Pair, 'Sync')
      .withArgs(pairBalance0AtStart + token0Amount, pairBalance1AtStart + token1Optimised)
      .to.emit(uniswapV2Pair, 'Mint')
      .withArgs(await uniswapV2Router02.getAddress(), token0Amount, token1Optimised);

    console.log("liquidity: ", await uniswapV2Pair.balanceOf(deployer));
    expect(await uniswapV2Pair.balanceOf(deployer)).to.be.greaterThan(lpBalanceAtStart); // more lp than before

    // Remove liquidity
    // await uniswapV2Pair.approve(await uniswapV2Router02.getAddress(), ethers.MaxUint256);
    // await uniswapV2Router02.removeLiquidity(
    //   await token0.getAddress(),
    //   await token1.getAddress(),
    //   await uniswapV2Pair.balanceOf(deployer),
    //   0,
    //   0,
    //   deployer,
    //   ethers.MaxUint256
    // );

    console.log("pair token0 balance:", await token0.balanceOf(pairAddress));
    console.log("pair token1 balance:", await token1.balanceOf(pairAddress));

  }).timeout(100000);

  // Remove liquidity for token0 token1 in the pool
  it("removeLiquidity", async function () {
    const { deployer, uniswapV2Pair, token0, token1, uniswapV2Router02 } = await setup();
    const pairAddress = await uniswapV2Pair.getAddress();
    const lpBalanceAtStart = await uniswapV2Pair.balanceOf(deployer);
    const userToken0Balance = await token0.balanceOf(deployer);
    const userToken1Balance = await token1.balanceOf(deployer);
    const pairToken0Balance = await token0.balanceOf(pairAddress);
    const pairToken1Balance = await token1.balanceOf(pairAddress);
    const liquidity = lpBalanceAtStart; // same as lp balance because I will send it to the pair
    const totalSupply = await uniswapV2Pair.totalSupply();
    const amountToken0Received = liquidity * pairToken0Balance / totalSupply;
    const amountToken1Received = liquidity * pairToken1Balance / totalSupply;

    console.log("lp:", lpBalanceAtStart);
    console.log("liquidity:", liquidity);
    console.log("totalSupply:", totalSupply);
    console.log("amountToken0Received:", amountToken0Received);
    console.log("amountToken1Received:", amountToken1Received);

    // Check if you have LP Tokens, if you don't run the test above first.
    if (lpBalanceAtStart < 1) {
      throw new Error("Error: you can't removeLiquidity if you have not LP tokens, run the addLiquidity test first.");
    }
    
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
      .withArgs(deployer, pairAddress, lpBalanceAtStart)
      .to.emit(uniswapV2Pair, 'Transfer')
      .withArgs(pairAddress, ethers.ZeroAddress, lpBalanceAtStart)
      .to.emit(token0, 'Transfer')
      .withArgs(pairAddress, deployer, amountToken0Received)
      .to.emit(token1, 'Transfer')
      .withArgs(pairAddress, deployer, amountToken1Received)
      .to.emit(uniswapV2Pair, 'Sync')
      .withArgs(pairToken0Balance - amountToken0Received, pairToken1Balance - amountToken1Received)
      .to.emit(uniswapV2Pair, 'Burn')
      .withArgs(await uniswapV2Router02.getAddress(), amountToken0Received, amountToken1Received, deployer);

    expect(await uniswapV2Pair.balanceOf(deployer)).to.eq(0);
    expect(await token0.balanceOf(deployer)).to.eq(userToken0Balance + amountToken0Received);
    expect(await token1.balanceOf(deployer)).to.eq(userToken1Balance + amountToken1Received);
  }).timeout(100000);
});