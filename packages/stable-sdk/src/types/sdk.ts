// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { WalletClient as ViemWalletClient } from "viem";
import type { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import type { Address, Amount, Network, TxHash } from "./general.js";
import type { UserIntent } from "./intent.js";
import type { Route, SupportedRoute } from "./route.js";
import type { EvmPlatformSigner } from "./signer.js";
import type { Url } from "@stable-io/utils";
import type { Redeem } from "./redeem.js";
import type { CctpAttestation } from "../methods/executeRoute/findTransferAttestation.js";
import type { LoadedCctprDomain, SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";

export type { WalletClient as ViemWalletClient } from "viem";

export interface SDKOptions<N extends Network> {
  network: N;
  signer: EvmPlatformSigner;
  rpcUrls?: Partial<Record<keyof EvmDomains, string>>;
}

export abstract class SDK<N extends Network> {
  constructor(protected options: SDKOptions<N>) {}

  public abstract getNetwork(): N;

  public abstract findRoutes(
    intent: UserIntent<N>,
  ): Promise<RoutesResult<N, LoadedCctprDomain<N>, SupportedDomain<N>>>;

  public abstract checkHasEnoughFunds(route: SupportedRoute<N>): Promise<boolean>;

  public abstract executeRoute(route: SupportedRoute<N>): Promise<{
    transactions: TxHash[];
    attestations: CctpAttestation[];
    redeems: Redeem[];
    transferHash: TxHash;
    redeemHash: TxHash;
  }>;

  public abstract getBalance(
    address: Address,
    chains: (keyof EvmDomains)[],
  ): Promise<Record<keyof EvmDomains, Amount>>;

  public abstract setSigner(signer: SDKOptions<N>["signer"]): void;
  public abstract getSigner(chain: keyof EvmDomains): Promise<ViemWalletClient>;

  public abstract getRpcUrl(domain: keyof EvmDomains): Url;
}

export interface RoutesResult <
  N extends Network,
  S extends LoadedCctprDomain<N>,
  D extends SupportedDomain<N>,
> {
  all: Route<N, S, D>[];
  fastest: Route<N, S, D>;
  cheapest: Route<N, S, D>;
}
