// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Network, wormholeChainIdOf } from "@stable-io/cctp-sdk-definitions";
import { getCctpRGovernance } from "./src/cctpr.js";
import { init, getViemClient, getNetwork, getChain } from "./src/common.js";
import { GovernanceCommand } from "@stable-io/cctp-sdk-cctpr-evm";
import { encoding } from "@stable-io/utils";

init();

function run() {
  console.info("Generating calldata for accepting ownership transfer...");
  const network = getNetwork();
  const avalancheChain = getChain(wormholeChainIdOf(network, "Avalanche"));
  const viemClient = getViemClient(network, avalancheChain);
  const cctpr = getCctpRGovernance(viemClient, avalancheChain);
  const commands: GovernanceCommand<Network>[] = [{
    command: "acceptOwnershipTransfer",
  }];
  const partialTx = cctpr.execGovernance(commands);
  const calldata = encoding.hex.encode(partialTx.data, true);
  console.info("\n=== ACCEPT OWNERSHIP CALLDATA ===");
  console.info(`Calldata: ${calldata}`);
  console.info("This calldata can be used on any chain to accept ownership transfer.");
}

run();
