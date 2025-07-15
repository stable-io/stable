// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { WalletClient as ViemWalletClient } from "viem";
import { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { Address, Amount, Chain, Network, TxHash } from "./general.js";
import { UserIntent } from "./intent.js";
import { Route, SupportedRoute } from "./route.js";
import { EvmPlatformSigner } from "./signer.js";
import { Url } from "@stable-io/utils";
import { Receive } from "./receive.js";
import { CctpAttestation } from "../methods/executeRoute/findTransferAttestation.js";
import { SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";

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
    intent: UserIntent,
  ): Promise<RoutesResult<N, SupportedEvmDomain<N>, SupportedEvmDomain<N>>>;

  public abstract checkHasEnoughFunds(route: SupportedRoute<N>): Promise<boolean>;

  public abstract executeRoute(route: SupportedRoute<N>): Promise<{
    transactions: TxHash[];
    attestations: CctpAttestation[];
    receiveTxs: Receive[];
    transferHash: TxHash;
    receiveHash: TxHash;
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
  S extends SupportedEvmDomain<N>,
  D extends SupportedEvmDomain<N>,
> {
  all: Route<S, D>[];
  fastest: Route<S, D>;
  cheapest: Route<S, D>;
}

export type PaymentTokenOptions = "usdc" | "native";
