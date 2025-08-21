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
import type { Receive } from "src/types/receive.js";
import { pollUntil, type PollingConfig } from "@stable-io/utils";
import { SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";

const receiveScanBufferPerChain: Record<SupportedEvmDomain<Network>, bigint> = {
  // Around 40s for each chain, depending on their block time
  Ethereum: 4n,
  Avalanche: 20n,
  Optimism: 20n,
  Arbitrum: 180n,
  Base: 20n,
  Polygon: 20n,
  Unichain: 20n,
  Linea: 20n,
  Codex: 20n, // couldn't find blocktime data. just guessing for this one.
  Sonic: 40n,
  Worldchain: 20n,
};

export async function findTransferReceive<N extends Network>(
  network: N,
  rpcUrl: Url,
  attestation: CctpAttestation,
  config: PollingConfig = {},
): Promise<Receive> {
  const defaultConfig: PollingConfig = {
    baseDelayMs: 300,
    maxDelayMs: 1200,
  };
  const { cctpVersion, nonce, sourceDomain, targetDomain } = attestation;
  const viemEvmClient = ViemEvmClient.fromNetworkAndDomain(
    network,
    targetDomain,
    rpcUrl,
  );

  let fromBlock = await viemEvmClient.getLatestBlock() - receiveScanBufferPerChain[targetDomain];
  return await pollUntil(async () => {
    const [latestBlock, logs] = await Promise.all([
      viemEvmClient.getLatestBlock(),
      cctpVersion === 1 ?
        getV1ReceiveLogs(network, viemEvmClient, nonce, targetDomain, fromBlock) :
        await getV2ReceiveLogs(network, viemEvmClient, nonce, targetDomain, fromBlock),
    ]);

    const filteredLogs = logs.filter(log => log.args.sourceDomain === domainIdOf(sourceDomain));
    if (filteredLogs.length > 1) {
      throw new Error(`Found multiple ${filteredLogs.length} receive logs for the same nonce.`);
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

async function getV1ReceiveLogs<
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

async function getV2ReceiveLogs<
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
