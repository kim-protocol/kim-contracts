import { Contract, keccak256, getAddress, toUtf8Bytes, AbiCoder, solidityPacked } from 'ethers'

const PERMIT_TYPEHASH = keccak256(
  toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'),
)

export function expandTo18Decimals(n: number): BigInt {
  return BigInt(n) * BigInt(10) ** BigInt(18)
}

function getDomainSeparator(name: string, tokenAddress: string) {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
        keccak256(toUtf8Bytes(name)),
        keccak256(toUtf8Bytes('1')),
        1,
        tokenAddress,
      ],
    ),
  )
}

export function getCreate2Address(
  factoryAddress: string,
  [tokenA, tokenB]: [string, string],
  bytecode: string,
): string {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
  const create2Inputs = [
    '0xff',
    getAddress(factoryAddress),
    keccak256(solidityPacked(['address', 'address'], [getAddress(token0), getAddress(token1)])),
    keccak256(bytecode),
  ]
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
  return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`)
}

export async function getApprovalDigest(
  token: Contract,
  approve: {
    owner: string
    spender: string
    value: BigInt
  },
  nonce: BigInt,
  deadline: BigInt,
): Promise<string> {
  const name = await token.name()
  const DOMAIN_SEPARATOR = getDomainSeparator(name, await token.getAddress())
  return keccak256(
    solidityPacked(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      [
        '0x19',
        '0x01',
        DOMAIN_SEPARATOR,
        keccak256(
          AbiCoder.defaultAbiCoder().encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline],
          ),
        ),
      ],
    ),
  )
}

export function encodePrice(reserve0: BigInt, reserve1: BigInt): [BigInt, BigInt] {
  return [
    (reserve1.valueOf() * BigInt(2) ** BigInt(112)) / reserve0.valueOf(),
    (reserve0.valueOf() * BigInt(2) ** BigInt(112)) / reserve1.valueOf(),
  ]
}
