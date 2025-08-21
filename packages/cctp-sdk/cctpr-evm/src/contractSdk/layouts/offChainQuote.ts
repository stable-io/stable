// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Layout, DeriveType } from "binary-layout";
import { byteSwitchItem, Network } from "@stable-io/cctp-sdk-definitions";
import { timestampItem } from "@stable-io/cctp-sdk-cctpr-definitions";
import {
  corridorItem,
  supportedDomainItem,
  gasDropoffItem,
  usdcItem,
  evmGasTokenItem,
  evmDomainItem,
} from "./common.js";

const relayFeeVariants = [
  [[0, "usdc"    ], [{ name: "amount", ...usdcItem        }]],
  [[1, "gasToken"], [{ name: "amount", ...evmGasTokenItem }]],
] as const;

const relayFeeItem = byteSwitchItem("chargeIn", relayFeeVariants);

export const offChainQuoteLayout = <N extends Network>(network: N) => [
  { name: "sourceDomain",      ...evmDomainItem                },
  { name: "destinationDomain", ...supportedDomainItem(network) },
  { name: "corridor",          ...corridorItem                 },
  { name: "gasDropoff",        ...gasDropoffItem               },
  { name: "expirationTime",    ...timestampItem                },
  { name: "relayFee",          ...relayFeeItem                 },
] as const satisfies Layout;

export type OffChainQuote<N extends Network> =
  DeriveType<ReturnType<typeof offChainQuoteLayout<N>>>;
