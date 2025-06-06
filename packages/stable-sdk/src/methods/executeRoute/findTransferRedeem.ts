// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { domainIdOf, v1, v2, EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { TODO, Url } from "@stable-io/utils";
import type { Network } from "../../types/index.js";
import type { CctpAttestation } from "./findTransferAttestation.js";
import { parseAbiItem } from "viem/utils";
import type { Hex } from "viem";
import type { Redeem } from "src/types/redeem.js";
import type { PollingConfig } from "../../utils.js";
import { pollUntil } from "../../utils.js";

/**
 * @todo: Should be configured by chain.
 */
const REDEEM_SCAN_BLOCKS_BUFFER = 15n;

export async function findTransferRedeem<N extends Network>(
  network: N,
  rpcUrl: Url,
  attestation: CctpAttestation,
  config: PollingConfig = {},
): Promise<Redeem> {
  const defaultConfig: PollingConfig = {
    baseDelayMs: 2000,
  };
  const { cctpVersion, nonce, sourceDomain, targetDomain } = attestation;
  const viemEvmClient = ViemEvmClient.fromNetworkAndDomain(
    network,
    targetDomain,
    rpcUrl,
  );

  let fromBlock = await viemEvmClient.getLatestBlock() - REDEEM_SCAN_BLOCKS_BUFFER;

  return await pollUntil(async () => {
    const [latestBlock, logs] = await Promise.all([
      viemEvmClient.getLatestBlock(),
      cctpVersion === 1 ?
        getV1RedeemLogs(network, viemEvmClient, nonce, targetDomain, fromBlock) :
        await getV2RedeemLogs(network, viemEvmClient, nonce, targetDomain, fromBlock),
    ]);

    const filteredLogs = logs.filter(log => log.args.sourceDomain === domainIdOf(sourceDomain));
    if (filteredLogs.length > 1) {
      throw new Error(`Found multiple ${filteredLogs.length} redeem logs for the same nonce.`);
    }

    fromBlock = latestBlock;
    return filteredLogs.length > 0
      ? {
        destinationDomain: targetDomain,
        transactionHash: filteredLogs[0].transactionHash,
      }
      : undefined;
  }, result => result !== undefined, {
    ...defaultConfig,
    ...config,
  });
};

const v1MessageReceivedEvent = parseAbiItem(
  "event MessageReceived(address indexed caller,uint32 sourceDomain,uint64 indexed nonce,bytes32 sender,bytes messageBody)",
);

async function getV1RedeemLogs<
  N extends Network,
  D extends keyof EvmDomains,
>(
  network: N,
  viemEvmClient: ViemEvmClient<N, D>,
  nonce: bigint,
  targetChain: keyof EvmDomains,
  fromBlock: bigint,
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const destContract = (v1.contractAddressOf as TODO)(network, targetChain, 0, 1);

  return await viemEvmClient.client.getLogs({
    address: destContract,
    event: v1MessageReceivedEvent,
    fromBlock,
    args: {
      nonce,
    },
  });
};

const v2MessageReceivedEvent = parseAbiItem(
  "event MessageReceived(address indexed caller,uint32 sourceDomain,bytes32 indexed nonce,bytes32 sender,uint32 indexed finalityThresholdExecuted,bytes messageBody)",
);

async function getV2RedeemLogs<
  N extends Network,
  D extends keyof EvmDomains,
>(
  network: N,
  viemEvmClient: ViemEvmClient<N, D>,
  nonce: Hex,
  targetChain: keyof EvmDomains,
  fromBlock: bigint,
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const destContract = (v2.contractAddressOf as TODO)(network, targetChain, 0, 1);

  return await viemEvmClient.client.getLogs({
    address: destContract,
    event: v2MessageReceivedEvent,
    fromBlock,
    args: {
      nonce,
    },
  });
};
