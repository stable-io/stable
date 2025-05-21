// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { createWalletClient } from "viem";
import { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { Address, Amount, Chain, Network, TxHash } from "./general.js";
import { Intent } from "./intent.js";
import { Route, RouteSearchOptions, RoutesResult } from "./route.js";
import { EvmPlatformSigner } from "./signer.js";
import { Url } from "@stable-io/utils";
import { Redeem } from "./redeem.js";

export interface SDKOptions<N extends Network> {
  network: N;
  signer: EvmPlatformSigner;
  rpcUrls?: Partial<Record<keyof EvmDomains, string>>;
}

export abstract class SDK<N extends Network> {
  constructor(protected options: SDKOptions<N>) {}

  public abstract getNetwork(): N;

  public abstract findRoutes(
    intent: Intent,
    routeSearchOptions: RouteSearchOptions,
  ): Promise<RoutesResult>;

  public abstract checkHasEnoughFunds(route: Route): Promise<boolean>;

  public abstract executeRoute(route: Route): Promise<TxHash[]>;
  public abstract getBalance(
    address: Address,
    chains: (keyof EvmDomains)[],
  ): Promise<Record<keyof EvmDomains, Amount>>;

  public abstract setSigner(signer: SDKOptions<N>["signer"]): void;
  public abstract getSigner(
    chain: keyof EvmDomains
  ): ReturnType<typeof createWalletClient>;

  public abstract getRpcUrl(domain: keyof EvmDomains): Url;

  public abstract findRedeem(
    sourceChain: keyof EvmDomains,
    transactionHash: TxHash,
    destFromBlock: bigint,
    avaxFromBlock?: bigint,
  ): Promise<Redeem>;
}
