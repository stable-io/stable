// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  Corridor,
  CorridorStats,
  SupportedEvmDomain,
} from "@stable-io/cctp-sdk-cctpr-evm";
import {
  EvmDomains,
  GasTokenOf,
  Usdc,
} from "@stable-io/cctp-sdk-definitions";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { TODO } from "@stable-io/utils";

import { TransferProgressEmitter } from "../../../progressEmitter.js";
import { TransactionEmitter } from "../../../transactionEmitter.js";
import { transferWithGaslessRelaying } from "../../../gasless/transfer.js"; 

import type {
  Fee,
  RouteExecutionStep,
  Network,
  Intent,
} from "../../../types/index.js";
import { RouteWithoutEstimates } from "../types.js";


export async function buildPermitRoute<
  N extends Network,
  S extends SupportedEvmDomain<N>
> (
  evmClient: ViemEvmClient<N,S>,
  intent: Intent,
  corridor: CorridorStats<Network, keyof EvmDomains, Corridor>,
  corridorFees: Fee[],
  payInUsdc: boolean,
  maxRelayFee: Fee,
  gasDropoff: GasTokenOf<SupportedDomain<N>>,
  maxFastFeeUsdc?: Usdc,
): Promise<RouteWithoutEstimates> {


  const corridorSteps = [
    buildTransferStep(corridor.corridor, intent.sourceChain),
  ];

  const sharedRouteData = {
    intent,
    // estimatedDuration,
    fees: corridorFees,
    corridor: corridor.corridor,
  };

  const routeWithPermitSteps = composeStepsWithPermit(
    corridorSteps,
    intent.sourceChain,
  );

  return {
    ...sharedRouteData,
    requiresMessageSignature: true,
    steps: routeWithPermitSteps,
    // estimatedTotalCost: await calculateTotalCost(
    //   routeWithPermitSteps,
    //   corridorFees,
    // ),
    transactionListener: new TransactionEmitter(),
    progress: new TransferProgressEmitter(),
    workflow: cctprEvm.transfer(
      evmClient,
      sender,
      intent.targetChain as SupportedDomain<N>,
      recipient,
      intendedAmount,
      { type: "onChain", ...quote },
      gasDropoff,
      {
        usePermit: true,
        corridor: { type: corridor.corridor, maxFastFeeUsdc },
      } as TODO,
    ),
  };
}



function buildTransferStep(
  corridor: Corridor,
  sourceChain: keyof EvmDomains,
): RouteExecutionStep {
  const sharedTxData = {
    platform: "Evm" as const,
    chain: sourceChain,
    type: "transfer" as const,
  };
  switch (corridor) {
    /**
     * @todo: add sensible values to the gas cost estimation of the corridors.
     */
    case "v1":
      return {
        ...sharedTxData,
        gasCostEstimation: 120_000n,
      };

    case "v2Direct":
      return {
        ...sharedTxData,
        gasCostEstimation: 200_000n,
      };

    case "avaxHop":
      return {
        ...sharedTxData,
        gasCostEstimation: 300_000n,
      };

    default:
      throw new Error(`Corridor: ${corridor} not supported.`);
  }
}

function composeStepsWithPermit(
  steps: RouteExecutionStep[],
  sourceChain: keyof EvmDomains,
): RouteExecutionStep[] {
  const signPermitStep: RouteExecutionStep = {
    platform: "Evm",
    type: "sign-permit",
    chain: sourceChain,
    gasCostEstimation: 0n,
  };

  return [signPermitStep, ...steps];
}