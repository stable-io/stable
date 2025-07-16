// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// Imports with registration side-effects
import "@stable-io/cctp-sdk-evm";
import "@stable-io/cctp-sdk-viem";
import "@stable-io/cctp-sdk-cctpr-definitions";
import "@stable-io/cctp-sdk-cctpr-evm";

export type { EvmDomains } from "@stable-io/cctp-sdk-definitions";

export type * from "./types/index.js";
export { ViemSigner } from "./signer/viemSigner.js";
export { StableSDK as default } from "./stable.js";
