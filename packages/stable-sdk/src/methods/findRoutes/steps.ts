// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { DomainsOf, EvmDomains, LoadedDomain, Platform, Usdc } from "@stable-io/cctp-sdk-definitions";
import type { Corridor } from "@stable-io/cctp-sdk-cctpr-definitions";
import { Permit, ContractTx, Eip2612Data, Eip712Data, selectorOf, Eip2612Message, Permit2TransferFromMessage } from "@stable-io/cctp-sdk-evm";
import { type Permit2GaslessData, execSelector } from "@stable-io/cctp-sdk-cctpr-evm";
import { encoding } from "@stable-io/utils";
import { Network } from "../../types/general.js";
import { getPlatformExecutionCosts } from "../../api/executionCost.js";
import { TxMsg } from "@stable-io/cctp-sdk-solana";
import { SignableEncodedBase64Message } from "@stable-io/cctp-sdk-cctpr-solana";

export type EvmStepType = "evm-sign-permit" | "evm-sign-permit-2" | "evm-pre-approve" | "evm-transfer" | "evm-gasless-transfer";
export type SolanaStepType = "solana-transfer" | "solana-sign-tx" | "solana-gasless-transfer";
export type StepType = EvmStepType | SolanaStepType;
export type PlatformStepType<P extends Platform> =
  P extends "Evm" ? EvmStepType :
  P extends "Solana" ? SolanaStepType :
  never;

export interface EvmCostEstimation {
  gasCostEstimation: bigint;
}

export interface SolanaCostEstimation {
  computationUnits: bigint;
  signatures: number;
  accountBytes: bigint;
}

export type PlatformCostEstimation<P extends Platform> =
  P extends "Evm" ? EvmCostEstimation :
  P extends "Solana" ? SolanaCostEstimation :
  never;

export interface CostEstimation<P extends Platform> {
  sourceChain: PlatformCostEstimation<P>;
  hopChain?: EvmCostEstimation;
}

interface BaseRouteExecutionStep<P extends Platform> {
  type: PlatformStepType<P>;
  chain: DomainsOf<P>;
  platform: P;
  // This is the estimated cost of executing this step on-chain.
  // It may be zero if the step is not executed onchain directly.
  // For example: Gasless relaying and permit signature.
  costEstimation: CostEstimation<P>;
};

export type RouteExecutionStep = EvmSignPermitStep
  | EvmSignPermit2Step
  | EvmPreApproveStep
  | EvmTransferStep
  | EvmGaslessTransferStep
  | SolanaTransferStep
  | SolanaSignTxStep
  | SolanaGaslessTransferStep;

export const EVM_SIGN_PERMIT = "evm-sign-permit" as const;
export interface EvmSignPermitStep extends BaseRouteExecutionStep<"Evm"> {
  type: typeof EVM_SIGN_PERMIT;
};

export const EVM_SIGN_PERMIT_2 = "evm-sign-permit-2" as const;
export interface EvmSignPermit2Step extends BaseRouteExecutionStep<"Evm"> {
  type: typeof EVM_SIGN_PERMIT_2;
}

export const EVM_PRE_APPROVE = "evm-pre-approve" as const;
export interface EvmPreApproveStep extends BaseRouteExecutionStep<"Evm"> {
  type: typeof EVM_PRE_APPROVE;
};

export const EVM_TRANSFER = "evm-transfer" as const;
export interface EvmTransferStep extends BaseRouteExecutionStep<"Evm"> {
  type: typeof EVM_TRANSFER;
};

export const EVM_GASLESS_TRANSFER = "evm-gasless-transfer" as const;
export interface EvmGaslessTransferStep extends BaseRouteExecutionStep<"Evm"> {
  type: typeof EVM_GASLESS_TRANSFER;
};

export const SOLANA_TRANSFER = "solana-transfer" as const;
export interface SolanaTransferStep extends BaseRouteExecutionStep<"Solana"> {
  type: typeof SOLANA_TRANSFER;
};

export const SOLANA_SIGN_TX = "solana-sign-tx" as const;
export interface SolanaSignTxStep extends BaseRouteExecutionStep<"Solana"> {
  type: typeof SOLANA_SIGN_TX;
}

