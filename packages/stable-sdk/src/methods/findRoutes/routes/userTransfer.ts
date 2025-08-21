// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import type {
  EvmDomains,
  PlatformAddress,
  RegisteredPlatform,
  PlatformOf,
} from "@stable-io/cctp-sdk-definitions";
import {
  Usdc,
  init as initDefinitions,
  platformAddress,
  platformClient,
  platformOf,
  usdc,
} from "@stable-io/cctp-sdk-definitions";
import { getTokenAllowance } from "@stable-io/cctp-sdk-evm";
import { init as initCctpr, platformCctpr } from "@stable-io/cctp-sdk-cctpr-definitions";
import type {
  Corridor,
  CorridorParamsBase,
  CorridorStats,
  InOrOut,
  LoadedCctprPlatformDomain,
  SupportedDomain,
  QuoteBase,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import { TODO } from "@stable-io/utils";

import { TransferProgressEmitter } from "../../../progressEmitter.js";
import { TransactionEmitter } from "../../../transactionEmitter.js";
import { buildTransferStep, preApprovalStep, signPermitStep } from "../steps.js";
import type {
  Network,
  Intent,
  Route,
} from "../../../types/index.js";
import { calculateTotalCost, getCorridorFees } from "../fees.js";

/**
 * Can return undefined if the route can't be satisfied.
 */
export async function buildUserTransferRoute<
  N extends Network,
  P extends RegisteredPlatform,
  S extends LoadedCctprPlatformDomain<N, P>,
  D extends SupportedDomain<N>,
>(
  network: N,
  intent: Intent<N, S, D>,
  corridor: CorridorStats<N, keyof EvmDomains, Corridor>,
): Promise<Route<N, S, D> | undefined> {
  const platform = platformOf(intent.sourceChain);
  const cctprImpl = platformCctpr(platform);
  const { corridorFees, maxRelayFee, fastFeeRate } = getCorridorFees(
    corridor.cost,
    intent,
  );

  const quote = {
    type: "onChain",
    maxRelayFee: maxRelayFee,
  } as QuoteBase<N, PlatformOf<S>, S>; // @todo: remove cast

  const usdcFees = corridorFees.filter(fee => fee.kind.name === "Usdc") as Usdc[];
  const totalUsdcValue = usdcFees.reduce((acc, fee) => acc.add(fee), usdc(0));

  if (intent.amount.le(totalUsdcValue)) {
    // the user is trying to transfer an amount lesser than the usdc fees to pay
    // so we won't relay because they can't cover the cost.

    // TODO: In the future it'd be nice to let the user know what's the minimum
    //       amount we are willing to relay for.
    return undefined;
  }

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
    await buildTransferStep(
      network,
      corridor.corridor,
      intent.sourceChain,
      intent.usePermit,
    ),
  ];

  const inOrOut: InOrOut = {
    amount: intent.amount,
    type: "in",
  };

  const corridorParams = corridor.corridor === "v1"
    ? { type: corridor.corridor } as const
    : { type: corridor.corridor, fastFeeRate } as const;

  return {
    intent,
    fees: corridorFees,
    estimatedDuration: corridor.transferTime,
    corridor: corridor.corridor,
    requiresMessageSignature: intent.usePermit,
    steps: routeSteps,
    estimatedTotalCost: await calculateTotalCost(
      network,
      routeSteps,
      corridorFees,
    ),
    transactionListener: new TransactionEmitter(),
    progress: new TransferProgressEmitter(),
    workflow: cctprImpl.transfer<N, S, D>(
      network,
      intent.sourceChain,
      intent.targetChain,
      intent.sender,
      intent.recipient,
      inOrOut,
      corridorParams as CorridorParamsBase<N, PlatformOf<S>, S, D>, // @todo: remove cast
      quote,
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
    (cctpr.contractAddressOf as TODO)(sourceChain),
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
