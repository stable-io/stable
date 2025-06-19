// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Network } from "@stable-io/cctp-sdk-definitions";
import { getCorridors } from "./getCorridors.js";
import { transfer } from "./transfer.js";

export * from "./registry.js";

export type { CorridorStats } from "./getCorridors.js";

export * from "./contractSdk/index.js";

/**
 * @todo: this import looks weird.
 */
export type { Corridor, GovernanceCommand, FeeAdjustment, FeeAdjustmentType } from "./contractSdk/layouts/index.js";
export type { SupportedEvmDomain } from "./common.js";

export { corridors } from "./contractSdk/layouts/common.js";
export { routerHookDataLayout } from "./contractSdk/layouts/routerHookData.js";
export { chainDataLayout } from "./contractSdk/layouts/constructor.js";

/**
 * We need to specify this due to ts(7056):
 * > The inferred type of this node exceeds the maximum length the compiler will serialize.
 * > An explicit type annotation is needed.
 */
export interface CctprEvmModule<N extends Network> {
  getCorridors: ReturnType<typeof getCorridors<N>>;
  transfer: ReturnType<typeof transfer<N>>;
}

export const init = <N extends Network>(network: N): CctprEvmModule<N> => ({
  getCorridors: getCorridors<N>(),
  transfer: transfer(network),
});
