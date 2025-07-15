// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { EvmDomains, GasTokenOf, Percentage, Usdc } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { PaymentTokenOptions } from "./sdk.js";

export type UserIntent = {
  sourceChain: keyof EvmDomains;
  targetChain: keyof EvmDomains;
  amount: string | Usdc;
  sender: string | EvmAddress;
  recipient: string | EvmAddress;

  usePermit?: boolean;
  gasDropoffDesired?: bigint | GasTokenOf<keyof EvmDomains>;
  paymentToken?: PaymentTokenOptions;
  relayFeeMaxChangeMargin?: number |  Percentage; // | percentage?; TODO
};

export type Intent<
  S extends keyof EvmDomains,
  D extends keyof EvmDomains,
> = {
  sourceChain: S;
  targetChain: D;
  amount: Usdc;
  sender: EvmAddress; // eventually universal address
  recipient: EvmAddress; // eventually universal address
  usePermit: boolean;
  gasDropoffDesired: GasTokenOf<D>;
  paymentToken: PaymentTokenOptions;
  relayFeeMaxChangeMargin: number;
};
