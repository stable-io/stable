import type { CallData, EvmAddress } from "@stable-io/cctp-sdk-evm";
import { encoding } from "@stable-io/utils";
import { encodeFunctionData, parseAbiItem } from "viem";

import type { ParsedSignature } from "../types";

export const eip2612PermitAbi = parseAbiItem(
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
);

export const encodePermitCall = (
  owner: EvmAddress,
  spender: EvmAddress,
  value: bigint,
  deadline: bigint,
  signature: ParsedSignature,
): CallData => {
  const hexData = encodeFunctionData({
    abi: [eip2612PermitAbi],
    functionName: "permit",
    args: [
      owner.unwrap(),
      spender.unwrap(),
      value,
      deadline,
      Number(signature.v),
      encoding.hex.encode(signature.r, true),
      encoding.hex.encode(signature.s, true),
    ],
  });
  return encoding.hex.decode(hexData) as CallData;
};
