// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { LoadedDomain, fetchApiResponse, duration } from "@stable-io/cctp-sdk-definitions";
import { TODO, Url } from "@stable-io/utils";
import type { Network, TxHash } from "../../types/index.js";
import type { Receive } from "src/types/receive.js";
import { pollUntil, type PollingConfig } from "@stable-io/utils";

const EXPLORER_API_BY_NETWORK = {
  Mainnet: "https://api.explorer.stableit.com/api/v1beta",
  Testnet: "https://api.explorer.stableit.com/api/v1beta",
};

const DEFAULT_POLLING: PollingConfig = {
  baseDelayMs: 300,
  maxDelayMs: 1200,
};

export async function findTransferReceive(
  network: Network,
  targetDomain: LoadedDomain,
  transactionHash: TxHash,
  config: PollingConfig = {},
): Promise<Receive> {
  const cfg = { ...DEFAULT_POLLING, ...config };
  const endpoint = `${EXPLORER_API_BY_NETWORK[network]}/operations?tx_hash=${transactionHash}`;

  const query = async (): Promise<Receive | undefined> => {
    const { status, value } = await fetchApiResponse(
      endpoint as Url,
      duration(0, "sec"),
    );

    if (status !== 200 || !(value as TODO).data?.[0]?.destination?.tx_hash) {
      return undefined;
    }

    return {
      transactionHash: (value as TODO).data[0].destination.tx_hash as TxHash,
      destinationDomain: targetDomain,
    };
  };

  return pollUntil(query, r => r !== undefined, cfg);
}
