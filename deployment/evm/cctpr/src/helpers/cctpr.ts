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
  loadContractsFromFile,
} from "./common.js";
import { ChainConfig } from "./interfaces.js";
import { FeeAdjustmentType } from "@stable-io/cctp-sdk-cctpr-definitions";
import { CctpRGovernance, FeeAdjustments, layouts } from "@stable-io/cctp-sdk-cctpr-evm";
import { CallData, EvmAddress } from "@stable-io/cctp-sdk-evm";
import {
  Domain,
  usdc,
  Network,
  EvmDomains,
  WormholeChainId,
  wormholeChainIdOf,
} from "@stable-io/cctp-sdk-definitions";
import { Hex } from "viem";
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

export function adjustmentEquals(
  current: layouts.FeeAdjustment,
  expected: layouts.FeeAdjustment,
): boolean {
  return current.absoluteUsdc.eq(expected.absoluteUsdc) &&
    current.relativePercent === expected.relativePercent;
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
    return { address, txId: hash, chainId: chain.chainId };
  } catch (error) {
    return { chainId: chain.chainId, error };
  }
}

export function getCctpRGovernance(
  client: ViemEvmClient<Network, keyof EvmDomains>,
  chain: ChainInfo,
): CctpRGovernance {
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
    return { address, txId: hash, chainId };
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
    return { address, txId: hash, chainId: chain.chainId };
  } catch (error) {
    return { chainId: chain.chainId, error };
  }
}

export type VerificationResult = {
  domain: Domain;
  contractName: string;
  address: string;
  forgeCommand: string;
  constructorArgs: string;
};

type BytecodeVerificationError = {
  error: string;
};

export type BytecodeVerificationResult = {
  domain: Domain;
  contractName: string;
} & (BytecodeVerificationError | (
  {
    address: string;
    txId: Hex;
  } & (BytecodeVerificationError | {
    expectedBytecode: Hex;
    actualBytecode: Hex;
    expectedAddress: EvmAddress;
    actualAddress: EvmAddress;
    sender: EvmAddress;
    owner: EvmAddress | undefined;
  })
));

export function generateForgeVerifyCommand(
  chain: ChainInfo,
  contractName: string,
  constructorData: Uint8Array,
): VerificationResult {
  const address = loadAddress(contractName, chain.chainId);

  if (!address) {
    throw new Error(`Contract ${contractName} not deployed on chain ${chain.domain}`);
  }

  // Convert constructor args to hex string
  const constructorArgs = encoding.hex.encode(constructorData, true);
  // Generate Forge verify command with contract directory
  const forgeCommand = `forge verify-contract ${address} ${contractName} \
    --chain-id ${chain.evmNetworkId} --constructor-args ${constructorArgs} --watch`;

  return {
    domain: chain.domain,
    contractName,
    address,
    forgeCommand,
    constructorArgs,
  };
}

export function generateCctpRVerifyCommand(
  chain: ChainInfo,
  configParameters: CctpRConfig,
): VerificationResult {
  const network = getNetwork();
  const priceOracleAddress = loadAddress(priceOracleName, chain.chainId);

  if (priceOracleAddress === undefined) {
    throw new Error(`Price oracle deployment missing for chain ${chain.chainId}`);
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

  return generateForgeVerifyCommand(chain, cctprName, callData);
}

export function generateAvaxRouterVerifyCommand(): VerificationResult {
  const network = getNetwork();
  const chainId = wormholeChainIdOf(network, "Avalanche");
  const chain = getChain(chainId);

  const callData = CctpRGovernance.avaxRouterConstructorCalldata(network);
  return generateForgeVerifyCommand(chain, avaxRouterName, callData);
}

export function generateGasDropoffVerifyCommand(chain: ChainInfo): VerificationResult {
  const network = getNetwork();
  const callData = CctpRGovernance.gasDropoffConstructorCalldata(network, chain.domain);
  return generateForgeVerifyCommand(chain, cctpGasDropoffName, callData);
}

export async function fetchContractDeployment(
  chain: ChainInfo,
  contractName: string,
  getExpectedCallData: () => Uint8Array,
  owner?: EvmAddress,
): Promise<BytecodeVerificationResult> {
  const network = getNetwork();
  const viemClient = getViemClient(network, chain);
  const address = loadAddress(contractName, chain.chainId);

  if (!address) {
    throw new Error(`Contract ${contractName} not deployed on chain ${chain.domain}`);
  }

  const deployments = loadContractsFromFile(contractName);
  const deployment = deployments.find(d => d.chainId === chain.chainId);

  if (!deployment?.txId) {
    throw new Error(`No transaction ID found for ${contractName} on chain ${chain.chainId}`);
  }

  const expectedCallData = getExpectedCallData();
  const expectedBytecode = getDeployData(contractName, expectedCallData);

  const result = {
    domain: chain.domain,
    contractName,
    address,
    txId: deployment.txId,
  };

  return viemClient.client.getTransaction({ hash: deployment.txId }).then(async (transaction) => {
    const receipt = await viemClient.client.getTransactionReceipt({ hash: deployment.txId });
    if (!receipt.contractAddress) {
      throw new Error(`No contract address found for transaction ${deployment.txId}`);
    }
    return {
      ...result,
      expectedBytecode,
      actualBytecode: transaction.input,
      expectedAddress: new EvmAddress(deployment.address),
      actualAddress: new EvmAddress(receipt.contractAddress),
      sender: new EvmAddress(transaction.from),
      owner,
    };
  }).catch((error: unknown) => {
    return {
      ...result,
      error: error instanceof Error ? error.message : String(error),
    };
  });
}

export async function fetchCctpRDeployment(
  chain: ChainInfo,
  configParameters: CctpRConfig,
): Promise<BytecodeVerificationResult> {
  const priceOracleAddress = loadAddress(priceOracleName, chain.chainId);
  if (priceOracleAddress === undefined) {
    throw new Error(`Price oracle deployment missing for chain ${chain.chainId}`);
  }
  const owner = new EvmAddress(configParameters.owner);
  return fetchContractDeployment(
    chain,
    cctprName,
    () => CctpRGovernance.constructorCalldata(
      getNetwork(),
      chain.domain,
      owner,
      new EvmAddress(configParameters.feeAdjuster),
      new EvmAddress(configParameters.feeRecipient),
      new EvmAddress(configParameters.offChainQuoter),
      new EvmAddress(priceOracleAddress),
      loadFeeAdjustments(),
    ),
    owner,
  );
}

export async function fetchAvaxRouterDeployment(): Promise<BytecodeVerificationResult> {
  const network = getNetwork();
  const chainId = wormholeChainIdOf(network, "Avalanche");
  const chain = getChain(chainId);
  return fetchContractDeployment(
    chain,
    avaxRouterName,
    () => CctpRGovernance.avaxRouterConstructorCalldata(network),
  );
}

export async function fetchGasDropoffDeployment(
  chain: ChainInfo,
): Promise<BytecodeVerificationResult> {
  return fetchContractDeployment(
    chain,
    cctpGasDropoffName,
    () => CctpRGovernance.gasDropoffConstructorCalldata(getNetwork(), chain.domain),
  );
}
