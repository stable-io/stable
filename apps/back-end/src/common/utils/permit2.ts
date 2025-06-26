import { Usdc } from "@stable-io/cctp-sdk-definitions";
import type { Permit2TypedData, EvmAddress } from "@stable-io/cctp-sdk-evm";
import { dateToUnixTimestamp } from "@stable-io/cctp-sdk-evm";
import { PublicClient } from "viem";

export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const maxUint256 = 2n ** 256n - 1n;
export type Permit2Nonce = bigint;

/**
 * Note: Spender and transfer details are provided separately when calling
 * permitTransferFrom - not signed by user.
 */
export const composePermit2Msg = (
  chainId: bigint,
  tokenAddress: EvmAddress,
  amount: Usdc,
  nonce: bigint,
  deadline: Date | "infinity" = "infinity",
) =>
  ({
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      PermitTransferFrom: [
        { name: "permitted", type: "TokenPermissions" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
      TokenPermissions: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    },
    primaryType: "PermitTransferFrom",
    domain: {
      name: "Permit2",
      version: "1",
      chainId,
      verifyingContract: PERMIT2_ADDRESS,
    },
    message: {
      permitted: {
        token: tokenAddress.unwrap(),
        amount: amount.toUnit("atomic"),
      },
      nonce,
      deadline:
        deadline === "infinity" ? maxUint256 : dateToUnixTimestamp(deadline),
    },
  }) as const satisfies Permit2TypedData;

const PERMIT2_NONCE_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "uint256", "name": "wordPos", "type": "uint256" }
    ],
    "name": "nonceBitmap",
    "outputs": [{ "internalType": "uint256", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const PERMIT2_CCTPR_NONCE_OFFSET = (2n ** 128n) + (2n ** 64n);

export async function fetchPermit2NonceBitmap(
  client: PublicClient,
  owner: EvmAddress,
  index: bigint,
): Promise<Permit2Nonce> {
  return await client.readContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_NONCE_ABI,
    functionName: "nonceBitmap",
    args: [owner.toString(), index],
  });
}

export async function nextAvailablePermit2Nonce(
  fetchNonce: (index: bigint) => Promise<Permit2Nonce>,
  startingIndex: bigint,
): Promise<Permit2Nonce> {
  let index = startingIndex;
  let inc = 1n;
  let nonce = maxUint256;
  // We search with exponential backoff until we find a nonce that is not maxUint256
  while (true) {
    nonce = await fetchNonce(index);
    if (nonce !== maxUint256) {
      break;
    }
    index += inc;
    inc <<= 1n;
  }
  // Now we need to do binary search between index and the previous checked index
  for (let low = index - (inc >> 1n), high = index; low !== high;) {
    index = low + (high - low + 1n) / 2n;
    nonce = await fetchNonce(index);
    if (nonce === 0n) {
      high = index - 1n;
    } else if (nonce === maxUint256) {
      low = index;
    } else {
      break;
    }
  }
  if (nonce === maxUint256) {
    return (index + 1n) << 8n;
  }
  if (nonce === 0n) {
    return index << 8n;
  }
  return (index << 8n) + BigInt(nonce.toString(2).length);
}

export async function fetchNextPermit2Nonce(
  client: PublicClient,
  owner: EvmAddress,
): Promise<Permit2Nonce> {
  const fetchNonce = async (index: bigint) => {
    return fetchPermit2NonceBitmap(client, owner, index);
  };
  return nextAvailablePermit2Nonce(fetchNonce, PERMIT2_CCTPR_NONCE_OFFSET);
}