// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Layout, Item, DeriveType } from "binary-layout";
import { boolItem } from "binary-layout";
import {
  universalAddressItem,
  signatureItem,
  enumSwitchVariants,
  byteSwitchLayout,
  Network,
} from "@stable-io/cctp-sdk-definitions";
import { wordSize, permitItem, evmAddressItem } from "@stable-io/cctp-sdk-evm";
import { zip } from "@stable-io/map-utils";
import {
  usdcItem,
  evmGasTokenItem,
  supportedDomainItem,
  gasDropoffItem,
  corridors,
  timestampItem,
} from "./common.js";

const maxFastFeeUsdcItem = { name: "maxFastFeeUsdc", ...usdcItem } as const;
const corridorVariants = zip([corridors, [[], [maxFastFeeUsdcItem], [maxFastFeeUsdcItem]]]);
const corridorVariantItem = byteSwitchLayout("type", enumSwitchVariants(corridorVariants));
export type CorridorVariant = DeriveType<typeof corridorVariantItem>;

const offChainVariant = <const I extends Item>(feePaymentVariant: I) => [
  "offChain", [
    { name: "expirationTime",    ...timestampItem     },
    { name: "feePaymentVariant", ...feePaymentVariant },
    { name: "quoterSignature",   ...signatureItem     },
  ],
] as const;

const onChainUsdcVariant = [
  "onChainUsdc", [
    { name: "maxRelayFeeUsdc",       ...usdcItem   },
    { name: "takeRelayFeeFromInput", ...boolItem() },
  ],
] as const;

const userFeePaymentVariants = [
  ["usdc",     [{ name: "relayFeeUsdc",     ...usdcItem        }]],
  ["gasToken", [{ name: "relayFeeGasToken", ...evmGasTokenItem }]],
] as const;
const userFeePaymentVariantItem =
  byteSwitchLayout("payIn", enumSwitchVariants(userFeePaymentVariants));

const userQuoteVariants = [
  offChainVariant(userFeePaymentVariantItem),
  onChainUsdcVariant,
  ["onChainGas", []],
] as const;
const userQuoteVariantItem = byteSwitchLayout("type", enumSwitchVariants(userQuoteVariants));
export type UserQuoteVariant = DeriveType<typeof userQuoteVariantItem>;

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
    { name: "payIn",        ...payInUsdcItem },
    { name: "relayFeeUsdc", ...usdcItem      },
  ],
} as const satisfies Layout;
const gaslessQuoteVariants = [
  offChainVariant(usdcFeePaymentItem),
  onChainUsdcVariant,
] as const;
const gaslessQuoteVariantItem = byteSwitchLayout("type", enumSwitchVariants(gaslessQuoteVariants));
export type GaslessQuoteVariant = DeriveType<typeof gaslessQuoteVariantItem>;

const permit2NonceItem = { binary: "bytes", size: wordSize } as const;
const permit2DataItem = {
  binary: "bytes",
  layout: [
    { name: "owner",          ...evmAddressItem   },
    { name: "amount",         ...usdcItem         },
    { name: "nonce",          ...permit2NonceItem },
    { name: "deadline",       ...timestampItem    },
    { name: "signature",      ...signatureItem    },
  ],
} as const satisfies Layout;

const userTransferCommonLayout = <N extends Network>(network: N) =>
  transferCommonLayout(network, userQuoteVariantItem);

const transferWithPermitLayout = <N extends Network>(network: N) => [
  { name: "permit", ...permitItem },
  ...userTransferCommonLayout(network),
] as const satisfies Layout;

const transferGaslessLayout = <N extends Network>(network: N) => [
  { name: "permit2Data", ...permit2DataItem },
  { name: "gaslessFeeUsdc", ...usdcItem },
  ...transferCommonLayout(network, gaslessQuoteVariantItem),
] as const satisfies Layout;

const transferVariants = <N extends Network>(network: N) => [
  [[0x01, "Permit"     ], transferWithPermitLayout(network)],
  [[0x02, "Preapproval"], userTransferCommonLayout(network)],
  [[0x03, "Gasless"    ], transferGaslessLayout(network)   ],
] as const;
export const transferLayout = <N extends Network>(network: N) =>
  byteSwitchLayout("approvalType", transferVariants(network));
export type Transfer<N extends Network> = DeriveType<ReturnType<typeof transferLayout<N>>>;
