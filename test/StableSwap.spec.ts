import { expect } from 'chai'
import { Contract, Wallet, ZeroAddress } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import { expandTo18Decimals } from './shared/utilities'
import { pairFixture } from './shared/fixtures'

const MINIMUM_LIQUIDITY = BigInt(10) ** BigInt(3)

describe('StableSwap', () => {
  let wallet: Wallet
  let other: Wallet

  let factory: Contract
  let token0: Contract
  let token1: Contract
  let pair: Contract

  beforeEach(async function () {
    ;[wallet, other] = await ethers.getSigners()
    ;({ factory, token0, token1, pair } = await loadFixture(pairFixture))

    await pair.setStableSwap(1, 0, 0)
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
      .withArgs(ZeroAddress, wallet.address, BigInt(expectedLiquidity.valueOf()) - MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, 'Mint')
      .withArgs(wallet.address, token0Amount, token1Amount)

    expect(await pair.totalSupply()).to.eq(expectedLiquidity)
    expect(await pair.balanceOf(wallet.address)).to.eq(BigInt(expectedLiquidity.valueOf()) - MINIMUM_LIQUIDITY)
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
    ['1037735021512657182', 5, 10, '300', '1075925078216824025'],

    [1, 5, 10, '300', '1037735021512657082'],
    [1, 10, 5, '300', '879102952348394399'],
    [2, 5, 10, '300', '2040447202689539242'],
    [2, 10, 5, '300', '1641099839970880405'],
    [1, 10, 10, '300', '996506480231247732'],
    [1, 100, 100, '300', '996999505973545383'],
    [1, 1000, 1000, '300', '996999999505973054'],

    [1, 5, 10, '150', '1039258534528237632'],
    [1, 10, 5, '150', '880344816931417981'],
    [2, 5, 10, '150', '2043448803392768537'],
    [2, 10, 5, '150', '1643192941133600364'],
    [1, 10, 10, '150', '998003505824045195'],
    [1, 100, 100, '150', '998499502993753372'],
    [1, 1000, 1000, '150', '998499999502993257'],

    [1, 5, 10, '2000', '1020463437669921196'],
    [1, 10, 5, '2000', '865009639720007212'],
    [2, 5, 10, '2000', '2006426863309605048'],
    [2, 10, 5, '2000', '1617292406052557856'],
    [1, 10, 10, '2000', '979539265327886123'],
    [1, 100, 100, '2000', '979999538816355657'],
    [1, 1000, 1000, '2000', '979999999538815920'],
  ].map((a) => a.map((n) => (typeof n === 'string' ? BigInt(n) : expandTo18Decimals(n))))

  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, async () => {
      const [swapAmount, token0Amount, token1Amount, feePercent, expectedOutputAmount] = swapTestCase
      await pair.setFeePercent(feePercent, 100)
      await addLiquidity(token0Amount, token1Amount)
      await token0.transfer(await pair.getAddress(), swapAmount)

      expect(await pair.getAmountOut(swapAmount, await token0.getAddress())).to.eq(expectedOutputAmount)
      await expect(
        pair.swap(0, BigInt(expectedOutputAmount.valueOf()) + BigInt(1), wallet.address, '0x'),
      ).to.be.revertedWith('KizunaPair: K')
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

      await pair.setFeePercent(feePercent, 100)
      await addLiquidity(token0Amount, token1Amount)
      await token0.transfer(await pair.getAddress(), inputAmount)
      await expect(pair.swap(BigInt(outputAmount.valueOf()) + BigInt(2), 0, wallet.address, '0x')).to.be.revertedWith(
        'KizunaPair: K',
      )
      await pair.swap(outputAmount, 0, wallet.address, '0x')
    })
  })

  it('swap:token0', async () => {
    await factory.setFeeTo(ZeroAddress) // Test without taking care of fees

    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    await pair.setFeePercent(150, 1000)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigInt('1037735021512657082')
    await token0.transfer(await pair.getAddress(), swapAmount)
    await expect(pair.swap(0, expectedOutputAmount, wallet.address, '0x'))
      .to.emit(token1, 'Transfer')
      .withArgs(await pair.getAddress(), wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount.valueOf() + swapAmount.valueOf(), token1Amount.valueOf() - expectedOutputAmount.valueOf())
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount.valueOf() + swapAmount.valueOf())
    expect(reserves[1]).to.eq(token1Amount.valueOf() - expectedOutputAmount.valueOf())
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(token0Amount.valueOf() + swapAmount.valueOf())
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(
      token1Amount.valueOf() - expectedOutputAmount.valueOf(),
    )
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0 - token0Amount.valueOf() - swapAmount.valueOf(),
    )
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1 - token1Amount.valueOf() + expectedOutputAmount.valueOf(),
    )
  })

  it('swap:token1', async () => {
    await factory.setFeeTo(ZeroAddress) // Test without taking care of fees

    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    await pair.setFeePercent(1000, 150)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigInt('879102952348394399')
    await token1.transfer(await pair.getAddress(), swapAmount)
    await expect(pair.swap(expectedOutputAmount, 0, wallet.address, '0x'))
      .to.emit(token0, 'Transfer')
      .withArgs(await pair.getAddress(), wallet.address, expectedOutputAmount)
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount.valueOf() - expectedOutputAmount.valueOf(), token1Amount.valueOf() + swapAmount.valueOf())
      .to.emit(pair, 'Swap')
      .withArgs(wallet.address, 0, swapAmount, expectedOutputAmount, 0, wallet.address)

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount.valueOf() - expectedOutputAmount.valueOf())
    expect(reserves[1]).to.eq(token1Amount.valueOf() + swapAmount.valueOf())
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(
      token0Amount.valueOf() - expectedOutputAmount.valueOf(),
    )
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(token1Amount.valueOf() + swapAmount.valueOf())
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(
      totalSupplyToken0 - token0Amount.valueOf() + expectedOutputAmount.valueOf(),
    )
    expect(await token1.balanceOf(wallet.address)).to.eq(
      totalSupplyToken1 - token1Amount.valueOf() - swapAmount.valueOf(),
    )
  })

  it('burn', async () => {
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0Amount, token1Amount)

    const expectedLiquidity = expandTo18Decimals(3)
    await pair.transfer(await pair.getAddress(), expectedLiquidity.valueOf() - MINIMUM_LIQUIDITY.valueOf())
    await expect(pair.burn(wallet.address))
      .to.emit(pair, 'Transfer')
      .withArgs(await pair.getAddress(), ZeroAddress, expectedLiquidity.valueOf() - MINIMUM_LIQUIDITY.valueOf())
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
    const expectedOutputAmount = BigInt('996999999505973054')
    await token1.transfer(await pair.getAddress(), swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x')

    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(await pair.getAddress(), expectedLiquidity.valueOf() - BigInt(MINIMUM_LIQUIDITY))
    await pair.burn(wallet.address)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
  })

  it('feeTo:on', async () => {
    await pair.setFeePercent(300, 300)
    await factory.setOwnerFeeShare(16666)

    await factory.setFeeTo(other.address)

    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = BigInt('996999999505973054')
    await token1.transfer(await pair.getAddress(), swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x')

    // Fees directly minted to feeTo
    expect(await token0.balanceOf(other.address)).to.eq(BigInt(0))
    expect(await token1.balanceOf(other.address)).to.eq(BigInt(499980000000000)) // 0.003 * 0.16666 * 1 = 0,00049998

    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(await pair.getAddress(), expectedLiquidity.valueOf() - BigInt(MINIMUM_LIQUIDITY))
    await pair.burn(wallet.address)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)

    // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
    // ...because the initial liquidity amounts were equal
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(BigInt(1000))
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(BigInt(1001))
  })

  describe('From UNI to Stable', () => {
    it('mint', async () => {
      const token0Amount = expandTo18Decimals(1000)
      const token1Amount = expandTo18Decimals(1000)

      const expectedLiquidity = expandTo18Decimals(1000)
      await addLiquidity(token0Amount, token1Amount)
      expect(await pair.totalSupply()).to.eq(expectedLiquidity)

      await pair.setStableSwap(0, token0Amount, token1Amount)
      await addLiquidity(token0Amount, token1Amount)
      // expect same amount of LP minted
      expect(await pair.totalSupply()).to.eq(expectedLiquidity.valueOf() * BigInt(2))
    })

    it('burn', async () => {
      const token0Amount = expandTo18Decimals(1000)
      const token1Amount = expandTo18Decimals(1000)

      await addLiquidity(token0Amount, token1Amount)

      await pair.transfer(await pair.getAddress(), expandTo18Decimals(100))
      await pair.burn(other.address)
      expect(await token0.balanceOf(other.address)).to.eq(expandTo18Decimals(100))
      expect(await token1.balanceOf(other.address)).to.eq(expandTo18Decimals(100))

      await pair.setStableSwap(
        0,
        token0Amount.valueOf() - expandTo18Decimals(100).valueOf(),
        token1Amount.valueOf() - expandTo18Decimals(100).valueOf(),
      )
      await pair.transfer(await pair.getAddress(), expandTo18Decimals(100))
      await pair.burn(other.address)
      expect(await token0.balanceOf(other.address)).to.eq(expandTo18Decimals(100).valueOf() * BigInt(2))
      expect(await token1.balanceOf(other.address)).to.eq(expandTo18Decimals(100).valueOf() * BigInt(2))
    })

    it('swap', async () => {
      const token0Amount = expandTo18Decimals(1000)
      const token1Amount = expandTo18Decimals(1000)

      await factory.setOwnerFeeShare(100000)
      await pair.setFeePercent(100, 100)
      await addLiquidity(token0Amount, token1Amount)

      const swapAmount = expandTo18Decimals(1)
      let expectedOutputAmount = await pair.getAmountOut(swapAmount, await token1.getAddress())
      await token1.transfer(await pair.getAddress(), swapAmount)
      await pair.swap(expectedOutputAmount, 0, wallet.address, '0x')

      const fee = (swapAmount.valueOf() * BigInt('100')) / BigInt('100000')
      await pair.setStableSwap(
        0,
        token0Amount.valueOf() - expectedOutputAmount,
        token1Amount.valueOf() + swapAmount.valueOf() - fee,
      )

      expectedOutputAmount = await pair.getAmountOut(swapAmount, await token1.getAddress())
      await token1.transfer(await pair.getAddress(), swapAmount)
      await pair.swap(expectedOutputAmount, 0, wallet.address, '0x')
    })
  })
})
