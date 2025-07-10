// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { avaxRouterContractAddress } from "@stable-io/cctp-sdk-cctpr-definitions";
import { Route, SDK, Hex, SupportedRoute } from "../../types/index.js";

import { executeRouteSteps } from "./executeRouteSteps.js";
import { CctpAttestation, findTransferAttestation } from "./findTransferAttestation.js";
import { findTransferRedeem } from "./findTransferRedeem.js";
import { Redeem } from "src/types/redeem.js";

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
    const network = getNetwork();
    const rpcUrl = getRpcUrl(sourceChain);
    const client = ViemEvmClient.fromNetworkAndDomain(
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
    const redeems = [] as Redeem[];

    const attestation = await findTransferAttestation(
      network,
      sourceChain,
      transferTx,
    );
    attestations.push(attestation);
    route.progress.emit("transfer-confirmed", attestation);

    const avaxRouterAddress = avaxRouterContractAddress[network];

    const isAvaxHop = attestation.destinationCaller === avaxRouterAddress &&
      attestation.targetDomain === "Avalanche";

    /**
     * Note that we use attestation.targetChain to find the redeem
     * because in the case of avax hop, there's an intermediate
     * redeem on avalanche.
     */
    const redeem = await findTransferRedeem(
      network,
      getRpcUrl(attestation.targetDomain),
      attestation,
    ).catch((error: unknown) => {
      route.progress.emit("error", { type: "receive-failed", details: { txHash: transferTx } });
      throw error;
    });
    redeems.push(redeem);

    /**
     * If it's avax hop, then we have redeemed the first
     * leg of the avax hop, and we need to find the second
     * transfer.
     *
     * Note that:
     * - "transfer-confirmed" is emitted when circle attests the first
     *   leg since this materializes the transfer.
     * - "transfer-redeemed", in contrast, is emitted when the transfer
     *   makes it to the target user, which means after the second
     *   transaction in the avax-hop case.
     */
    if (isAvaxHop) {
      route.progress.emit("hop-redeemed", redeem); // uses redeem

      const secondHopAttestation = await findTransferAttestation(
        network,
        attestation.targetDomain,
        redeem.transactionHash,
        { baseDelayMs: 50, maxDelayMs: 350 }
      ).catch((error: unknown) => {
        route.progress.emit("error", {
          type: "attestation-failed",
          details: { txHash: redeem.transactionHash },
        });

        throw error;
      });

      attestations.push(secondHopAttestation);
      route.progress.emit("hop-confirmed", secondHopAttestation); // uses hop attestation

      const secondHopRedeem = await findTransferRedeem(
        network,
        getRpcUrl(secondHopAttestation.targetDomain),
        secondHopAttestation,
      ).catch((error: unknown) => {
        route.progress.emit("error", { type: "receive-failed", details: { txHash: redeem.transactionHash } });
        throw error;
      });

      redeems.push(secondHopRedeem);
      route.progress.emit("transfer-redeemed", secondHopRedeem); // uses hopRedeem
    }

    else {
      route.progress.emit("transfer-redeemed", redeem); // uses redeem
    }

    return {
      transactions,
      attestations,
      redeems,
      transferHash: transactions.at(-1)!,
      redeemHash: redeems.at(-1)!.transactionHash,
    };
  };
