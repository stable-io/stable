// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { encoding } from "@stable-io/utils";
import { composePermitMsg, EvmAddress, permit2Address, Eip2612Data } from "@stable-io/cctp-sdk-evm";
import type { Permit2GaslessData } from "@stable-io/cctp-sdk-cctpr-evm";
import { Network } from "src/types/general.js";
import type { PlatformClient, RegisteredPlatform } from "@stable-io/cctp-sdk-definitions";
import { usdc, usdcContracts } from "@stable-io/cctp-sdk-definitions";
import type { LoadedCctprPlatformDomain, SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";

import { Intent } from "../types/index.js";
import { postTransferRequest } from "../api/gasless.js";
import { GaslessTransferData, SolanaGaslessTransfer } from "src/methods/findRoutes/steps.js";
import { getTransactionEncoder } from "@solana/kit";
import { SignableEncodedBase64Message } from "@stable-io/cctp-sdk-cctpr-solana";

export async function* transferWithGaslessRelay<
  N extends Network,
  P extends RegisteredPlatform,
  S extends LoadedCctprPlatformDomain<N, P>,
  D extends SupportedDomain<N>,
>(
  client: PlatformClient<N, P, S>,
  network: N,
  intent: Intent<N, S, D>,
  jwt: string,
  permit2RequiresAllowance: boolean,
  opts: {
    permit2GaslessData?: Permit2GaslessData;
    encodedSolanaTx?: SignableEncodedBase64Message;
  },
): AsyncGenerator<
  Eip2612Data |
  GaslessTransferData |
  Permit2GaslessData |
  SignableEncodedBase64Message |
  SolanaGaslessTransfer,
  any,
  any
> {
  const args: any = {};
  if (permit2RequiresAllowance) {
    const usdcAddress = new EvmAddress(
      usdcContracts.contractAddressOf[network][intent.sourceChain],
    );
    const permit2Addr = new EvmAddress(permit2Address);
    const maxUint256Usdc = usdc(2n ** 256n - 1n, "atomic");
    args.permit = yield composePermitMsg(network)(
      client, usdcAddress, intent.sender as EvmAddress, permit2Addr, maxUint256Usdc,
    );
  }

  if (intent.sourceChain === "Solana") {
    const signedMsg = yield opts.encodedSolanaTx!;
    const encodedMsg = getTransactionEncoder().encode(signedMsg) as Uint8Array;
    args.encodedSolanaTx = encoding.base64.encode(encodedMsg);
  }
  else
    args.permit2Signature = (yield opts.permit2GaslessData!).signature;

  const { txHash } = await postTransferRequest(network, { jwt, ...args });

  if (intent.sourceChain === "Solana") {
    yield {
      solanaTxHash: txHash,
      gasDropOff: intent.gasDropoffDesired.toUnit("atomic"),
      amount: intent.amount,
      recipient: intent.recipient.toString(),
    } as SolanaGaslessTransfer;
  }

  return {
    txHash,
    ...(intent.sourceChain === "Solana" ?
      { encodedSolanaTx: args.encodedSolanaTx } :
      { permit2GaslessData: opts.permit2GaslessData,
        permit2Signature: encoding.hex.encode(args.permit2Signature, true),
        ...args.permit }
    ),
  };
}
