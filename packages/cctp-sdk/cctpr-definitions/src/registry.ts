// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
import type { RoArray } from "@stable-io/map-utils";
import type { BaseObject, TODO, Url } from "@stable-io/utils";
import type {
  DomainsOf,
  PlatformOf,
  GasTokenOf,
  Network,
  LoadedDomain,
  PlatformAddress,
  RegisteredPlatform,
} from "@stable-io/cctp-sdk-definitions";
import type { SupportedDomain } from "./constants.js";
import type { InOrOut, QuoteBase, CorridorParamsBase } from "./common.js";
import type { RelayCost, SensibleCorridor } from "./getCorridors.js";

export interface PlatformImplsOf extends BaseObject {
  // Platform packages will extend this via declaration merging
  // Each platform will add:
  // [PlatformName]: {
  //   TransferOptions: OptionsType
  //   TransferGeneratorT: GeneratorTType
  //   TransferGeneratorTReturn: GeneratorTReturnType
  // }
}

export interface CctpR {
  PlatformImplsOf: PlatformImplsOf;
}

declare module "@stable-io/cctp-sdk-definitions" {
  export interface ProtocolRegistry {
    CctpR: CctpR;
  }
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type RegisteredCctprPlatform = RegisteredPlatform & keyof PlatformImplsOf;
export type LoadedCctprDomain<N extends Network> =
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  LoadedDomain & DomainsOf<RegisteredCctprPlatform> & SupportedDomain<N>;
export type LoadedCctprPlatformDomain<N extends Network, P extends RegisteredCctprPlatform> =
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  LoadedCctprDomain<N> & DomainsOf<P>;

// FIXME TODO: For some reason CctprRecipientAddress is not working
// LoadedDomain doesn't work on cctpr-definitions package
export type CctprRecipientAddress<N extends Network, D extends SupportedDomain<N>> = TODO
//  UniversalAddress | (D extends LoadedDomain ? PlatformAddress<PlatformOf<D>> : never);

export interface PlatformCctpr<
  P extends RegisteredPlatform,
> {
  getRelayCosts: <
    N extends Network,
    S extends LoadedCctprPlatformDomain<N, P>,
    D extends SupportedDomain<N>,
  >(
    network: N,
    source: S,
    destination: D,
    corridors: RoArray<SensibleCorridor<N, S, D>>,
    gasDropoff?: GasTokenOf<D>,
    rpcUrl?: Url,
  ) => Promise<RoArray<RelayCost<N, S>>>;

  transfer: <
    N extends Network,
    S extends LoadedCctprPlatformDomain<N, P>,
    D extends SupportedDomain<N>,
  >(
    network: N,
    source: S,
    destination: D,
    sender: PlatformAddress<P>,
    recipient: CctprRecipientAddress<N, D>,
    inOrOut: InOrOut,
    corridor: CorridorParamsBase<N, PlatformOf<S>, S, D>,
    quote: QuoteBase<N, PlatformOf<S>, S>,
    gasDropoff: GasTokenOf<D>,
    options: PlatformImplsOf[P]["TransferOptions"],
    rpcUrl?: Url,
  ) => AsyncGenerator<PlatformImplsOf[P]["TransferGeneratorT"], PlatformImplsOf[P]["TransferGeneratorTReturn"]>;
}

const platformCctprRegistry =
  new Map<RegisteredCctprPlatform, PlatformCctpr<RegisteredCctprPlatform>>();

/**
 * Register a platform implementation.
 * It is the responsibility of the CCTPR platform package to register itself.
 */
export const registerPlatformCctpr = <P extends RegisteredCctprPlatform>(
  platform: P,
  implementation: PlatformCctpr<P>,
): void => {
  platformCctprRegistry.set(platform, implementation as TODO);
};

export const platformCctpr = <P extends RegisteredCctprPlatform>(
  platform: P,
): PlatformCctpr<P> => {
  const cctpr = platformCctprRegistry
    .get(platform) as PlatformCctpr<P> | undefined; // @todo: avoid cast
  if (!cctpr) {
    throw new Error(`Platform implementation for ${platform} not registered`);
  }
  return cctpr;
};
