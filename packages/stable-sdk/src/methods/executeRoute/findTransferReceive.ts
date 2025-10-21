// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { domainIdOf, v1, v2, EvmDomains, LoadedDomain } from "@stable-io/cctp-sdk-definitions";
import { encoding, Size, TODO, Url } from "@stable-io/utils";
import type { Network } from "../../types/index.js";
import type { CctpAttestation } from "./findTransferAttestation.js";
import { parseAbiItem } from "viem/utils";
import type { Hex } from "viem";
import type { Receive } from "src/types/receive.js";
import { pollUntil, type PollingConfig } from "@stable-io/utils";
import { SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";
import { SolanaKitClient } from "@stable-io/cctp-sdk-solana-kit";
import { filterCPIEvents, getCpiEvents, SolanaAddress, SolanaClient } from "@stable-io/cctp-sdk-solana";
import { Signature } from "@solana/kit";
import { deserialize, Layout } from "binary-layout";

const receiveScanBufferPerChain: Record<SupportedEvmDomain<Network> | "Solana", bigint> = {
  // Around 40s for each chain, depending on their block time
  Solana: 100n,
  Ethereum: 4n,
  Avalanche: 20n,
  Optimism: 20n,
  Arbitrum: 180n,
  Base: 20n,
  Polygon: 20n,
  Unichain: 20n,
  Linea: 20n,
  Codex: 20n,
  Sonic: 40n,
  Worldchain: 20n,
  Sei: 20n,
  BNB: 20n,
  XDC: 20n,
  HyperEVM: 20n,
  Ink: 20n,
  Plume: 20n,
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
  const setConfig = { ...defaultConfig, ...config };
  if (attestation.targetDomain === "Solana") {
    return await findTransferReceiveSolana(network, rpcUrl, attestation, setConfig);
  }
  return await findTransferReceiveEvm(network, rpcUrl, attestation, setConfig);
}

export async function findTransferReceiveSolana<N extends Network>(
  network: N,
  rpcUrl: Url,
  attestation: CctpAttestation,
  config: PollingConfig,
): Promise<Receive> {
  const { cctpVersion, nonce, sourceDomain } = attestation;
  const client = SolanaKitClient.fromNetworkAndDomain(
    network,
    "Solana",
    rpcUrl,
  );
  const latestBlockhash = await client.getLatestBlockhash();
  const fromSlot = latestBlockhash.slot - receiveScanBufferPerChain["Solana"];
  const block = await client.client.getBlock(fromSlot, { maxSupportedTransactionVersion: 0 }).send();
  let until = block?.transactions[0]?.transaction.signatures[0] as unknown as Signature;
  const signature = await pollUntil(async () => {
    const searchResult = await (cctpVersion === 1 ?
      getV1ReceiveCpiEvent(client, sourceDomain, nonce, until) :
      getV2ReceiveCpiEvent(client, sourceDomain, nonce, until)
    );
    until = searchResult.latestSignature;
    return searchResult.found;
  }, result => result !== undefined, config);
  return {
    destinationDomain: "Solana",
    transactionHash: signature,
  } as Receive;
}

const messageReceivedEventName = "MessageReceived";

async function getReceiveCpiEvent<
  N extends Network,
>(
  client: SolanaClient<N>,
  sourceDomain: LoadedDomain,
  nonce: Uint8Array,
  until: Signature,
  messageTransmitter: SolanaAddress,
  layout: typeof v1LayoutMessageReceived | typeof v2LayoutMessageReceived,
): Promise<{ found?: Signature, latestSignature: Signature }> {
  const signatures = await client.getSignaturesForAddress(messageTransmitter, { until });
  const latestSignature = signatures[0] ?? until;
  for (const signature of signatures) {
    const tx = await pollUntil(async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        return await client.getTransaction(signature);
      } catch (error) {
        return null;
      }
    }, result => result !== null, { baseDelayMs: 1000, maxDelayMs: 2500 });
    const events = getCpiEvents(tx);
    const filteredEvents = filterCPIEvents(
      events, messageReceivedEventName, messageTransmitter
    ).map(
      event => deserialize(layout, event)
    ).filter(
      event => event.sourceDomain === domainIdOf(sourceDomain) &&
        encoding.bytes.equals(nonce, event.nonce)
    )
    if (filteredEvents.length > 0) {
      return { found: signature, latestSignature };
    }
  }
  return { latestSignature };

}

