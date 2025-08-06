// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {
  Rpc,
  GetAccountInfoApi,
  GetMultipleAccountsApi,
  Instruction,
} from "@solana/kit";
import { AccountRole } from "@solana/kit";
import type { Layout, DeriveType } from "binary-layout";
import { serialize, deserialize } from "binary-layout";
import type { TODO, Text } from "@stable-io/utils";
import { definedOrThrow, encoding } from "@stable-io/utils";
import type { RoPair, RoArray } from "@stable-io/map-utils";
import { mapTo } from "@stable-io/map-utils";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { contractAddressOf } from "@stable-io/cctp-sdk-cctpr-definitions";
import { SolanaAddress, findPda } from "@stable-io/cctp-sdk-solana";
import { type ForeignDomain, oracleAddress } from "./constants.js";
import type { Config } from "./layouts.js";
import { foreignDomainItem, configLayout } from "./layouts.js";
import { chainItem as oracleChainItem } from "./oracleLayouts.js";

//we could include the network parameter here but it's likely not worth the hassle
type RpcType = Rpc<GetAccountInfoApi & GetMultipleAccountsApi>;

export type PriceAddresses = readonly [chainConfig: SolanaAddress, oraclePrices: SolanaAddress];

export type Ix = Required<Instruction>;

export class CctpRBase<N extends Network> {
  private static readonly cacheTtl = 60 * 1000; //1 minute

  public readonly network: N;
  public readonly rpc: RpcType;
  public readonly address: SolanaAddress;
  public readonly oracleAddress: SolanaAddress;

  //for caching of PDA derivations
  private _configAddress: SolanaAddress | undefined;
  private _oracleConfigAddress: SolanaAddress | undefined;
  private _priceAddresses: Map<ForeignDomain<N>, PriceAddresses> = new Map();
  private _cachedConfig: [Config, Date] | undefined;

  constructor(
    network: N,
    rpc: RpcType,
    addresses?: { cctpr?: SolanaAddress; oracle?: SolanaAddress },
  ) {
    this.network = network;
    this.rpc = rpc;
    this.address =
      addresses?.cctpr ?? new SolanaAddress(contractAddressOf(network as Network, "Solana"));
    this.oracleAddress =
      addresses?.oracle ?? new SolanaAddress(oracleAddress);
  }

  async config(): Promise<Config> {
    if (this._cachedConfig && Date.now() < this._cachedConfig[1].getTime() + CctpRBase.cacheTtl)
      return this._cachedConfig[0];

    const config = definedOrThrow(
      await this.fetchAndParseAccountData(this.configAddress(), configLayout),
      `Failed to fetch cctpr config account` as Text,
    );
    this._cachedConfig = [config, new Date()];
    return config;
  }

  protected configAddress(): SolanaAddress {
    if (this._configAddress === undefined)
      this._configAddress = findPda(["config"], this.address)[0];

    return this._configAddress;
  }

  protected oracleConfigAddress(): SolanaAddress {
    if (this._oracleConfigAddress === undefined)
      this._oracleConfigAddress = findPda(["config"], this.oracleAddress)[0];

    return this._oracleConfigAddress;
  }

  protected priceAddresses(domain: ForeignDomain<N>): PriceAddresses {
    const cached = this._priceAddresses.get(domain);
    if (cached)
      return cached;

    const chainConfigPda = findPda(
      ["chain_config", serialize(foreignDomainItem(this.network), domain as TODO)],
      this.address
    )[0];
    const oraclePricesPda = findPda(
      ["prices", serialize(oracleChainItem(this.network), domain as TODO)],
      this.oracleAddress
    )[0];
    const res = [chainConfigPda, oraclePricesPda] as const;
    this._priceAddresses.set(domain, res);
    return res;
  }

  protected invalidateCachedConfig() {
    this._cachedConfig = undefined;
  }

  protected async fetchAndParseAccountData<const L extends Layout>(
    address: SolanaAddress,
    layout: L,
  ): Promise<DeriveType<L> | undefined> {
    const data = (await this.rpc.getAccountInfo(address.unwrap(), { encoding: "base64" }).send())
      .value?.data[0];

    return data ? deserialize(layout, encoding.base64.decode(data)) : undefined;
  }

  protected composeIx<const L extends Layout>(
    addrRoles: RoArray<RoPair<SolanaAddress, AccountRole>>,
    layout: L,
    params: DeriveType<L>,
  ): Ix {
    return {
      accounts: addrRoles.map(([address, role]) => ({ address: address.unwrap(), role })),
      data: serialize(layout, params),
      programAddress: this.address.unwrap(),
    };
  }
}
