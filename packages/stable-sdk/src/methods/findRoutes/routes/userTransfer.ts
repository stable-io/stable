// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { init as initDefinitions,
  EvmDomains,
  GasTokenOf,
  Usdc,
  percentage,
} from "@stable-io/cctp-sdk-definitions";
import { init as initCctpr } from "@stable-io/cctp-sdk-cctpr-definitions";
import { init as initEvm, EvmAddress } from "@stable-io/cctp-sdk-evm";
import type { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  Corridor,
  CorridorStats,
  SupportedEvmDomain,
} from "@stable-io/cctp-sdk-cctpr-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { TODO } from "@stable-io/utils";

import { TransferProgressEmitter } from "../../../progressEmitter.js";
import { TransactionEmitter } from "../../../transactionEmitter.js";
import { buildTransferStep, preApprovalStep, signPermitStep } from "../steps.js";
import type {
  Network,
  Intent,
} from "../../../types/index.js";
import { Route } from "../../../types/index.js";
import { calculateTotalCost, getCorridorFees } from "../fees.js";
import { init as initCctprEvm } from "@stable-io/cctp-sdk-cctpr-evm";

export async function buildUserTransferRoute<
  N extends Network,
  S extends SupportedEvmDomain<N>,
  D extends SupportedEvmDomain<N>,
>(
  evmClient: ViemEvmClient<N, S>,
  cctprEvm: ReturnType<typeof initCctprEvm<N>>,
  intent: Intent<S, D>,
  corridor: CorridorStats<Network, keyof EvmDomains, Corridor>,
): Promise<Route<S, D>> {
  const { corridorFees, maxRelayFee, fastFeeRate } = getCorridorFees(
    corridor.cost,
    intent,
  );

  const takeFeesFromInput = true;

  const quote = intent.paymentToken === "usdc"
  ? {
      maxRelayFee: maxRelayFee as Usdc,
    }
  : { maxRelayFee: maxRelayFee as GasTokenOf<S, keyof EvmDomains> };

  const usdcFees = corridorFees.filter(fee => fee.kind.name === "Usdc") as Usdc[];
  const totalUsdcValue = usdcFees.reduce((acc, fee) => acc.add(fee), intent.amount);

  const allowanceRequired = await cctprRequiresAllowance(
    evmClient,
    intent.sourceChain,
    intent.sender,
    totalUsdcValue,
  );

  const tokenAllowanceSteps = allowanceRequired
    ? [
        intent.usePermit
          ? signPermitStep(intent.sourceChain)
          : preApprovalStep(intent.sourceChain),
      ]
    : [];

  const routeSteps = [
    ...tokenAllowanceSteps,
    buildTransferStep(corridor.corridor, intent.sourceChain, intent.usePermit),
  ];

  const corridorParams = corridor.corridor === "v1"
    ? { type: corridor.corridor }
    : { type: corridor.corridor, fastFeeRate };

  return {
    intent,
    fees: corridorFees,
    estimatedDuration: corridor.transferTime,
    corridor: corridor.corridor,
    requiresMessageSignature: intent.usePermit,
    steps: routeSteps,
    estimatedTotalCost: await calculateTotalCost(
      routeSteps,
      corridorFees,
    ),
    transactionListener: new TransactionEmitter(),
    progress: new TransferProgressEmitter(),
    workflow: cctprEvm.transfer(
      evmClient,
      intent.sender,
      intent.targetChain as SupportedDomain<N>,
      intent.recipient,
      intent.amount,
      { type: "onChain", ...quote },
      intent.gasDropoffDesired as TODO,
      corridorParams as TODO,
      takeFeesFromInput,
      intent.usePermit,
    ),
  };
}

async function cctprRequiresAllowance<
  N extends Network,
  S extends SupportedEvmDomain<N>,
>(
  evmClient: ViemEvmClient<N, S>,
  sourceChain: keyof EvmDomains,
  sender: EvmAddress,
  totalUsdcValue: Usdc,
): Promise<boolean> {
  // TODO: This probably should also be dependency injected?
  const definitions = initDefinitions(evmClient.network);
  const cctpr = initCctpr(evmClient.network);
  const evm = initEvm(evmClient.network);

  const usdcAddress = new EvmAddress(
    definitions.usdcContracts.contractAddressOf[sourceChain],
  );
  const cctprAddress = new EvmAddress(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (cctpr.contractAddressOf as TODO)(sourceChain),
  );

  const allowance = await evm.getTokenAllowance(
    evmClient,
    usdcAddress,
    sender,
    cctprAddress,
    Usdc,
  );

  return totalUsdcValue.gt(allowance);
}
