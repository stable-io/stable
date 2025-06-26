import { Usdc } from "@stable-io/cctp-sdk-definitions";
import type { Permit2TypedData, EvmAddress } from "@stable-io/cctp-sdk-evm";
import { dateToUnixTimestamp } from "@stable-io/cctp-sdk-evm";
import { Brand } from "@stable-io/utils";
import { PublicClient } from "viem";

export type Permit2Nonce = Brand<bigint, "Permit2Nonce">;
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const maxUint256 = 2n ** 256n - 1n;
const mostSignificantBit = 1n << 255n;

const PERMIT2_NONCE_ABI = [
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint256", name: "wordPos", type: "uint256" },
    ],
    name: "nonceBitmap",
    outputs: [{ internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const PERMIT2_CCTPR_NONCE_START = 2n ** 128n + 2n ** 64n;
const PERMIT2_NONCE_INDEX_SHIFT = 8n;

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
  }) as Permit2Nonce;
}

export async function nextAvailablePermit2Nonce(
  fetchNonce: (index: bigint) => Promise<Permit2Nonce>,
  startingIndex: bigint,
): Promise<Permit2Nonce> {
  let index = startingIndex;
  let inc = 1n;
  let nonce = maxUint256;
  // We search with exponential backoff until we find a nonce has not set the most significant bit
  while (true) {
    nonce = await fetchNonce(index);
    if (!(nonce & mostSignificantBit)) break;
    index += inc;
    inc <<= 1n;
  }
  // Now we need to do binary search between index and the previous checked index
  for (let low = index - (inc >> 1n), high = index; low !== high; ) {
    index = low + (high - low + 1n) / 2n;
    nonce = await fetchNonce(index);
    if (nonce === 0n) {
      high = index - 1n;
    } else if (nonce & mostSignificantBit) {
      low = index;
    } else {
      break;
    }
  }
  if (nonce & mostSignificantBit) return (index + 1n) << PERMIT2_NONCE_INDEX_SHIFT as Permit2Nonce;
  if (nonce === 0n) return index << PERMIT2_NONCE_INDEX_SHIFT as Permit2Nonce;
  return (index << PERMIT2_NONCE_INDEX_SHIFT) + BigInt(nonce.toString(2).length) as Permit2Nonce;
}

export async function fetchNextPermit2Nonce(
  client: PublicClient,
  owner: EvmAddress,
  nonceHint?: Permit2Nonce,
): Promise<Permit2Nonce> {
  const fetchNonce = async (index: bigint) => fetchPermit2NonceBitmap(client, owner, index);
  const startingIndex = (nonceHint ?? PERMIT2_CCTPR_NONCE_START) >> PERMIT2_NONCE_INDEX_SHIFT;
  return nextAvailablePermit2Nonce(fetchNonce, startingIndex);
}
