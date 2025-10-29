// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { TODO, Url } from "@stable-io/utils";
import type { DomainsOf, Network, Platform } from "./constants/index.js";
import { platformOf } from "./constants/index.js";
import type { PlatformRegistry, RegisteredPlatform } from "./registry.js";

export interface Client<
  N extends Network,
  P extends Platform,
  D extends DomainsOf<P> = DomainsOf<P>,
> {
  readonly network: N;
  readonly platform: P;
  readonly domain: D;
}

export type PlatformClient<
  N extends Network,
  P extends RegisteredPlatform,
  D extends DomainsOf<P>,
> = PlatformRegistry[P]["Client"] extends infer ClientType
  ? ClientType extends Client<N, P, D>
    ? ClientType
    : never
  : never;

export type PlatformClientFn<
  N extends Network,
  P extends RegisteredPlatform,
  D extends DomainsOf<P>,
> = (network: N, domain: D, rpcUrl?: Url) => PlatformClient<N, P, D>;

const platformClientFactory = new Map<
  Platform,
  PlatformClientFn<
    Network,
    RegisteredPlatform,
    DomainsOf<RegisteredPlatform>
  >
>();

/**
 * Register a platform client.
 * It is the responsibility of the user to import a package which registers an appropriate client
 * for each registered platform.
 */
export const registerPlatformClient = <
  const N extends Network,
  const P extends RegisteredPlatform,
  const D extends DomainsOf<P>,
>(
  platform: P,
  ctr: PlatformClientFn<N, P, D>,
): void => {
  platformClientFactory.set(platform, ctr as TODO);
};

export const platformClient = <
  const N extends Network,
  const P extends RegisteredPlatform,
  const D extends DomainsOf<P>,
>(
  network: N,
  domain: D,
  rpcUrl?: Url,
): PlatformClient<N, P, D> => {
  const platform = platformOf.get(domain)!;
  const clientFn = platformClientFactory.get(platform)!;
  return clientFn(network, domain, rpcUrl);
};
