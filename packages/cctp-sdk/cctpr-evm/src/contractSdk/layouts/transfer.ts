// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Layout, Item, DeriveType } from "binary-layout";
import {
  universalAddressItem,
  signatureItem,
  enumSwitchVariants,
  byteSwitchItem,
  Network,
  EvmGasToken,
  hashItem,
} from "@stable-io/cctp-sdk-definitions";
import { permitItem, evmAddressItem } from "@stable-io/cctp-sdk-evm";
import {
  usdcItem,
  supportedDomainItem,
  gasDropoffItem,
  timestampItem,
  corridorVariantItem,
  userQuoteVariantItem,
  offChainVariant,
  onChainUsdcVariant,
  offChainQuoteLayout as cctprOffChainQuoteLayout,
} from "@stable-io/cctp-sdk-cctpr-definitions";

export const offChainQuoteLayout = <N extends Network>(network: N) =>
  cctprOffChainQuoteLayout(network, "Evm", EvmGasToken);
export type OffChainQuote<N extends Network> =
  DeriveType<ReturnType<typeof offChainQuoteLayout<N>>>;

const transferCommonLayout = <N extends Network, const I extends Item>(
  network: N,
  quoteVariantItem: I,
) => [
  { name: "inputAmountUsdc",   ...usdcItem                     },
  { name: "destinationDomain", ...supportedDomainItem(network) },
  { name: "mintRecipient",     ...universalAddressItem         },
  { name: "gasDropoff",        ...gasDropoffItem               },
  { name: "corridorVariant",   ...corridorVariantItem          },
  { name: "quoteVariant",      ...quoteVariantItem             },
] as const;

const payInUsdcItem = { binary: "uint", size: 1, custom: { to: "usdc", from: 1 } } as const;
const usdcFeePaymentItem = {
  binary: "bytes",
  layout: [
    { name: "payIn",  ...payInUsdcItem },
    { name: "amount", ...usdcItem      },
  ],
} as const satisfies Layout;
const gaslessQuoteVariants = [
  offChainVariant(usdcFeePaymentItem),
  onChainUsdcVariant,
] as const;
const gaslessQuoteVariantItem = byteSwitchItem("type", enumSwitchVariants(gaslessQuoteVariants));
export type GaslessQuoteVariant = DeriveType<typeof gaslessQuoteVariantItem>;

const permit2NonceItem = hashItem;
const permit2DataItem = {
  binary: "bytes",
  layout: [
    { name: "owner",     ...evmAddressItem   },
    { name: "amount",    ...usdcItem         },
    { name: "nonce",     ...permit2NonceItem },
    { name: "deadline",  ...timestampItem    },
    { name: "signature", ...signatureItem    },
  ],
} as const satisfies Layout;

const evmUserQuoteVariantItem = userQuoteVariantItem(EvmGasToken, []);
export type UserQuoteVariant = DeriveType<typeof evmUserQuoteVariantItem>;

const userTransferCommonLayout = <N extends Network>(network: N) =>
  transferCommonLayout(network, evmUserQuoteVariantItem);

const transferWithPermitLayout = <N extends Network>(network: N) => [
  { name: "permit", ...permitItem },
  ...userTransferCommonLayout(network),
] as const satisfies Layout;

const transferGaslessLayout = <N extends Network>(network: N) => [
  { name: "permit2Data",    ...permit2DataItem            },
  { name: "gaslessFeeUsdc", ...usdcItem                   },
  ...transferCommonLayout(network, gaslessQuoteVariantItem),
] as const satisfies Layout;

const transferVariants = <N extends Network>(network: N) => [
  [[0x01, "Permit"     ], transferWithPermitLayout(network)],
  [[0x02, "Preapproval"], userTransferCommonLayout(network)],
  [[0x03, "Gasless"    ], transferGaslessLayout(network)   ],
] as const;
export const transferLayout = <N extends Network>(network: N) =>
  byteSwitchItem("approvalType", transferVariants(network));
export type Transfer<N extends Network> = DeriveType<ReturnType<typeof transferLayout<N>>>;
