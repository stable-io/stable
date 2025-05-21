// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Brand, Url } from "@stable-io/utils";
import type { Network } from "./chains/index.js";

export const apiUrl = {
  Mainnet: "https://iris-api.circle.com",
  Testnet: "https://iris-api-sandbox.circle.com",
} as const satisfies Record<Network, string>;

export type ApiVersion = Brand<number, "ApiVersion">;

export const apiEndpoint = <N extends Network>(network: N) => (
  version: ApiVersion,
  ...params: readonly string[]
): Url => `${apiUrl[network]}/v${version}/${params.join("/")}` as Url;

export const apiEndpointWithQuery = <N extends Network>(network: N) => (
  version: ApiVersion,
  query: Readonly<Record<string, string>>,
  ...params: readonly string[]
): Url => {
  const pairs = Object.entries(query).map(([key, value]) => `${key}=${value}`);
  const endpoint = apiEndpoint(network)(version, ...params);
  return `${endpoint}?${pairs.join("&")}` as Url;
};

export const init = <N extends Network>(network: N) => ({
  apiUrl: apiUrl[network],
  apiEndpoint: apiEndpoint(network),
  apiEndpointWithQuery: apiEndpointWithQuery(network),
} as const);
