// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import { init as initCctpr } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  Corridor,
  CorridorStats,
  SupportedEvmDomain,
} from "@stable-io/cctp-sdk-cctpr-evm";
import {
  init as initCctprEvm,
} from "@stable-io/cctp-sdk-cctpr-evm";
import {
  init as initDefinitions,
  EvmDomains,
  GasTokenOf,
  Usdc,
  usdc,
} from "@stable-io/cctp-sdk-definitions";
import { EvmAddress, init as initEvm } from "@stable-io/cctp-sdk-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { TODO } from "@stable-io/utils";

import { TransferProgressEmitter } from "../../../progressEmitter.js";
import { TransactionEmitter } from "../../../transactionEmitter.js";

import type {
  Fee,
  RouteExecutionStep,
  Network,
  Intent,
} from "../../../types/index.js";
import { RouteWithoutEstimates } from "../types.js";


export async function buildApprovalRoute<
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
  const cctprEvm = initCctprEvm(evmClient.network);
  const intendedAmount = usdc(intent.amount);
  const sender = new EvmAddress(intent.sender);
  const recipient = new EvmAddress(intent.recipient);

  const quote = payInUsdc
  ? {
      maxRelayFee: maxRelayFee as Usdc,
      takeFeesFromInput: false,
    }
  : { maxRelayFee: maxRelayFee as GasTokenOf<S, keyof EvmDomains> };

  const corridorSteps = [
    buildTransferStep(corridor.corridor, intent.sourceChain),
  ];

  const sharedRouteData = {
    intent,
    // estimatedDuration,
    fees: corridorFees,
    corridor: corridor.corridor,
  };

  const routeWithApprovalSteps = await composeStepsWithApproval(
    evmClient,
    intendedAmount,
    intent.sourceChain,
    sender,
    corridorFees,
    corridorSteps,
  );

  const routeWithApproval: RouteWithoutEstimates = {
    ...sharedRouteData,
    requiresMessageSignature: false,
    steps: routeWithApprovalSteps,
    transactionListener: new TransactionEmitter(),
    progress: new TransferProgressEmitter(),
    // estimatedTotalCost: await calculateTotalCost(
    //   routeWithApprovalSteps,
    //   corridorFees,
    // ),
    workflow: cctprEvm.transfer(
      evmClient,
      sender,
      intent.targetChain as SupportedDomain<N>,
      recipient,
      intendedAmount,
      { type: "onChain", ...quote },
      gasDropoff,
      {
        usePermit: false,
        corridor: { type: corridor.corridor, maxFastFeeUsdc },
      } as TODO,
    ),
  };

  return routeWithApproval;
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

async function composeStepsWithApproval<
  N extends Network,
  D extends keyof EvmDomains,
>(
  evmClient: ViemEvmClient<N, D>,
  intendedAmount: Usdc,
  sourceDomain: keyof EvmDomains,
  sender: EvmAddress,
  fees: Fee[],
  routeSteps: RouteExecutionStep[],
): Promise<RouteExecutionStep[]> {
  const definitions = initDefinitions(evmClient.network);
  const cctpr = initCctpr(evmClient.network);
  const evm = initEvm(evmClient.network);

  const usdcAddress = new EvmAddress(
    definitions.usdcContracts.contractAddressOf[sourceDomain],
  );
  const cctprAddress = new EvmAddress(
    /**
     * @todo: type system thinks contractAddressOf is not callable,
     *        but at runtime it is. Figure out what's up.
     */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (cctpr.contractAddressOf as any)(sourceDomain),
  );

  const allowance = await evm.getTokenAllowance(
    evmClient as any,
    usdcAddress,
    sender,
    cctprAddress,
    Usdc,
  );

  const requiredAllowance = await calculateRequiredAllowance(
    allowance,
    intendedAmount,
    fees,
  );

  const approvalSteps = [] as RouteExecutionStep[];

  if (requiredAllowance.gt(usdc(0))) {
    approvalSteps.push({
      platform: "Evm",
      chain: sourceDomain,
      type: "pre-approve",
      gasCostEstimation: EVM_APPROVAL_TX_GAS_COST_APROXIMATE,
    });
  }

  return [...approvalSteps, ...routeSteps];
}

// eslint-disable-next-line @typescript-eslint/require-await
async function calculateRequiredAllowance(
  allowance: Usdc,
  intendedAmount: Usdc,
  fees: Fee[],
) {
  const usdcFees = fees.filter((value) => {
    return value.kind.name === "Usdc";
  }) as Usdc[]; // there's definitely a better way typewise to handle this.

  const necessaryAllowance = usdcFees.reduce((total, v) => {
    return total.add(v);
  }, intendedAmount);

  return necessaryAllowance.gt(allowance)
    ? necessaryAllowance.sub(allowance)
    : usdc(0);
}
