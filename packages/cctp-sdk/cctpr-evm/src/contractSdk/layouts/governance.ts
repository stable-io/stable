// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Layout, DeriveType } from "binary-layout";
import { enumItem } from "binary-layout";
import { range, zip } from "@stable-io/map-utils";
import {
  uint256Item, arrayLayout, byteSwitchLayout, Network,
} from "@stable-io/cctp-sdk-definitions";
import { evmAddressItem } from "@stable-io/cctp-sdk-evm";
import { domainChainIdPairLayout, feeAdjustmentTypes } from "./common.js";
import { feeAdjustmentsSlotItem } from "./feeAdjustments.js";

const sweepTokensLayout = [
  { name: "tokenAddress", ...evmAddressItem },
  { name: "amount",       ...uint256Item    },
] as const satisfies Layout;

const evmAddressLayout = [
  { name: "address", ...evmAddressItem },
] as const satisfies Layout;

const feeAdjustmentTypeItem =
  enumItem(zip([feeAdjustmentTypes, range(feeAdjustmentTypes.length)]));

const feeAdjustmentCommandLayout = [
  { name: "feeType",     ...feeAdjustmentTypeItem  },
  { name: "mappingIndex", binary: "uint", size: 1  },
  { name: "adjustments", ...feeAdjustmentsSlotItem },
] as const satisfies Layout;

const governanceVariants = <N extends Network>(network: N) => [
  [[0x11, "updateFeeAdjustments"    ], feeAdjustmentCommandLayout      ],
  [[0x12, "sweepTokens"             ], sweepTokensLayout               ],
  [[0x13, "updateFeeRecipient"      ], evmAddressLayout                ],
  [[0x14, "updateFeeAdjuster"       ], evmAddressLayout                ],
  [[0x15, "updateOffChainQuoter"    ], evmAddressLayout                ],
  [[0x16, "proposeOwnershipTransfer"], evmAddressLayout                ],
  [[0x17, "acceptOwnershipTransfer" ], []                              ],
  [[0x18, "cancelOwnershipTransfer" ], []                              ],
  [[0x19, "setChainIdForDomain"     ], domainChainIdPairLayout(network)],
] as const;
export const governanceCommandLayout = <N extends Network>(network: N) =>
  byteSwitchLayout("command", governanceVariants(network));
export type GovernanceCommand<N extends Network> =
  DeriveType<ReturnType<typeof governanceCommandLayout<N>>>;

export const governanceCommandArrayLayout = <N extends Network>(network: N) =>
  arrayLayout(governanceCommandLayout(network));
