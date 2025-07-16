// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import type {
  EvmDomains,
  GasTokenOf,
  PlatformAddress,
  RegisteredPlatform,
} from "@stable-io/cctp-sdk-definitions";
import {
  Usdc,
  init as initDefinitions,
  platformAddress,
  platformClient,
  platformOf,
} from "@stable-io/cctp-sdk-definitions";
import { getTokenAllowance } from "@stable-io/cctp-sdk-evm";
import { init as initCctpr, platformCctpr } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  Corridor,
  CorridorParams,
  CorridorStats,
  InOrOut,
  LoadedCctprPlatformDomain,
  SupportedDomain,
} from "@stable-io/cctp-sdk-cctpr-definitions";
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

export async function buildUserTransferRoute<
  N extends Network,
  P extends RegisteredPlatform,
  S extends LoadedCctprPlatformDomain<N, P>,
  D extends SupportedDomain<N>,
>(
  network: N,
  intent: Intent<S, D>,
  corridor: CorridorStats<Network, keyof EvmDomains, Corridor>,
): Promise<Route<S, D>> {
  const platform = platformOf(intent.sourceChain);
  const cctprImpl = platformCctpr(platform);
  const { corridorFees, maxRelayFee, fastFeeRate } = getCorridorFees(
    corridor.cost,
    intent,
  );

  const quote = intent.paymentToken === "usdc"
  ? {
      maxRelayFee: maxRelayFee as Usdc,
    }
  : { maxRelayFee: maxRelayFee as GasTokenOf<S, keyof EvmDomains> };

  const usdcFees = corridorFees.filter(fee => fee.kind.name === "Usdc") as Usdc[];
  const totalUsdcValue = usdcFees.reduce((acc, fee) => acc.add(fee), intent.amount);

  const allowanceRequired = await cctprRequiresAllowance(
    network,
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
    buildTransferStep(corridor.corridor, intent.sourceChain),
  ];

  const inOrOut: InOrOut = {
    amount: intent.amount,
    type: "in",
  };

  const corridorParams = corridor.corridor === "v1"
    ? { type: corridor.corridor }
    : { type: corridor.corridor, fastFeeRate };

  return {
    intent,
    fees: corridorFees,
    estimatedDuration: corridor.transferTime,
    corridor: corridor.corridor,
    requiresMessageSignature: true,
    steps: routeSteps,
    estimatedTotalCost: await calculateTotalCost(
      routeSteps,
      corridorFees,
    ),
    transactionListener: new TransactionEmitter(),
    progress: new TransferProgressEmitter(),
    workflow: cctprImpl.transfer(
      network,
      intent.sourceChain,
      intent.targetChain,
      intent.sender,
      intent.recipient,
      inOrOut,
      corridorParams as CorridorParams<N, S, D>, // @todo: remove cast
      { type: "onChain", ...quote },
      intent.gasDropoffDesired as TODO,
      { usePermit: intent.usePermit },
    ),
  };
}

async function cctprRequiresAllowance<
  N extends Network,
  P extends RegisteredPlatform,
  S extends LoadedCctprPlatformDomain<N, P>,
>(
  network: N,
  sourceChain: S,
  sender: PlatformAddress<P>,
  totalUsdcValue: Usdc,
): Promise<boolean> {
  const client = platformClient(network, sourceChain);
  // TODO: This probably should also be dependency injected?
  const definitions = initDefinitions(network);
  const cctpr = initCctpr(network);

  const usdcAddress = platformAddress(
    sourceChain,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    definitions.usdcContracts.contractAddressOf[network as Network][sourceChain],
  );
  const cctprAddress = platformAddress(
    sourceChain,
    /**
     * @todo: type system thinks contractAddressOf is not callable,
     *        but at runtime it is. Figure out what's up.
     */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (cctpr.contractAddressOf as any)(sourceChain),
  );

  const allowance = await getTokenAllowance(
    client,
    usdcAddress,
    sender,
    cctprAddress,
    Usdc,
  );

  return totalUsdcValue.gt(allowance);
}
