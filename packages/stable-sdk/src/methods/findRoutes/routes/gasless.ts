// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { TODO } from "@stable-io/utils";
import { init as initDefinitions, usdc, Usdc, EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { init as initEvm, permit2Address, EvmAddress } from "@stable-io/cctp-sdk-evm";
import type { Route, Network, Intent } from "../../../types/index.js";
import { SupportedEvmDomain, Corridor, CorridorStats } from "@stable-io/cctp-sdk-cctpr-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";

import { RouteExecutionStep, gaslessTransferStep, signPermitStep } from "../steps.js";
import { GetQuoteParams, getTransferQuote } from "../../../gasless/api.js";
import { transferWithGaslessRelay } from "../../../gasless/transfer.js";
import { calculateTotalCost, getCorridorFees } from "../fees.js";
import { TransactionEmitter } from "../../../transactionEmitter.js";
import { TransferProgressEmitter } from "../../../progressEmitter.js";

/**
 * We set the allowance for permit2 contract to the max value that fits uint256.
 * USDC Evm contract does decrease the value of the token if the allwance is max
 * (doesn't do the "infinite allowance trick").
 * See: https://github.com/circlefin/stablecoin-evm/blob/c8c31b249341bf3ffb2e8dbff41977c392a260c5/contracts/v1/FiatTokenV1.sol#L275
 *
 * We'll renew the allowance when it reaches the following value.
 */
const PERMIT2_ALLOWANCE_RENEWAL_THRESHOLD = 1_000_000_000;

export async function buildGaslessRoute<
  N extends Network,
  S extends SupportedEvmDomain<N>,
  D extends SupportedEvmDomain<N>,
>(
  evmClient: ViemEvmClient<N, S>,
  intent: Intent<S, D>,
  corridor: CorridorStats<Network, keyof EvmDomains, Corridor>,
): Promise<Route<S, D>> {
  if (intent.paymentToken !== "usdc")
    throw new Error("Gasless Transfer can't be paid in native token");

  const permit2PermitRequired = await permit2RequiresAllowance(
    evmClient,
    intent.sourceChain,
    intent.sender,
    usdc(PERMIT2_ALLOWANCE_RENEWAL_THRESHOLD),
  );

  const { corridorFees, maxRelayFee, fastFeeRate } = getCorridorFees(corridor.cost, intent);

  const transferParams: GetQuoteParams = {
    sourceChain: intent.sourceChain,
    targetChain: intent.targetChain,
    amount: intent.amount,
    sender: intent.sender,
    recipient: intent.recipient,
    corridor: corridor.corridor,
    gasDropoff: intent.gasDropoffDesired as TODO,
    permit2PermitRequired,
    fastFeeRate: fastFeeRate,
    maxRelayFee: maxRelayFee as Usdc,
    takeFeesFromInput: true,
  };

  const quote = await getTransferQuote(
    evmClient.network,
    transferParams,
  );

  const tokenAllowanceSteps = permit2PermitRequired
    ? [signPermitStep(intent.sourceChain)]
    : [];

  const totalFees = [quote.gaslessFee, ...corridorFees];

  const routeSteps: RouteExecutionStep[] = [
    ...tokenAllowanceSteps,
    gaslessTransferStep(intent.sourceChain),
  ];

  return {
    intent,
    fees: totalFees,
    estimatedDuration: corridor.transferTime,
    corridor: corridor.corridor,
    requiresMessageSignature: true,
    steps: routeSteps,
    estimatedTotalCost: await calculateTotalCost(routeSteps, totalFees),
    transactionListener: new TransactionEmitter(),
    progress: new TransferProgressEmitter(),
    workflow: transferWithGaslessRelay(
      evmClient,
      evmClient.network,
      permit2PermitRequired,
      intent,
      quote.permit2TypedData,
      quote.jwt,
    ),
  };
}

async function permit2RequiresAllowance<
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
  const evm = initEvm(evmClient.network);

  const usdcAddress = new EvmAddress(
    definitions.usdcContracts.contractAddressOf[sourceChain],
  );

  const allowance = await evm.getTokenAllowance(
    evmClient as any,
    usdcAddress,
    sender,
    new EvmAddress(permit2Address),
    Usdc,
  );

  return totalUsdcValue.gt(allowance);
}
