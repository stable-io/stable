// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { EvmDomains, GasTokenOf, GenericGasToken, Usdc } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { Address, Amount } from "./general.js";
import { PaymentTokenOptions } from "./sdk.js";

export type UserIntent = {
  sourceChain: keyof EvmDomains;
  targetChain: keyof EvmDomains;
  amount: string | Amount;
  sender: string; // | EvmAddress; TODO
  recipient: string; // | EvmAddress; TODO

  usePermit?: boolean;
  gasDropoffDesired?: bigint; // | GasTokenOf<N>; TODO
  paymentToken?: PaymentTokenOptions
  relayFeeMaxChangeMargin?: number; // | percentage?; TODO
}

export type Intent = {
  sourceChain: keyof EvmDomains;
  targetChain: keyof EvmDomains;
  amount: Usdc;
  sender: EvmAddress; // eventually universal address
  recipient: EvmAddress; // eventually universal address
  usePermit: boolean;
  gasDropoffDesired: GenericGasToken; // TODO: type parameters S and D for source and target and GasTokenOf<D>
  paymentToken: PaymentTokenOptions;
  relayFeeMaxChangeMargin: number;
}