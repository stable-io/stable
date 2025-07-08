import type { EvmGasToken } from "@stable-io/cctp-sdk-definitions";
import type { EvmAddress, CallData } from "@stable-io/cctp-sdk-evm";
import { encoding } from "@stable-io/utils";
import { encodeFunctionData, parseAbiItem } from "viem";

export const multicall3Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const multicall3Aggregate3ValueAbi = parseAbiItem(
  "function aggregate3Value((address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
);

export interface Call3Value {
  target: EvmAddress;
  allowFailure: boolean;
  value: EvmGasToken;
  callData: CallData;
}

export const encodeAggregate3ValueCall = (
  calls: readonly Call3Value[],
): CallData => {
  const hexData = encodeFunctionData({
    abi: [multicall3Aggregate3ValueAbi],
    functionName: "aggregate3Value",
    args: [
      calls.map((call) => ({
        ...call,
        value: call.value.toUnit("atomic"),
        target: call.target.unwrap(),
        callData: encoding.hex.encode(call.callData, true),
      })),
    ],
  });
  return encoding.hex.decode(hexData) as CallData;
};
