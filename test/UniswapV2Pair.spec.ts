import { expect } from 'chai'
import { Contract, Wallet, ZeroAddress } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import { expandTo18Decimals, encodePrice } from './shared/utilities'
import { pairFixture } from './shared/fixtures'

const MINIMUM_LIQUIDITY = BigInt(10) ** BigInt(3)

describe('KimPair', () => {
  let wallet: Wallet
  let other: Wallet

  let factory: Contract
  let token0: Contract
  let token1: Contract
  let pair: Contract

  beforeEach(async () => {
    ;[wallet, other] = await ethers.getSigners()
    ;({ factory, token0, token1, pair } = await loadFixture(pairFixture))
  })

  it('mint', async () => {
    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)
    await token0.transfer(await pair.getAddress(), token0Amount)
    await token1.transfer(await pair.getAddress(), token1Amount)

    const expectedLiquidity = expandTo18Decimals(2)
    await expect(pair.mint(wallet.address))
      .to.emit(pair, 'Transfer')
      .withArgs(ZeroAddress, ZeroAddress, MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Transfer')
      .withArgs(ZeroAddress, wallet.address, expectedLiquidity.valueOf() - BigInt(MINIMUM_LIQUIDITY))
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, 'Mint')
      .withArgs(wallet.address, token0Amount, token1Amount)

    expect(await pair.totalSupply()).to.eq(expectedLiquidity)
    expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity.valueOf() - BigInt(MINIMUM_LIQUIDITY))
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(token0Amount)
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(token1Amount)
    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount)
    expect(reserves[1]).to.eq(token1Amount)
  })

  async function addLiquidity(token0Amount: BigInt, token1Amount: BigInt) {
    await token0.transfer(await pair.getAddress(), token0Amount)
    await token1.transfer(await pair.getAddress(), token1Amount)
    await pair.mint(wallet.address)
  }

  const swapTestCases: BigInt[][] = [
    [1, 5, 10, '300', '1662497915624478906'],
    [1, 10, 5, '300', '453305446940074565'],
    [2, 5, 10, '300', '2851015155847869602'],
    [2, 10, 5, '300', '831248957812239453'],
    [1, 10, 10, '300', '906610893880149131'],
    [1, 100, 100, '300', '987158034397061298'],
    [1, 1000, 1000, '300', '996006981039903216'],

    [1, 5, 10, '150', '1664582812369759106'],
    [1, 10, 5, '150', '453925535300268218'],
    [2, 5, 10, '150', '2854080320137201657'],
    [2, 10, 5, '150', '832291406184879553'],
    [1, 10, 10, '150', '907851070600536436'],
    [1, 100, 100, '150', '988628543988277053'],
    [1, 1000, 1000, '150', '997503992263724670'],

    [1, 5, 10, '2000', '1638795986622073578'],
    [1, 10, 5, '2000', '446265938069216757'],
    [2, 5, 10, '2000', '2816091954022988505'],
    [2, 10, 5, '2000', '819397993311036789'],
    [1, 10, 10, '2000', '892531876138433515'],
    [1, 100, 100, '2000', '970489205783323430'],
    [1, 1000, 1000, '2000', '979040540270534875'],
  ].map((a) => a.map((n) => (typeof n === 'string' ? BigInt(n) : expandTo18Decimals(n))))

  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, async () => {
      const [swapAmount, token0Amount, token1Amount, feePercent, expectedOutputAmount] = swapTestCase
      await pair.setFeePercent(feePercent, 10)
      await addLiquidity(token0Amount, token1Amount)
      await token0.transfer(await pair.getAddress(), swapAmount)

      expect(await pair.getAmountOut(swapAmount, await token0.getAddress())).to.eq(expectedOutputAmount)
      await expect(pair.swap(0, expectedOutputAmount.valueOf() + BigInt(1), wallet.address, '0x')).to.be.revertedWith(
        'KimPair: K',
      )
      await pair.swap(0, expectedOutputAmount, wallet.address, '0x')
    })
  })

  const optimisticTestCases: BigInt[][] = [
    ['997000000000000000', 5, 10, '300', 1], // given amountIn, amountOut = floor(amountIn * .997)
    ['997000000000000000', 10, 5, '300', 1],
    ['997000000000000000', 5, 5, '300', 1],
    [1, 5, 5, '300', '1003009027081243732'], // given amountOut, amountIn = ceiling(amountOut / .997)

    ['998500000000000000', 5, 10, '150', 1], // given amountIn, amountOut = floor(amountIn * .9985)
    ['998500000000000000', 10, 5, '150', 1],
    ['998500000000000000', 5, 5, '150', 1],
    [1, 5, 5, '150', '1001502253380070106'], // given amountOut, amountIn = ceiling(amountOut / .9985)

    ['980000000000000000', 5, 10, '2000', 1], // given amountIn, amountOut = floor(amountIn * .98)
    ['980000000000000000', 10, 5, '2000', 1],
    ['980000000000000000', 5, 5, '2000', 1],
    [1, 5, 5, '2000', '1020408163265306123'], // given amountOut, amountIn = ceiling(amountOut / .98)
  ].map((a) => a.map((n) => (typeof n === 'string' ? BigInt(n) : expandTo18Decimals(n))))
  optimisticTestCases.forEach((optimisticTestCase, i) => {
    it(`optimistic:${i}`, async () => {
      const [outputAmount, token0Amount, token1Amount, feePercent, inputAmount] = optimisticTestCase

      await pair.setFeePercent(feePercent, 10)
      await addLiquidity(token0Amount, token1Amount)
      await token0.transfer(await pair.getAddress(), inputAmount)
      await expect(pair.swap(outputAmount.valueOf() + BigInt(2), 0, wallet.address, '0x')).to.be.revertedWith(
        'KimPair: K',
      )
      await pair.swap(outputAmount, 0, wallet.address, '0x')
    })
  })

  it('swap:token0', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    await pair.setFeePercent(150, 1000)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigInt('1662497915624478906')
    await token0.transfer(await pair.getAddress(), swapAmount)
    await expect(pair.swap(0, expectedOutputAmount, wallet.address, '0x'))
      .to.emit(token1, 'Transfer')
      .withArgs(await pair.getAddress(), wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount.valueOf() + BigInt(swapAmount), token1Amount.valueOf() - BigInt(expectedOutputAmount))
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount.valueOf() + BigInt(swapAmount))
    expect(reserves[1]).to.eq(token1Amount.valueOf() - BigInt(expectedOutputAmount))
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(token0Amount.valueOf() + BigInt(swapAmount))
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(token1Amount.valueOf() - BigInt(expectedOutputAmount))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0.valueOf() - token0Amount.valueOf() - swapAmount.valueOf(),
    )
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1.valueOf() - token1Amount.valueOf().valueOf() + expectedOutputAmount,
    )
  })

  it('swap:token1', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    await pair.setFeePercent(1000, 150)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigInt('453305446940074565')
    await token1.transfer(await pair.getAddress(), swapAmount)
    await expect(pair.swap(expectedOutputAmount, 0, wallet.address, '0x'))
      .to.emit(token0, 'Transfer')
      .withArgs(await pair.getAddress(), wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount.valueOf() - expectedOutputAmount, token1Amount.valueOf() + swapAmount.valueOf())
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, 0, swapAmount, expectedOutputAmount, 0, wallet.address)

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount.valueOf() - expectedOutputAmount)
    expect(reserves[1]).to.eq(token1Amount.valueOf() + swapAmount.valueOf())
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(token0Amount.valueOf() - expectedOutputAmount)
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(token1Amount.valueOf() + swapAmount.valueOf())
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0.valueOf() - token0Amount.valueOf() + expectedOutputAmount,
    )
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1.valueOf() - token1Amount.valueOf() - swapAmount.valueOf(),
    )
  })

  it('burn', async () => {
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0Amount, token1Amount)

    const expectedLiquidity = expandTo18Decimals(3)
    await pair.transfer(await pair.getAddress(), expectedLiquidity.valueOf() - MINIMUM_LIQUIDITY)
    await expect(pair.burn(wallet.address))
      .to.emit(pair, 'Transfer')
      .withArgs(await pair.getAddress(), ZeroAddress, expectedLiquidity.valueOf() - MINIMUM_LIQUIDITY)
      .to.emit(token0, 'Transfer')
      .withArgs(await pair.getAddress(), wallet.address, token0Amount.valueOf() - BigInt(1000))
      .to.emit(token1, 'Transfer')
      .withArgs(await pair.getAddress(), wallet.address, token1Amount.valueOf() - BigInt(1000))
      .to.emit(pair, 'Sync')
      .withArgs(1000, 1000)
      .to.emit(pair, 'Burn')
      .withArgs(
        wallet.address,
        token0Amount.valueOf() - BigInt(1000),
        token1Amount.valueOf() - BigInt(1000),
        wallet.address,
      )

    expect(await pair.balanceOf(wallet.address)).to.eq(0)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(1000)
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(1000)
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0 - BigInt(1000))
    expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1 - BigInt(1000))
  })

  it('feeTo:off', async () => {
    await pair.setFeePercent(300, 300)
    await factory.setFeeTo(ZeroAddress)

    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigInt('996006981039903216')
    await token1.transfer(await pair.getAddress(), swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x')

    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(await pair.getAddress(), expectedLiquidity.valueOf() - MINIMUM_LIQUIDITY)
    await pair.burn(wallet.address)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
  })

  it('feeTo:on', async () => {
    await pair.setFeePercent(1000, 300)
    await factory.setOwnerFeeShare(16666)

    await factory.setFeeTo(other.address)

    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigInt('996006981039903216')
    await token1.transfer(await pair.getAddress(), swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x')

    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(await pair.getAddress(), expectedLiquidity.valueOf() - MINIMUM_LIQUIDITY)
    await pair.burn(wallet.address)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY.valueOf() + BigInt('249750499251388'))
    expect(await pair.balanceOf(other.address)).to.eq('249750499251388')

    // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
    // ...because the initial liquidity amounts were equal
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(BigInt(1000) + BigInt('249501683697445'))
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(BigInt(1000) + BigInt('250000187312969'))
  })
})
