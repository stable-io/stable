// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  Usdc,
  Usd,
  EvmDomains,
  GasTokenOf,
  Duration,
  Network,
} from "@stable-io/cctp-sdk-definitions";
import { Permit, ContractTx, Eip2612Data } from "@stable-io/cctp-sdk-evm";
import { Corridor, SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";
import { Intent } from "./intent.js";
import { TransferProgressEventEmitter } from "../progressEmitter.js";
import { TransactionEventEmitter } from "../transactionEmitter.js";

import { RouteExecutionStep, GaslessTransferData } from "../methods/findRoutes/steps.js";

export type Fee = Usdc | GasTokenOf<keyof EvmDomains>;

export interface Route<
  S extends keyof EvmDomains,
  D extends keyof EvmDomains,
> {
  corridor: Corridor;

  estimatedDuration: Duration;

  estimatedTotalCost: Usd;

  fees: Fee[];

  // "rates" property will contain information about relevant
  // rates that may have been used in the whole process.
  // The first example we'll need is going to be the gas
  // drop-off exchange rate
  // In the future we may have other rates such as the swap
  // exchange rate once we've incoorporated a swap layer.
  //
  // Type details to be defined by implementer
  // rates: Rates[];

  intent: Intent<S, D>;

  // When using permit, the transactions require a an Eip2612
  // signature to be built, so they can not be built eagerly.
  // This is the reason behind workflow needing to be an async
  // generator or state machine, which is not serializable.
  // There are some scenarios where integrator may want to
  // prevent using this routes to generate a serializable workflow.
  // (eg: txs generated in the backend and signed on the front-end)
  requiresMessageSignature: boolean;

  steps: RouteExecutionStep[];

  // TODO:
  // ideally this generator should return typed steps so that they are easy to handle.
  // Since we are re-using the result of cctpr-evm we are limited by the fact that it
  // returns directly what needs to be signed or signed-and-sent.
  // But for example now that we are adding gasless we'll need to also return a type
  // for a relay request that is sent to our api instead of signed or sent to a node.
  // See `executeRouteSteps` where we need to do duck-typing to understand what kind
  // of step we'll be executing.
  workflow: AsyncGenerator<ContractTx | Eip2612Data | GaslessTransferData, ContractTx, Permit | undefined>;

  /**
   * Tracking:
   */
  transactionListener: TransactionEventEmitter;
  progress: TransferProgressEventEmitter;
}

export type SupportedRoute<
  N extends Network,
> = Route<SupportedEvmDomain<N>, SupportedEvmDomain<N>>;
