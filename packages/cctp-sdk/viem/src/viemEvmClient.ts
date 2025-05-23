// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {
  Domain, Network, DomainsOf, GasTokenOf, GasTokenCtrOf,
} from "@stable-io/cctp-sdk-definitions";
import { domainOfChainId, domainsOf, gasTokenOf, isEvmDomain, usdc } from "@stable-io/cctp-sdk-definitions";
import type { RoArray } from "@stable-io/map-utils";
import type { TODO, Url } from "@stable-io/utils";
import { encoding } from "@stable-io/utils";
import type {
  EvmAddress,
  EvmClient,
  BaseTx,
  ContractTx,
  AccessList,
  ReturnData,
  StorageData,
} from "@stable-io/cctp-sdk-evm";
import { wordSize } from "@stable-io/cctp-sdk-evm";
import type { AccessList as ViemAccessList } from "viem";
import { createPublicClient, http, parseAbiItem } from "viem";
import {
  type Chain as ViemChain,
  mainnet         as ethereumMainnet,
  sepolia         as ethereumTestnet,
  avalanche       as avalancheMainnet,
  avalancheFuji   as avalancheTestnet,
  optimism        as optimismMainnet,
  optimismSepolia as optimismTestnet,
  arbitrum        as arbitrumMainnet,
  arbitrumSepolia as arbitrumTestnet,
  base            as baseMainnet,
  baseSepolia     as baseTestnet,
  polygon         as polygonMainnet,
  polygonAmoy     as polygonTestnet,
  unichain        as unichainMainnet,
  unichainSepolia as unichainTestnet,
  linea           as lineaMainnet,
  lineaSepolia    as lineaTestnet,
  sonic           as sonicMainnet,
  sonicTestnet    as sonicTestnet,
} from "viem/chains";
import { Amount, KindWithAtomic } from "@stable-io/amount";

export const viemChainOf = {
  Mainnet: {
    Ethereum:  ethereumMainnet,
    Avalanche: avalancheMainnet,
    Optimism:  optimismMainnet,
    Arbitrum:  arbitrumMainnet,
    Base:      baseMainnet,
    Polygon:   polygonMainnet,
    Unichain:  unichainMainnet,
    Linea:     lineaMainnet,
    Sonic:     sonicMainnet,
  },
  Testnet: {
    Ethereum:  ethereumTestnet,
    Avalanche: avalancheTestnet,
    Optimism:  optimismTestnet,
    Arbitrum:  arbitrumTestnet,
    Base:      baseTestnet,
    Polygon:   polygonTestnet,
    Unichain:  unichainTestnet,
    Linea:     lineaTestnet,
    Sonic:     sonicTestnet,
  },
} as const satisfies Record<Network, Record<DomainsOf<"Evm">, ViemChain>>;

type ViemChainOf<N extends Network, D extends DomainsOf<"Evm">> = typeof viemChainOf[N][D];

type ViemPublicClientOf<N extends Network, D extends DomainsOf<"Evm">> = ReturnType<
  typeof createPublicClient<ReturnType<typeof http>, ViemChainOf<N, D>>
>;

export class ViemEvmClient<N extends Network, D extends DomainsOf<"Evm">> implements
  EvmClient<N, D> {
  readonly network: N;
  readonly domain: D;
  readonly client: ViemPublicClientOf<N, D>;
  readonly gasTokenCtr: GasTokenCtrOf<D>;

  private constructor(network: N, domain: D, client: ViemPublicClientOf<N, D>) {
    this.network = network;
    this.domain = domain;
    this.client = client;
    this.gasTokenCtr = gasTokenOf(this.domain);
  }

  static fromViemClient<N extends Network, D extends DomainsOf<"Evm">>(
    client: ViemPublicClientOf<N, D>,
  ): ViemEvmClient<N, D> {
    const network = (client.chain.testnet ? "Testnet" : "Mainnet") as N;
    const domains: RoArray<Domain> = domainOfChainId(network, BigInt(client.chain.id) as TODO);
    const domain = domains.find(domain => isEvmDomain(domain))! as D;
    return new ViemEvmClient(network, domain, client);
  }

  static fromNetworkAndDomain<N extends Network, D extends DomainsOf<"Evm">>(
    network: N,
    domain: D,
    rpcUrl?: Url,
  ): ViemEvmClient<N, D> {
    const client = createPublicClient({
      chain: viemChainOf[network][domain],
      transport: http(rpcUrl),
    });

    return new ViemEvmClient(network, domain, client);
  }

  async getBalance(address: EvmAddress): Promise<GasTokenOf<D, DomainsOf<"Evm">>> {
    const balance = await this.client.getBalance({ address: address.unwrap() });
    return this.gasToken(balance);
  }

  async getLatestBlock(): Promise<bigint> {
    return this.client.getBlockNumber();
  }

  async getStorageAt(contract: EvmAddress, slot: bigint): Promise<StorageData> {
    return this.client.getStorageAt({
      address: contract.unwrap(),
      slot: `0x${slot.toString(16)}`,
    }).then(res => (
      res ? encoding.hex.decode(res) : new Uint8Array(wordSize)
    ) as StorageData);
  }

  async ethCall(tx: ContractTx): Promise<ReturnData> {
    const txArgs = {
      account: tx.from?.unwrap(),
      to: tx.to.unwrap(),
      data: encoding.hex.encode(tx.data, true),
      value: tx.value?.toUnit("atomic"),
      accessList: this.toViemAccessList(tx.accessList),
    } as const;
    //type inference is not working here for some reason - when defining a concrete client locally
    //  via createPublicClient and invoking the call method, there's no complaint
    const res = await this.client.call(txArgs as TODO);
    return (res.data ? encoding.hex.decode(res.data) : new Uint8Array(0)) as ReturnData;
    // return this.client.ethCall({ ...partialTx, to: partialTx.to.unwrap() });
  }

  async estimateGas(tx: BaseTx): Promise<GasTokenOf<D, DomainsOf<"Evm">>> {
    const txArgs = {
      account: tx.from?.unwrap(),
      to: tx.to.unwrap(),
      data: tx.data ? encoding.hex.encode(tx.data, true) : undefined,
      value: tx.value?.toUnit("atomic"),
      accessList: this.toViemAccessList(tx.accessList),
    } as const;
    return this.gasToken(await this.client.estimateGas(txArgs as TODO));
  }

  private gasToken(amount: bigint): GasTokenOf<D> {
    //not sure why tsc insists that gasTokenCtr doesn't return GasTokenOf<D> already
    return this.gasTokenCtr(amount, "atomic") as unknown as GasTokenOf<D>;
  }

  private toViemAccessList(accessList?: AccessList): ViemAccessList {
    return accessList
      ? accessList.map(al => ({
          address: al.address.unwrap(),
          storageKeys: al.storageKeys.map<`0x${string}`>(sk => `0x${sk.toString(16)}`),
        }))
      : [];
  }
}
