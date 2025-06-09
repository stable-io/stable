// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Route } from "../../../types/index.js";

export async function buildGaslessRelayerRoute(): Promise<Route> {
  throw new Error("NotImplemented");
  // const routeWithGaslessRelaying: Route = {
  //   ...sharedRouteData,
  //   requiresMessageSignature: true,
  //   steps: gaslessRelayingSteps,
  //   estimatedTotalCost: await calculateTotalCost(gaslessRelayingSteps, corridorFees),
  //   progress: new TransferProgressEmitter(),
  //   transactionListener: new TransactionEmitter(),
  //   workflow: transferWithGaslessRelaying(),
  // };
}