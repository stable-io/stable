// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {
  GasTokenOf,
  LoadedDomain,
  Network,
  Percentage,
  PlatformAddress,
  PlatformOf,
  RegisteredPlatform,
  Usdc,
} from "@stable-io/cctp-sdk-definitions";
import type { CctprRecipientAddress, SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";

export type PaymentTokenOptions = "usdc" | "native" | "gas";

export type UserIntent<N extends Network, S extends LoadedDomain, D extends SupportedDomain<N>> = {
  sourceChain: S;
  targetChain: D;
  amount: string;
  sender: string | PlatformAddress<PlatformOf<S>>;
  recipient: string | PlatformAddress<RegisteredPlatform & PlatformOf<D>>;
  usePermit?: boolean;
  gasDropoffDesired?: bigint | GasTokenOf<D>;
  paymentToken?: PaymentTokenOptions;
  relayFeeMaxChangeMargin?: number |  Percentage;
};

export type Intent<
  N extends Network,
  S extends LoadedDomain,
  D extends SupportedDomain<N>,
> = {
  sourceChain: S;
  targetChain: D;
  amount: Usdc;
  sender: PlatformAddress<PlatformOf<S>>;
  recipient: CctprRecipientAddress<N, D>;
  usePermit: boolean;
  gasDropoffDesired: GasTokenOf<D>;
  paymentToken: PaymentTokenOptions;
  relayFeeMaxChangeMargin: Percentage;
};
