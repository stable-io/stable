// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { Permit, ContractTx, Eip2612Data, Eip712Data, selectorOf, Permit2TypedData, Eip2612MessageBody, Permit2TransferFromMessage } from "@stable-io/cctp-sdk-evm";
import { Corridor, execSelector } from "@stable-io/cctp-sdk-cctpr-evm";
import { SupportedPlatform } from "../../types/signer.js";
import { encoding } from "@stable-io/utils";

export type StepType = "sign-permit" | "sign-permit-2" | "pre-approve" | "transfer" | "gasless-transfer";

interface BaseRouteExecutionStep {
  type: StepType;
  chain: keyof EvmDomains;
  platform: SupportedPlatform;
  // This is the estimated cost of executing this step on-chain.
  // value=0 might be cero if the step is not executed onchain directly
  // eg: gasless relaying and permit signature.
  // Expressed in gas token units
  gasCostEstimation: bigint;
};

export type RouteExecutionStep = SignPermitStep
  | PreApproveStep
  | TransferStep
  | GaslessTransferStep;

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

export const TRANSFER = "transfer" as const;
export interface TransferStep extends BaseRouteExecutionStep {
  type: typeof TRANSFER;
};

export const GASLESS_TRANSFER = "gasless-transfer" as const;
export interface GaslessTransferStep extends BaseRouteExecutionStep {
  type: typeof GASLESS_TRANSFER;
};

/**
 * @param txOrSig at the moment cctp-sdk returns either a contract transaction to sign and send
 *                or an eip2612 message to sign and return to it.
 */
export function getStepType(txOrSig: ContractTx | Eip2612Data): StepType {
  if (isGaslessTransfer(txOrSig)) return GASLESS_TRANSFER;
  if (isPermit2TypedData(txOrSig)) return SIGN_PERMIT_2;
  if (isEip2612Data(txOrSig)) return SIGN_PERMIT;
  if (isTransferTx(txOrSig)) return TRANSFER;
  if (isApprovalTx(txOrSig)) return PRE_APPROVE;
  throw new Error("Unknown Step Type");
}

export function isContractTx(subject: unknown): subject is ContractTx {
  if (typeof subject !== "object" || subject === null) return false;
  return "data" in subject && "to" in subject;
}

export function isEip712TypedData(subject: unknown): subject is Eip712Data<any> {
  if (typeof subject !== "object" || subject === null) return false;
  return "domain" in subject && "types" in subject && "message" in subject;
}

export function isEip2612MessageBody(subject: unknown): subject is Eip2612MessageBody {
  return typeof subject === "object" &&
    subject !== null &&
    "owner" in subject &&
    "spender" in subject &&
    "value" in subject &&
    "nonce" in subject &&
    "deadline" in subject;
}

export function isEip2612Data(subject: unknown): subject is Eip2612Data {
  if (!isEip712TypedData(subject)) return false;
  return isEip2612MessageBody(subject.message);
}

export function isPermit2TransferFromMessageBody(subject: unknown):
  subject is Permit2TransferFromMessage {
  return typeof subject === "object" &&
    subject !== null &&
    "nonce" in subject &&
    "deadline" in subject &&
    "permitted" in subject &&
    typeof subject.permitted === "object" &&
    subject.permitted !== null &&
    "token" in subject.permitted &&
    "amount" in subject.permitted;
}

export function isPermit2TypedData(subject: unknown): subject is Permit2TypedData {
  if (!isEip712TypedData(subject)) return false;
  return isPermit2TransferFromMessageBody(subject.message);
}

export type GaslessTransferData = {
  something: string;
};
export function isGaslessTransfer(subject: unknown): subject is GaslessTransferData {
  // TODO.
  return false;
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

export function buildTransferStep(
  corridor: Corridor,
  sourceChain: keyof EvmDomains,
): TransferStep {
  const sharedTxData = {
    platform: "Evm" as const,
    chain: sourceChain,
    type: "transfer" as const,
  };
  switch (corridor) {
    /**
     * @todo: add sensible values to the gas cost estimation of the corridors.
     */
    case "v1":
      return {
        ...sharedTxData,
        gasCostEstimation: 120_000n,
      };

    case "v2Direct":
      return {
        ...sharedTxData,
        gasCostEstimation: 200_000n,
      };

    case "avaxHop":
      return {
        ...sharedTxData,
        gasCostEstimation: 300_000n,
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
const EVM_APPROVAL_TX_GAS_COST_APROXIMATE = 40000n;
export function preApprovalStep(sourceChain: keyof EvmDomains): PreApproveStep {
  return {
    platform: "Evm",
    chain: sourceChain,
    type: "pre-approve",
    gasCostEstimation: EVM_APPROVAL_TX_GAS_COST_APROXIMATE,
  };
}

export function gaslessTransferStep(sourceChain: keyof EvmDomains): GaslessTransferStep {
  return {
    platform: "Evm",
    chain: sourceChain,
    type: "gasless-transfer",
    gasCostEstimation: 0n,
  };
}