export const SOLANA_GASLESS_TRANSFER = "solana-gasless-transfer" as const;
export interface SolanaGaslessTransferStep extends BaseRouteExecutionStep<"Solana"> {
  type: typeof SOLANA_GASLESS_TRANSFER;
}

/**
 * @param txOrSig at the moment cctp-sdk returns either a contract transaction to sign and send
 *                or an eip2612 message to sign and return to it.
 */
export function getStepType(
  // eslint-disable-next-line @stylistic/max-len
  txOrSig: ContractTx | Eip712Data | GaslessTransferData | TxMsg | SignableEncodedBase64Message | SolanaGaslessTransfer,
): StepType {
  if (isGaslessTransferData(txOrSig)) return EVM_GASLESS_TRANSFER;
  if (isPermit2GaslessData(txOrSig)) return EVM_SIGN_PERMIT_2;
  if (isEip2612Data(txOrSig)) return EVM_SIGN_PERMIT;
  if (isTransferTx(txOrSig)) return EVM_TRANSFER;
  if (isApprovalTx(txOrSig)) return EVM_PRE_APPROVE;
  if (isTxMsg(txOrSig)) return SOLANA_TRANSFER;
  if (isSignableSolanaTx(txOrSig)) return SOLANA_SIGN_TX;
  if (isSolanaGaslessTransfer(txOrSig)) return SOLANA_GASLESS_TRANSFER;
  throw new Error("Unknown Step Type");
}

const isNonNullObject = (subject: unknown): subject is Record<PropertyKey, unknown> =>
  typeof subject === "object" && subject !== null;

const hasKeys = (subject: Record<PropertyKey, unknown>, keys: PropertyKey[]) =>
  keys.every(key => key in subject);

const isObjectWithKeys =
  <K extends PropertyKey>(subject: unknown, keys: K[]): subject is Record<K, unknown> =>
    isNonNullObject(subject) && hasKeys(subject, keys);

export function isContractTx(subject: unknown): subject is ContractTx {
  return isObjectWithKeys(subject, ["data", "to"]);
}

export function isEip712Data(subject: unknown): subject is Eip712Data {
  return isObjectWithKeys(subject, ["domain", "types", "message"]);
}

export function isEip2612Message(subject: unknown): subject is Eip2612Message {
  return isObjectWithKeys(subject, ["owner", "spender", "value", "nonce", "deadline"]);
}

export function isEip2612Data(subject: unknown): subject is Eip2612Data {
  return isEip712Data(subject) && isEip2612Message(subject.message);
}

export function isPermit2TransferFromMessage(subject: unknown):
  subject is Permit2TransferFromMessage {
  return isObjectWithKeys(subject, ["nonce", "deadline", "permitted"]) &&
    isNonNullObject(subject.permitted) &&
    hasKeys(subject.permitted, ["token", "amount"]);
}

export function isPermit2GaslessData(subject: unknown): subject is Permit2GaslessData {
  return isEip712Data(subject) && isPermit2TransferFromMessage(subject.message);
}

export type GaslessTransferData = {
  permit2GaslessData: Permit2GaslessData;
  txHash: `0x${string}`;
  permit2Signature: `0x${string}`;
  // present if a permit was involved in the transfer
  permit?: Permit;
};
export function isGaslessTransferData(subject: unknown): subject is GaslessTransferData {
  if (typeof subject !== "object" || subject === null) return false;
  if (!("permit2GaslessData" in subject) || !isPermit2GaslessData(subject.permit2GaslessData))
    return false;
  if (!("txHash" in subject) || typeof subject.txHash !== "string") return false;
  if (!("permit2Signature" in subject) || typeof subject.permit2Signature !== "string")
    return false;
  if (("permit" in subject) && !isPermit(subject.permit)) return false;

  return true;
}

function isPermit(subject: unknown): subject is Permit {
  if (typeof subject !== "object" || subject === null) return false;
  return (
    "value" in subject
    && "deadline" in subject
    && "signature" in subject
  );
}
export interface ApprovalTx extends ContractTx {};
export function isApprovalTx(subject: unknown): subject is ApprovalTx {
  if (!isContractTx(subject)) return false;
  const approvalFuncSelector = selectorOf("approve(address,uint256)");
  return encoding.bytes.equals(
    subject.data.subarray(0, approvalFuncSelector.length),
    approvalFuncSelector,
  );
}

