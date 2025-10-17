// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { platformClient, type Network } from "@stable-io/cctp-sdk-definitions";
import { avaxRouterContractAddress } from "@stable-io/cctp-sdk-cctpr-definitions";
import { Route, SDK, Hex, SupportedRoute } from "../../types/index.js";

import { executeRouteSteps } from "./executeRouteSteps.js";
import { CctpAttestation, findTransferAttestation } from "./findTransferAttestation.js";
import { findTransferReceive } from "./findTransferReceive.js";
import { Receive } from "src/types/receive.js";

export type ExecuteRouteDeps<N extends Network> = Pick<SDK<N>, "getNetwork" | "getRpcUrl" | "getSigner">;

export const $executeRoute =
  <N extends Network>({
    getSigner,
    getNetwork,
    getRpcUrl,
  }: ExecuteRouteDeps<N>): SDK<N>["executeRoute"] =>
  async (route: SupportedRoute<N>) => {
    const { sourceChain } = route.intent;
    const signer = await getSigner(sourceChain);

    if (signer === undefined) {
      throw new Error(`Signer not set for domain: ${sourceChain}`);
    }

    const network = getNetwork();
    const rpcUrl = getRpcUrl(sourceChain);
    const client = platformClient(
      network,
      sourceChain,
      rpcUrl,
    );

    route.progress.emit("transfer-initiated", { intent: route.intent });

    const transactions = await executeRouteSteps(network, route, signer, client).catch(
      (error: unknown) => {
        route.progress.emit("error", { type: "transfer-failed", details: undefined });
        throw error;
      },
    );

    const transferTx = transactions.at(-1)! as Hex; // there's always 1 or 2 hashes.

    const attestations = [] as CctpAttestation[];
    const receiveTxs = [] as Receive[];

    const attestation = await findTransferAttestation(
      network,
      sourceChain,
      transferTx,
      { baseDelayMs: 50, maxDelayMs: 350, timeoutMs: 1800000 },
    );
    attestations.push(attestation);
    route.progress.emit("transfer-confirmed", attestation);

    const avaxRouterAddress = avaxRouterContractAddress[network];

    const isAvaxHop = attestation.destinationCaller === avaxRouterAddress &&
      attestation.targetDomain === "Avalanche";

    /**
     * Note that we use attestation.targetChain to find the receipt
     * because in the case of avax hop, there's an intermediate
     * receipt on avalanche.
     */
    const receive = await findTransferReceive(
      network,
      getRpcUrl(attestation.targetDomain),
      attestation,
      { timeoutMs: 180000 },
    ).catch((error: unknown) => {
      route.progress.emit("error", { type: "receive-failed", details: { txHash: transferTx } });
      throw error;
    });
    receiveTxs.push(receive);

    /**
     * If it's avax hop, then we have receipt the first
     * leg of the avax hop, and we need to find the second
     * transfer.
     *
     * Note that:
     * - "transfer-confirmed" is emitted when circle attests the first
     *   leg since this materializes the transfer.
     * - "transfer-received", in contrast, is emitted when the transfer
     *   makes it to the target user, which means after the second
     *   transaction in the avax-hop case.
     */
    if (isAvaxHop) {
      route.progress.emit("hop-received", receive);

      const secondHopAttestation = await findTransferAttestation(
        network,
        attestation.targetDomain,
        receive.transactionHash,
        { baseDelayMs: 50, maxDelayMs: 350 },
      ).catch((error: unknown) => {
        route.progress.emit("error", {
          type: "attestation-failed",
          details: { txHash: receive.transactionHash },
        });

        throw error;
      });

      attestations.push(secondHopAttestation);
      route.progress.emit("hop-confirmed", secondHopAttestation); // uses hop attestation

      const secondHopReceive = await findTransferReceive(
        network,
        getRpcUrl(secondHopAttestation.targetDomain),
        secondHopAttestation,
        { timeoutMs: 180000 },
      ).catch((error: unknown) => {
        route.progress.emit("error", { type: "receive-failed", details: { txHash: receive.transactionHash } });
        throw error;
      });

      receiveTxs.push(secondHopReceive);
      route.progress.emit("transfer-received", secondHopReceive);
    }

    else {
      route.progress.emit("transfer-received", receive);
    }

    return {
      transactions,
      attestations,
      receiveTxs,
      transferHash: transactions.at(-1)!,
      receiveHash: receiveTxs.at(-1)!.transactionHash,
    };
  };
