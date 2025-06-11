// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { init as initDefinitions, usdc } from "@stable-io/cctp-sdk-definitions";
import { init as initEvm } from "@stable-io/cctp-sdk-evm";
import { Usdc, EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { permit2Address, EvmAddress } from "@stable-io/cctp-sdk-evm";
import type { Route, Network, Intent } from "../../../types/index.js";
import { SupportedEvmDomain, Corridor, CorridorStats } from "@stable-io/cctp-sdk-cctpr-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";

import { getCorridorFees } from "../fees.js";
import { GaslessTransferQuoteParams, getTransferQuote } from "../../../gasless/api.js";
/**
 * We set the allowance for permit2 contract to the max value that fits uint256
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
  intent: Intent<S,D>,
  corridor: CorridorStats<Network, keyof EvmDomains, Corridor>
): Promise<Route> {
  const permitSignatureRequired = await permit2RequiresAllowance(
    evmClient,
    intent.sourceChain,
    intent.sender,
    usdc(PERMIT2_ALLOWANCE_RENEWAL_THRESHOLD),
  );

  const transferParameters = buildTransferParameters(intent, corridor);

  const quote = await getTransferQuote(
    evmClient.network,
    transferParameters,
    permitSignatureRequired,
  );



  // assemble transfer parameters
  // get quote from gasless api
  // assemble steps
  // create workflow async generator
  // calculate total cost
  // return route

  throw new Error("Not fully implemented yet");
}



async function permit2RequiresAllowance<
  N extends Network,
  S extends SupportedEvmDomain<N>
> (
  evmClient: ViemEvmClient<N,S>,
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

function buildTransferParameters<
  N extends Network,
  S extends keyof EvmDomains,
  D extends keyof EvmDomains,
> (
  intent: Intent<S, D>,
  corridor: CorridorStats<N, keyof EvmDomains, Corridor>
): GaslessTransferQuoteParams {
  const corridorFees = getCorridorFees(corridor.cost, intent);

  if (intent.paymentToken !== "usdc")
    throw new Error("Gasless Transfer can't be paid in native token");

  const maxRelayFee = corridorFees.maxRelayFee as Usdc;
  return {
    destination: intent.targetChain,
    // TODO: how to serialize input? it must match what the backend expects
    inputAmount: intent.amount.toString(),
    mintRecipient: intent.recipient.toString(),
    
    // TODO: this probably won't work.
    gasDropoff: intent.gasDropoffDesired.toUnit("atomic").toString(),

    corridor,
    quote: {
      type: "onChain",
      takeFeesFromInput: false,
      maxRelayFee,
    }
  }
}