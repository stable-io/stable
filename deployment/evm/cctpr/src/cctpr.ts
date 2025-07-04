// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  buildOverridesWithGas,
  ChainInfo,
  Deployment,
  getChain,
  getDeployData,
  getNetwork,
  getViemClient,
  getViemSigner,
  loadAddress,
  loadScriptConfig,
} from "./common.js";
import { ChainConfig } from "./interfaces.js";
import {
  CctpRGovernance,
  FeeAdjustments,
  FeeAdjustmentType,
} from "@stable-io/cctp-sdk-cctpr-evm";
import { CallData, EvmAddress } from "@stable-io/cctp-sdk-evm";
import {
  Domain,
  usdc,
  Network,
  EvmDomains,
  WormholeChainId,
  wormholeChainIdOf,
} from "@stable-io/cctp-sdk-definitions";
import { encoding } from "@stable-io/utils";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";

export type AdjustmentField = {
  absoluteUsdc: number;
  relativePercent: number;
};

export type AdjustmentConfig = {
  v1Adjustments: Record<Domain, AdjustmentField>;
  v2DirectAdjustments: Record<Domain, AdjustmentField>;
  avaxHopAdjustments: Record<Domain, AdjustmentField>;
  gasDropoffAdjustments: Record<Domain, AdjustmentField>;
};

export type CctpRConfig = {
  owner: string;
  feeAdjuster: string;
  feeRecipient: string;
  offChainQuoter: string;
} & ChainConfig;

export type GasDropoffConfig = {
  messageTransmitterV1: string;
  messageTransmitterV2: string;
} & ChainConfig;

export type AvaxRouterConfig = {
  messageTransmitterV2: string;
  tokenMessengerV1: string;
  usdc: string;
} & ChainConfig;

// This is the type of the in-file configuration object
export type CctpRChainConfig = AvaxRouterConfig & CctpRConfig & GasDropoffConfig;

// Identifiers for deployment addresses.
// These are used with `loadAddress`, `loadContractsFromFile`, etc
export const cctprName = "CctpR";
export const avaxRouterName = "AvaxRouter";
export const cctpGasDropoffName = "CctpGasDropoff";
// TODO: Remove this hardcoded name
const priceOracleName = "PriceOracle";

export function configToFeeAdjustments(config: Partial<Record<Domain, AdjustmentField>>) {
  return Object.entries(config).reduce<Partial<FeeAdjustments>>((config, [domain, adjustment]) => {
    config[domain as Domain] = {
      absoluteUsdc: usdc(adjustment.absoluteUsdc),
      relativePercent: adjustment.relativePercent,
    };
    return config;
  }, {});
}

export function loadFeeAdjustments(): Record<FeeAdjustmentType, Partial<FeeAdjustments>> {
  const config = loadScriptConfig<AdjustmentConfig>("CctpRFeeAdjustments");
  return {
    v1: configToFeeAdjustments(config.v1Adjustments),
    v2Direct: configToFeeAdjustments(config.v2DirectAdjustments),
    avaxHop: configToFeeAdjustments(config.avaxHopAdjustments),
    gasDropoff: configToFeeAdjustments(config.gasDropoffAdjustments),
  };
}

export async function deployCctpR(
  chain: ChainInfo,
  configParameters: CctpRConfig,
): Promise<Deployment> {
  const network = getNetwork();
  const viemSigner = getViemSigner(network, chain);
  const viemClient = getViemClient(network, chain);
  const priceOracleAddress = loadAddress(priceOracleName, chain.chainId);

  if (priceOracleAddress === undefined) {
    return {
      chainId: chain.chainId,
      error: new Error(`Price oracle deployment missing for chain ${chain.chainId}`),
    };
  }

  const callData = CctpRGovernance.constructorCalldata(
    network,
    chain.domain,
    new EvmAddress(configParameters.owner),
    new EvmAddress(configParameters.feeAdjuster),
    new EvmAddress(configParameters.feeRecipient),
    new EvmAddress(configParameters.offChainQuoter),
    new EvmAddress(priceOracleAddress),
    loadFeeAdjustments(),
  );

  const data = getDeployData(cctprName, callData);
  const from = new EvmAddress(viemSigner.account.address);
  try {
    const overrides = await buildOverridesWithGas(
      viemClient,
      { from, data: encoding.hex.decode(data) as CallData },
      chain,
    );

    const hash = await viemSigner.sendTransaction({
      ...overrides,
      data,
    });

    const receipt = await viemClient.client.waitForTransactionReceipt({ hash });
    const address = receipt.contractAddress;
    if (!address) {
      throw new Error("Contract address was undefined");
    }
    return { address, chainId: chain.chainId };
  } catch (error) {
    return { chainId: chain.chainId, error };
  }
}

export function getCctpRGovernance(
  client: ViemEvmClient<Network, keyof EvmDomains>,
  chain: ChainInfo,
) {
  const address = loadAddress(cctprName, chain.chainId);
  if (address === undefined) {
    throw new Error(`Chain ${chain.chainId} does not have a ${cctprName} deployment.`);
  }
  return new CctpRGovernance(client);
}

export function loadCctpRAddress(chain: WormholeChainId) {
  return loadAddress(cctprName, chain);
}

export function loadCctpGasDropoffAddress(chain: WormholeChainId) {
  return loadAddress(cctpGasDropoffName, chain);
}

export function loadAvaxRouterAddress() {
  return loadAddress(avaxRouterName, wormholeChainIdOf("Testnet", "Avalanche"));
}

export async function deployAvaxRouter(): Promise<Deployment> {
  const network = getNetwork();
  const chainId = wormholeChainIdOf(network, "Avalanche");
  const chain = getChain(chainId);
  const viemSigner = getViemSigner(network, chain);
  const viemClient = getViemClient(network, chain);

  const callData = CctpRGovernance.avaxRouterConstructorCalldata(network);

  const data = getDeployData(avaxRouterName, callData);
  const from = new EvmAddress(viemSigner.account.address);
  try {
    const overrides = await buildOverridesWithGas(
      viemClient,
      { from, data: encoding.hex.decode(data) as CallData },
      chain,
    );

    const hash = await viemSigner.sendTransaction({
      ...overrides,
      data,
    });

    const receipt = await viemClient.client.waitForTransactionReceipt({ hash });
    const address = receipt.contractAddress;
    if (!address) {
      throw new Error("Contract address was undefined");
    }
    return { address, chainId };
  } catch (error) {
    return { chainId, error };
  }
}

export async function deployGasDropoff(chain: ChainInfo): Promise<Deployment> {
  const network = getNetwork();
  const viemSigner = getViemSigner(network, chain);
  const viemClient = getViemClient(network, chain);

  const callData = CctpRGovernance.gasDropoffConstructorCalldata(network, chain.domain);

  const data = getDeployData(cctpGasDropoffName, callData);
  const from = new EvmAddress(viemSigner.account.address);
  try {
    const overrides = await buildOverridesWithGas(
      viemClient,
      { from, data: encoding.hex.decode(data) as CallData },
      chain,
    );

    const hash = await viemSigner.sendTransaction({
      ...overrides,
      data,
    });

    const receipt = await viemClient.client.waitForTransactionReceipt({ hash });
    const address = receipt.contractAddress;
    if (!address) {
      throw new Error("Contract address was undefined");
    }
    return { address, chainId: chain.chainId };
  } catch (error) {
    return { chainId: chain.chainId, error };
  }
}
