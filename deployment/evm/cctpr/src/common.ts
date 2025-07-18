// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { eth, EvmDomains, Network, WormholeChainId, domainOfWormholeChainId } from "@stable-io/cctp-sdk-definitions";
import { viemChainOf, ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { BaseTx } from "@stable-io/cctp-sdk-evm";
import { Url, encoding } from "@stable-io/utils";
import { inspect } from "node:util";
import {
  Account,
  Chain,
  concat,
  createWalletClient,
  Hex,
  http,
  Transport,
  WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";

// ⚠️ Importing from contract or protocol specific SDKs MUST be avoided in this file.

export type ChainInfo = {
  domain: keyof EvmDomains;
  evmNetworkId: number;
  chainId: WormholeChainId;
  rpc: string;
};

export type Deployment = {
  chainId: WormholeChainId;
} & (
  | { address: string }
  | { address?: string; error: unknown }
);

export interface SerializedDeployment {
  chainId: WormholeChainId;
  address: string;
};

export type SupportedChains = {
  supportedChains: WormholeChainId[];
};

export interface OperationDescriptor {
  /**
   * Txs will be signed for these chains
   */
  operatingChains: ChainInfo[];
  /**
   * Deployment artifacts exist for these chains and may be used to perform
   * cross registration or sanity checks.
   * Excludes operating chains.
   */
  supportedChains: ChainInfo[];
}

export type Overrides = {
  type: "legacy";
  gas?: bigint;
  gasPrice?: bigint;
} | {
  type: "eip1559";
  gas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

export let env = "";

export function init(): string {
  return env = resolveEnv(["ENV"]);
}

/**
 * Reads env vars and returns the first one that is defined and non empty.
 */
export function resolveEnv(envNames: string[]): string {
  for (const env of envNames) {
    const v = process.env[env];
    if (v) return v;
  }
  throw new Error(`At least one of these env vars needs to be set: ${inspect(envNames)}`);
}

export function getEnvOrDefault(env: string, defaultValue: string): string {
  try {
    return resolveEnv([env]);
  } catch {
    return defaultValue;
  }
}

export function getNetwork(): Network {
  if (env.toLowerCase() === "mainnet")
    return "Mainnet";
  return "Testnet";
}

type ChainConfig = {
  chainId: WormholeChainId;
};

export function getChainConfig<T extends ChainConfig>(
  filename: string, chainId: WormholeChainId,
): T {
  const scriptConfig = loadScriptConfig<T[]>(filename);

  const chainConfig = scriptConfig.find(x => x.chainId == chainId);

  if (!chainConfig) {
    throw new Error(`Failed to find chain config for chain ${chainId}`);
  }

  return chainConfig;
}

const loadedConfigs: Record<string, any> = {};

/**
 * Writes to a config after loading it are not synchronized.
 */
export function loadScriptConfig<T>(filename: string): T {
  if (!loadedConfigs[filename]) {
    // TODO: loading configuration should be done by component
    // (instead of having all config inside the same directory)...
    const configFile = fs.readFileSync(
      `../config/${env}/scriptConfigs/${filename}.json`,
    );
    const config = JSON.parse(configFile.toString());
    if (!config) {
      throw new Error("Failed to pull config file!");
    }
    loadedConfigs[filename] = config;
  }

  return loadedConfigs[filename];
}

function getOperatingChainIds() {
  let operatingChains: number[] | undefined;

  const chains = readChains();
  if (chains.operatingChains !== undefined) {
    operatingChains = chains.operatingChains;
  }
  return operatingChains;
}

export function isOperatingChain(chain: WormholeChainId): boolean {
  return getOperatingChainIds()?.find(someChain => someChain === chain) !== undefined;
}

export function getOperatingChains(): ChainInfo[] {
  const allChains = loadChains();
  const operatingChains = getOperatingChainIds();

  if (operatingChains === undefined) {
    return allChains;
  }

  const output: ChainInfo[] = [];
  for (const chain of operatingChains) {
    const item = allChains.find((y) => {
      return chain == y.chainId;
    });
    if (item !== undefined) {
      output.push(item);
    }
  }

  return output;
}

export function readBytecode(contractName: string): Hex {
  const filepath = `./build-contracts/${contractName}.sol/${contractName}.json`;
  if (!fs.existsSync(filepath)) {
    throw new Error(`Failed to find bytecode file for contract ${contractName} at ${filepath}`);
  }
  const contractFile = fs.readFileSync(filepath, "utf8");
  const contractJson = JSON.parse(contractFile);
  if (!contractJson || !contractJson.bytecode) {
    throw new Error(`Failed to find bytecode in contract file ${filepath}`);
  }
  return contractJson.bytecode.object as Hex;
}

export function getDeployData(contractName: string, callData: Uint8Array): Hex {
  const bytecode = readBytecode(contractName);
  return concat([bytecode, encoding.hex.encode(callData, true)]);
}

export function getOperationDescriptor(): OperationDescriptor {
  const allChains = loadChains();
  const operatingChains = getOperatingChainIds();

  if (operatingChains === undefined) {
    return { operatingChains: allChains, supportedChains: [] };
  }

  const result: OperationDescriptor = {
    operatingChains: [],
    supportedChains: [],
  };
  for (const chain of allChains) {
    const item = operatingChains.find((y) => {
      return chain.chainId == y;
    });
    if (item === undefined) {
      result.supportedChains.push(chain);
    } else {
      result.operatingChains.push(chain);
    }
  }

  return result;
}

let parsedChains: any;
export function readChains() {
  if (parsedChains !== undefined) return parsedChains;
  const filepath = `../config/${env.toLowerCase()}/chains.json`;
  const chainFile = fs.readFileSync(filepath, "utf8");
  return parsedChains = JSON.parse(chainFile);
}

export function loadChains(): ChainInfo[] {
  const chains = readChains();
  if (!chains.chains) {
    throw new Error("Couldn't find chain information!");
  }
  return chains.chains;
}

export function getChain(chain: WormholeChainId): ChainInfo {
  const chains = loadChains();
  const output = chains.find(x => x.chainId == chain);
  if (!output) {
    throw new Error("bad chain ID");
  }

  return output;
}

export function loadPrivateKey(): string {
  const privateKey = resolveEnv(["WALLET_KEY"]);
  if (!privateKey) {
    throw new Error("Failed to find private key for this process!");
  }
  return privateKey;
}

export function loadDeliveryProviders() {
  return loadContractsFromFile("deliveryProviders");
}

export function getChainContractAddress(contractName: string, chainId: WormholeChainId) {
  const chainContract = loadAddress(contractName, chainId);

  if (chainContract === undefined) {
    throw new Error(`Failed to find ${contractName} for chain ${chainId}`);
  }

  return chainContract;
}

export function loadCreate2Factories(): Deployment[] {
  return loadContractsFromFile("create2Factories");
}

export function getViemSigner(
  network: Network, chain: ChainInfo,
): WalletClient<Transport, Chain, Account> {
  const url = getRpcURL(chain);
  const viemChain = viemChainOf[network][chain.domain];
  const privateKey = loadPrivateKey();
  return createWalletClient({
    account: privateKeyToAccount(privateKey as Hex),
    chain: viemChain,
    transport: http(url),
  });
}

export function getViemClient(network: Network, chain: ChainInfo) {
  return ViemEvmClient.fromNetworkAndDomain(network, chain.domain, getRpcURL(chain));
}

export function getRpcURL(chain: ChainInfo): Url {
  const provider = loadChains().find((x: any) => x.chainId == chain.chainId)?.rpc || "";
  if (!provider) {
    throw new Error(`Failed to find a RPC provider for ${chain.domain}`);
  }
  return provider as Url;
}

export function getDeliveryProviderAddress(chain: ChainInfo): string {
  return getChainContractAddress("deliveryProvider", chain.chainId);
}

enum ContractWrites {
  NoChanges,
}

type ContractsJson = Record<string, SerializedDeployment[]>;
class ContractAddresses {
  static contractAddresses?: ContractAddresses;
  public static get(): ContractAddresses {
    return this.contractAddresses ?? new ContractAddresses(env);
  }

  public readonly path: string;
  private readonly contracts: ContractsJson;

  private constructor(env: string) {
    this.path = `../config/${env}/contracts.json`;
    const contractsFile = fs.readFileSync(this.path, "utf8");
    // TODO perform validation?
    this.contracts = JSON.parse(contractsFile);
  }

  // TODO Idea: further isolate writes by project by namespacing them to project name.
  // Reads should be allowed to all projects.
  // This would help avoid accidental overwrites of same name objects of different projects.
  // TODO: Idea 2: add git commit field to each deployment descriptor here
  updateContracts(newContracts: ContractsJson) {
    if (Object.values(newContracts).every(deployments => deployments.length === 0)) {
      return ContractWrites.NoChanges;
    }

    for (const [key, newDeployments] of Object.entries(newContracts)) {
      const savedDeployments = this.contracts[key] ?? [];
      this.contracts[key] = this.mergeContractAddresses(
        savedDeployments,
        newDeployments,
      );
    }

    const serializedContracts = this.serialize();
    fs.writeFileSync(this.path, serializedContracts);
    return serializedContracts;
  }

  private updateContractAddress(
    arr: SerializedDeployment[],
    newAddress: SerializedDeployment,
  ) {
    const idx = arr.findIndex(a => a.chainId === newAddress.chainId);
    if (idx === -1) {
      arr.push(newAddress);
    } else {
      arr[idx] = newAddress;
    }
  }

  private mergeContractAddresses(
    arr: SerializedDeployment[],
    newAddresses: SerializedDeployment[],
  ): SerializedDeployment[] {
    const newArray = [...arr];
    for (const newAddress of newAddresses) {
      this.updateContractAddress(newArray, newAddress);
    }
    return newArray;
  }

  loadAddress(name: string, chain: WormholeChainId) {
    return this.contracts[name]?.find(a => a.chainId === chain)?.address;
  }

  loadContract(name: string): SerializedDeployment[] {
    const addresses = this.contracts[name];
    if (addresses === undefined) throw new Error(`Failed to find ${name} in contracts file`);
    return addresses;
  }

  tryLoadContract(name: string): SerializedDeployment[] | undefined {
    return this.contracts[name];
  }

  serialize() {
    return JSON.stringify(this.contracts, undefined, 2);
  }
}

export function loadAddress(name: string, chain: WormholeChainId) {
  const contractAddresses = ContractAddresses.get();
  return contractAddresses.loadAddress(name, chain);
}

export function loadContractsFromFile(contractName: string) {
  const contractAddresses = ContractAddresses.get();
  return contractAddresses.loadContract(contractName);
}

export function tryLoadContractsFromFile(contractName: string) {
  const contractAddresses = ContractAddresses.get();
  return contractAddresses.tryLoadContract(contractName);
}

export function writeOutputFiles(output: unknown, processName: string) {
  fs.mkdirSync(`./out/${env}/${processName}`, {
    recursive: true,
  });
  fs.writeFileSync(
    `./out/${env}/${processName}/lastrun.json`,
    JSON.stringify(output),
    { flag: "w" },
  );
  fs.writeFileSync(
    `./out/${env}/${processName}/${Date.now()}.json`,
    JSON.stringify(output),
    { flag: "w" },
  );
}

/**
 * Saves deployments using the (contract, chain id) tuple as a key.
 * Overwrites old deployments are any for that particular contract and chain id.
 */
export function saveDeployments(
  newContracts: ContractsJson,
  processName: string,
) {
  writeOutputFiles(newContracts, processName);
  syncContractsJson(newContracts);
}

function syncContractsJson(newContracts: ContractsJson) {
  const contractAddresses = ContractAddresses.get();
  // console.log(`Old:\n${contractAddresses.serialize()}`);
  const writtenFile = contractAddresses.updateContracts(newContracts);
  if (writtenFile === ContractWrites.NoChanges) {
    console.info("No changes to deployments.");
    return;
  }
  // console.log(`New:\n${writtenFile}`);
}

export async function buildOverridesWithGas(
  viemClient: ViemEvmClient<Network, keyof EvmDomains>,
  tx: BaseTx,
  chain: ChainInfo,
): Promise<Overrides> {
  const estimate = await viemClient.estimateGas(tx);
  // We multiply gas estimation by a factor 1.1 to avoid slightly skewed estimations
  const gas = estimate * 11n / 10n;
  return { gas, ...buildOverrides(chain) };
};

export function buildOverrides(chain: ChainInfo): Omit<Overrides, "gas"> {
  let type: number | undefined;
  let gasPrice: bigint | undefined;
  let maxFeePerGas: bigint | undefined;
  let maxPriorityFeePerGas: bigint | undefined;
  switch (chain.chainId) {
    case 5:
    case 10007: {
      // For polygon we need to conform with EIP 1559
      type = 2;
      maxFeePerGas = eth("30", "Gwei").toUnit("atomic");
      maxPriorityFeePerGas = eth("25", "Gwei").toUnit("atomic");
      break;
    }
    case 23: {
      // Arbitrum gas price feeds are excessive on public endpoints too apparently.
      type = 2;
      maxFeePerGas = eth("0.3", "Gwei").toUnit("atomic");
      maxPriorityFeePerGas = 0n;
      break;
    }
    case 44: {
      type = 2;
      maxFeePerGas = eth("0.001", "Gwei").toUnit("atomic");
      maxPriorityFeePerGas = eth("0.000000001", "Gwei").toUnit("atomic");
      break;
    }
    case 45: {
      type = 2;
      maxPriorityFeePerGas = eth("0.0001", "Gwei").toUnit("atomic");
      maxFeePerGas = eth("0.001", "Gwei").toUnit("atomic");
      break;
    }
  }
  return {
    ...(gasPrice !== undefined && { gasPrice }),
    ...(type !== undefined && { type: type === 0 ? "legacy" : "eip1559" }),
    ...(maxFeePerGas !== undefined && { maxFeePerGas }),
    ...(maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas }),
  } as Omit<Overrides, "gas">;
}

export function toReadable(chainId: number): string {
  const sdkEnv = env === "testnet" ? "Testnet" : "Mainnet";
  return domainOfWormholeChainId(sdkEnv, chainId as any);
}