export interface TransferTx extends ContractTx {};
export function isTransferTx(subject: unknown): subject is TransferTx {
  if (!isContractTx(subject)) return false;
  /**
   * Warning: this implementation is brittle at best.
   *          "exec768" selector can be used for other things (such as governance atm).
   *          On the SDK we only need to differentiate from an approval tx, so we'll
   *          tolerate the tech debt.
   *          This can be solved in many ways when the time comes, eg:
   *            - parsing the next byte to check is a one of the transfer variants
   *            - try/catching a call to parseTransferTxCalldata
   */
  return encoding.bytes.equals(
    subject.data.subarray(0, execSelector.length),
    execSelector,
  );
}

export function isTxMsg(subject: unknown): subject is TxMsg {
  return isObjectWithKeys(subject, ["instructions"]);
}

export function isSignableSolanaTx(subject: unknown): subject is SignableEncodedBase64Message {
  return isObjectWithKeys(subject, ["encodedSolanaTx"]);
}

export type SolanaGaslessTransfer = {
  solanaTxHash: string;
  gasDropOff: bigint;
  amount: Usdc;
  recipient: string;
};

export function isSolanaGaslessTransfer(subject: unknown): subject is SolanaGaslessTransfer {
  return isObjectWithKeys(subject, ["solanaTxHash"]);
}

export async function buildTransferStep(
  network: Network,
  corridor: Corridor,
  sourceChain: LoadedDomain,
  usesPermit: boolean,
): Promise<EvmTransferStep | SolanaTransferStep> {
  const evmCosts = await getPlatformExecutionCosts(network, "Evm");
  if (sourceChain === "Solana") {
    const { v1, v2 } = await getPlatformExecutionCosts(network, "Solana");
    return {
      platform: "Solana",
      chain: sourceChain,
      type: SOLANA_TRANSFER,
      costEstimation: corridor === "v1" ?
        { sourceChain: v1 } :
        corridor === "v2Direct" ?
        { sourceChain: v2 } :
        { sourceChain: v2, hopChain: evmCosts.v1 },
    } as SolanaTransferStep;
  }
  const { v1, v2 } = evmCosts;
  const permitCost = usesPermit ? evmCosts.permit : 0n;
  return {
    platform: "Evm",
    chain: sourceChain,
    type: EVM_TRANSFER,
    costEstimation: corridor === "v1" ?
      { sourceChain: { gasCostEstimation: v1 + permitCost } } :
      corridor === "v2Direct" ?
      { sourceChain: { gasCostEstimation: v2 + permitCost } } :
      { sourceChain: { gasCostEstimation: v2 + permitCost }, hopChain: { gasCostEstimation: v1 } },
  } as EvmTransferStep;
}

export function signPermitStep(sourceChain: keyof EvmDomains): EvmSignPermitStep {
  return {
    platform: "Evm",
    type: EVM_SIGN_PERMIT,
    chain: sourceChain,
    costEstimation: { sourceChain: { gasCostEstimation: 0n } },
  };
}
const EVM_APPROVAL_TX_GAS_COST_APROXIMATE = 55425n;
export function preApprovalStep(sourceChain: keyof EvmDomains): EvmPreApproveStep {
  return {
    platform: "Evm",
    chain: sourceChain,
    type: EVM_PRE_APPROVE,
    costEstimation: { sourceChain: { gasCostEstimation: EVM_APPROVAL_TX_GAS_COST_APROXIMATE } },
  };
}

export function gaslessTransferStep(
  sourceChain: LoadedDomain,
): EvmGaslessTransferStep | SolanaGaslessTransferStep {
  if (sourceChain === "Solana") {
    return {
      platform: "Solana",
      chain: sourceChain,
      type: SOLANA_GASLESS_TRANSFER,
      costEstimation: { sourceChain: { computationUnits: 0n, signatures: 0, accountBytes: 0n } },
    } as const;
  }
  return {
    platform: "Evm",
    chain: sourceChain,
    type: EVM_GASLESS_TRANSFER,
    costEstimation: { sourceChain: { gasCostEstimation: 0n } },
  } as const;
}
