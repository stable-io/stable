// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {
  GasTokenOf,
  LoadedDomain,
  Network,
  PlatformAddress,
  PlatformOf,
  Usdc,
} from "@stable-io/cctp-sdk-definitions";
import type { CctprRecipientAddress, SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";

export type PaymentTokenOptions = "usdc" | "native" | "gas";

export type UserIntent<N extends Network> = {
  sourceChain: LoadedDomain;
  targetChain: SupportedDomain<N>;
  amount: string;
  sender: string; // | EvmAddress; TODO
  recipient: string; // | EvmAddress; TODO

  usePermit?: boolean;
  gasDropoffDesired?: bigint; // | GasTokenOf<N>; TODO
  paymentToken?: PaymentTokenOptions;
  relayFeeMaxChangeMargin?: number; // | percentage?; TODO
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
  relayFeeMaxChangeMargin: number;
};