const v1LayoutMessageReceived = [
  { name: "caller", binary: "bytes", size: 32 },
  { name: "sourceDomain", binary: "uint", size: 4, endianness: "little" },
  { name: "nonce", binary: "bytes", size: 8 },
  { name: "sender", binary: "bytes", size: 32 },
  { name: "messageBody", binary: "bytes" },
] as const satisfies Layout;

async function getV1ReceiveCpiEvent<
  N extends Network,
>(
  client: SolanaClient<N>,
  sourceDomain: LoadedDomain,
  nonce: bigint,
  before: Signature,
): Promise<{ found?: Signature, latestSignature: Signature }> {
  const messageTransmitter = new SolanaAddress(
    v1.contractAddressOf(client.network, "Solana" as TODO, "messageTransmitter" as TODO)
  );
  // The nonce value is stored in little endian on chain
  const nonceBytes = encoding.bignum.toBytes(nonce, 8 as Size).reverse();
  return await getReceiveCpiEvent(
    client, sourceDomain, nonceBytes, before, messageTransmitter, v1LayoutMessageReceived
  );
};

const v2LayoutMessageReceived = [
  { name: "caller", binary: "bytes", size: 32 },
  { name: "sourceDomain", binary: "uint", size: 4, endianness: "little" },
  { name: "nonce", binary: "bytes", size: 32 },
  { name: "sender", binary: "bytes", size: 32 },
  { name: "finalityThresholdExecuted", binary: "uint", size: 4, endianness: "little" },
  { name: "messageBody", binary: "bytes" },
] as const satisfies Layout;

async function getV2ReceiveCpiEvent<
  N extends Network,
>(
  client: SolanaClient<N>,
  sourceDomain: LoadedDomain,
  nonce: Hex,
  before: Signature,
): Promise<{ found?: Signature, latestSignature: Signature }> {
  const messageTransmitter = new SolanaAddress(
    v2.contractAddressOf(client.network, "Solana" as TODO, "messageTransmitter" as TODO)
  );
  const nonceBytes = encoding.hex.decode(nonce);
  return await getReceiveCpiEvent(
    client, sourceDomain, nonceBytes, before, messageTransmitter, v2LayoutMessageReceived
  );
};


export async function findTransferReceiveEvm<N extends Network>(
  network: N,
  rpcUrl: Url,
  attestation: CctpAttestation,
  config: PollingConfig,
): Promise<Receive> {
  const { cctpVersion, nonce, sourceDomain, targetDomain } = attestation;
  const searchDomain = targetDomain as keyof EvmDomains;

  // EVM chains
  const viemEvmClient = ViemEvmClient.fromNetworkAndDomain(
    network,
    searchDomain,
    rpcUrl,
  );

  let fromBlock = await viemEvmClient.getLatestBlock() - receiveScanBufferPerChain[targetDomain];
  return await pollUntil(async () => {
    const [latestBlock, logs] = await Promise.all([
      viemEvmClient.getLatestBlock(),
      cctpVersion === 1 ?
        getV1ReceiveLogs(network, viemEvmClient, nonce, searchDomain, fromBlock) :
        getV2ReceiveLogs(network, viemEvmClient, nonce, searchDomain, fromBlock),
    ]);

    const filteredLogs = logs.filter(log => log.args.sourceDomain === domainIdOf(sourceDomain));
    if (filteredLogs.length > 1) {
      throw new Error(`Found multiple ${filteredLogs.length} receive logs for the same nonce.`);
    }

    fromBlock = latestBlock;
    return filteredLogs.length > 0
      ? {
        destinationDomain: searchDomain,
        transactionHash: filteredLogs[0].transactionHash,
      }
      : undefined;
  }, result => result !== undefined, config);
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
