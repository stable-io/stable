// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { EvmDomains, LoadedDomain, platformOf } from "@stable-io/cctp-sdk-definitions";
import type { Corridor } from "@stable-io/cctp-sdk-cctpr-definitions";
import { Permit, ContractTx, Eip2612Data, Eip712Data, selectorOf, Eip2612Message, Permit2TransferFromMessage } from "@stable-io/cctp-sdk-evm";
import { type Permit2GaslessData, execSelector } from "@stable-io/cctp-sdk-cctpr-evm";
import { SupportedPlatform } from "../../types/signer.js";
import { encoding } from "@stable-io/utils";
import { Network } from "../../types/general.js";
import { getPlatformExecutionCosts } from "../../api/executionCost.js";
import { TxMsg } from "@stable-io/cctp-sdk-solana";
export type StepType = "sign-permit" | "sign-permit-2" | "pre-approve" | "evm-transfer" | "gasless-transfer" | "solana-transfer";

interface BaseRouteExecutionStep {
  type: StepType;
  chain: LoadedDomain;
  platform: SupportedPlatform;
  // This is the estimated cost of executing this step on-chain.
  // value=0 might be cero if the step is not executed onchain directly
  // eg: gasless relaying and permit signature.
  // Expressed in gas token units
  gasCostEstimation: bigint;
};

export type RouteExecutionStep = SignPermitStep
  | PreApproveStep
  | EvmTransferStep
  | GaslessTransferStep
  | SolanaTransferStep;

export const SIGN_PERMIT = "sign-permit" as const;
export interface SignPermitStep extends BaseRouteExecutionStep {
  type: typeof SIGN_PERMIT;
};

export const SIGN_PERMIT_2 = "sign-permit-2" as const;
export interface SignPermit2Step extends BaseRouteExecutionStep {
  type: typeof SIGN_PERMIT_2;
}

export const PRE_APPROVE = "pre-approve" as const;
export interface PreApproveStep extends BaseRouteExecutionStep {
  type: typeof PRE_APPROVE;
};

export const EVM_TRANSFER = "evm-transfer" as const;
export interface EvmTransferStep extends BaseRouteExecutionStep {
  type: typeof EVM_TRANSFER;
};

export const GASLESS_TRANSFER = "gasless-transfer" as const;
export interface GaslessTransferStep extends BaseRouteExecutionStep {
  type: typeof GASLESS_TRANSFER;
};

export const SOLANA_TRANSFER = "solana-transfer" as const;
export interface SolanaTransferStep extends BaseRouteExecutionStep {
  type: typeof SOLANA_TRANSFER;
};

/**
 * @param txOrSig at the moment cctp-sdk returns either a contract transaction to sign and send
 *                or an eip2612 message to sign and return to it.
 */
export function getStepType(txOrSig: ContractTx | Eip712Data | GaslessTransferData | TxMsg): StepType {
  if (isGaslessTransferData(txOrSig)) return GASLESS_TRANSFER;
  if (isPermit2GaslessData(txOrSig)) return SIGN_PERMIT_2;
  if (isEip2612Data(txOrSig)) return SIGN_PERMIT;
  if (isTransferTx(txOrSig)) return EVM_TRANSFER;
  if (isApprovalTx(txOrSig)) return PRE_APPROVE;
  if (isTxMsg(txOrSig)) return SOLANA_TRANSFER;
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
  if (!("permit2GaslessData" in subject) || !isPermit2GaslessData(subject.permit2GaslessData)) return false;
  if (!("txHash" in subject) || typeof subject.txHash !== "string") return false;
  if (!("permit2Signature" in subject) || typeof subject.permit2Signature !== "string") return false;
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

export async function buildTransferStep(
  network: Network,
  corridor: Corridor,
  sourceChain: LoadedDomain,
  usesPermit: boolean,
): Promise<EvmTransferStep | SolanaTransferStep> {
  const platform = platformOf(sourceChain);
  const { v1, v2, permit } = await getPlatformExecutionCosts(network, platform);
  const sharedTxData = {
    platform,
    chain: sourceChain,
    type: platform === "Evm" ? EVM_TRANSFER : SOLANA_TRANSFER,
  };
  switch (corridor) {
    /**
     * @todo: add sensible values to the gas cost estimation of the corridors.
     */
    case "v1":
      return {
        ...sharedTxData,
        gasCostEstimation: v1 + (usesPermit ? permit : 0n),
      };

    case "v2Direct":
      return {
        ...sharedTxData,
        gasCostEstimation: v2 + (usesPermit ? permit : 0n),
      };

    case "avaxHop":
      return {
        ...sharedTxData,
        gasCostEstimation: v1 + v2 + (usesPermit ? permit : 0n),
      };

    default:
      throw new Error(`Corridor: ${corridor} not supported.`);
  }
}

export function signPermitStep(sourceChain: keyof EvmDomains): SignPermitStep {
  return {
    platform: "Evm",
    type: "sign-permit",
    chain: sourceChain,
    gasCostEstimation: 0n,
  };
}
const EVM_APPROVAL_TX_GAS_COST_APROXIMATE = 55425n;
export function preApprovalStep(sourceChain: keyof EvmDomains): PreApproveStep {
  return {
    platform: "Evm",
    chain: sourceChain,
    type: "pre-approve",
    gasCostEstimation: EVM_APPROVAL_TX_GAS_COST_APROXIMATE,
  };
}

export function gaslessTransferStep(sourceChain: LoadedDomain): GaslessTransferStep {
  return {
    platform: sourceChain === "Solana" ? "Solana" : "Evm",
    chain: sourceChain,
    type: "gasless-transfer",
    gasCostEstimation: 0n,
  };
}
