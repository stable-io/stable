// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Permit } from "@stable-io/cctp-sdk-evm";
import { ViemEvmClient, viemChainOf } from "@stable-io/cctp-sdk-viem";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { evmGasToken } from "@stable-io/cctp-sdk-definitions";
import { isContractTx, Route, SDK, TxHash, isEip2612Data } from "../types/index.js";
import { encoding } from "@stable-io/utils";

const fromGwei = (gwei: number) => evmGasToken(gwei, "nEvmGasToken").toUnit("atomic");

export type ExecuteRouteDeps<N extends Network> = Pick<SDK<N>, "getNetwork" | "getRpcUrl" | "getSigner">;

export const $executeRoute =
  <N extends Network>({
    getSigner,
    getNetwork,
    getRpcUrl,
  }: ExecuteRouteDeps<N>): SDK<N>["executeRoute"] =>
  async (route: Route) => {
    const signer = await getSigner(route.intent.sourceChain);
    const network = getNetwork();
    const { sourceChain } = route.intent;
    const rpcUrl = getRpcUrl(sourceChain);
    const client = ViemEvmClient.fromNetworkAndDomain(
      network,
      sourceChain,
      rpcUrl,
    );
    const viemChainId = viemChainOf[network][sourceChain].id;

    const txHashes = [] as string[];
    let lastResult: Permit | TxHash | undefined;
    while (true) {
      const { value: txOrSig, done } = await route.workflow.next(lastResult);

      if (isContractTx(txOrSig)) {
        const callData = `0x${Buffer.from(txOrSig.data).toString("hex")}` as const;
        const txValue = txOrSig.value
          ? BigInt(txOrSig.value.toUnit("atomic").toString())
          : undefined;
        await signer.switchChain({ id: viemChainId });
        const tx = await signer.sendTransaction({
          from: txOrSig.from?.unwrap(),
          value: txValue,
          chain: signer.chain,
          account: signer.account!,
          to: txOrSig.to.unwrap(),
          data: callData,
          /**
           * @todo: Proper gas calculation will be necessary at some point...
           *        we could consider using the gasEstimation field of the corresponding step.
           */
          gas: fromGwei(0.001),
          maxFeePerGas: fromGwei(40),
          maxPriorityFeePerGas: fromGwei(15),
        });

        await client.client.waitForTransactionReceipt({ hash: tx });
        txHashes.push(tx);
        lastResult = undefined;
      } else if (isEip2612Data(txOrSig)) {
        await signer.switchChain({ id: viemChainId });
        const signature = await signer.signTypedData({
          account: signer.account!,
          ...txOrSig,
        });

        lastResult = {
          signature: Buffer.from(encoding.stripPrefix("0x", signature), "hex"),
          // It's possible to overrides the following values by changing them
          // before signing the message.
          // We need to pass them back to the cctp-sdk so that it can know
          // what changes we made.
          // We don't modify them rn, so we give it back what it gave us.
          value: txOrSig.message.value,
          deadline: txOrSig.message.deadline,
        };
      }

      if (done) break;
    }

    return txHashes;
  };
