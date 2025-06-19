import { Usdc } from "@stable-io/cctp-sdk-definitions";
import type { Eip712Data, EvmAddress } from "@stable-io/cctp-sdk-evm";
import { dateToUnixTimestamp } from "@stable-io/cctp-sdk-evm";

export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

export interface Permit2TransferFromMessage {
  readonly permitted: {
    readonly token: string;
    readonly amount: bigint;
  };
  readonly nonce: bigint;
  readonly deadline: bigint;
}

export type Permit2TypedData = Eip712Data<Permit2TransferFromMessage>;

const maxUint256 = 2n ** 256n - 1n;

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
