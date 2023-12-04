import { Contract } from 'ethers'
import { ethers } from 'hardhat'

import { expandTo18Decimals } from './utilities'

import { abi as kizunaPairAbi } from '../../artifacts/contracts/KizunaPair.sol/KizunaPair.json'

export interface FactoryFixture {
  factory: Contract
  tokenA: Contract
  tokenB: Contract
}

export async function factoryFixture(): Promise<FactoryFixture> {
  const [_, other] = await ethers.getSigners()

  const kizunaFactory = await ethers.getContractFactory('KizunaFactory')
  const factory = await kizunaFactory.deploy(other)

  const tokenAFactory = await ethers.getContractFactory('ERC20')
  const tokenA = await tokenAFactory.deploy(expandTo18Decimals(10000))

  const tokenBFactory = await ethers.getContractFactory('ERC20')
  const tokenB = await tokenBFactory.deploy(expandTo18Decimals(10000))

  return { factory, tokenA, tokenB }
}

interface PairFixture extends FactoryFixture {
  token0: Contract
  token1: Contract
  pair: Contract
}

export async function pairFixture(): Promise<PairFixture> {
  const { factory, tokenA, tokenB } = await factoryFixture()

  const [wallet, other] = await ethers.getSigners()

  await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress())
  const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress())
  const pair = new Contract(pairAddress, kizunaPairAbi, wallet).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  return { factory, tokenA, tokenB, token0, token1, pair }
}
