import chai, { expect } from 'chai'
import { Contract, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

import { factoryFixture } from './shared/fixtures'

import { abi as kimPairAbi } from '../artifacts/contracts/KimPair.sol/KimPair.json'

let TEST_ADDRESSES: [string, string]

describe('KimFactory', () => {
  let wallet: Wallet
  let other: Wallet

  let factory: Contract
  let tokenA: Contract
  let tokenB: Contract

  beforeEach(async () => {
    ;[wallet, other] = await ethers.getSigners()
    ;({ factory, tokenA, tokenB } = await loadFixture(factoryFixture))

    TEST_ADDRESSES = [await tokenB.getAddress(), await tokenA.getAddress()]
  })

  it('feeTo, allPairsLength', async () => {
    expect(await factory.feeTo()).to.eq(other.address)
    expect(await factory.owner()).to.eq(wallet.address)
    expect(await factory.allPairsLength()).to.eq(0)
  })

  async function createPair(tokens: [string, string]) {
    await factory.createPair(...tokens)
    const create2Address = await factory.getPair(...tokens)

    await expect(factory.createPair(...tokens)).to.be.reverted // UniswapV2: PAIR_EXISTS
    await expect(factory.createPair(...tokens.slice().reverse())).to.be.reverted // UniswapV2: PAIR_EXISTS
    expect(await factory.getPair(...tokens)).to.eq(create2Address)
    expect(await factory.getPair(...tokens.slice().reverse())).to.eq(create2Address)
    expect(await factory.allPairs(0)).to.eq(create2Address)
    expect(await factory.allPairsLength()).to.eq(1)

    const pair = new Contract(create2Address, kimPairAbi, wallet)
    expect(await pair.factory()).to.eq(await factory.getAddress())
    expect(await pair.token0()).to.eq(TEST_ADDRESSES[1])
    expect(await pair.token1()).to.eq(TEST_ADDRESSES[0])
  }

  it('createPair', async () => {
    await createPair(TEST_ADDRESSES)
  })

  it('createPair:reverse', async () => {
    await createPair(TEST_ADDRESSES.slice().reverse() as [string, string])
  })

  it('createPair:gas', async () => {
    const tx = await factory.createPair(...TEST_ADDRESSES)
    const receipt = await tx.wait()

    // Coverage distorts gas consumption
    if (!process.env.HARHDAT_COVERAGE) {
      expect(receipt.gasUsed).to.eq(3611062)
    }
  })

  it('setFeeTo', async () => {
    await expect(factory.connect(other).setFeeTo(other.address)).to.be.revertedWith(
      'KimFactory: caller is not the owner',
    )
    await factory.setFeeTo(wallet.address)
    expect(await factory.feeTo()).to.eq(wallet.address)
  })
})
