// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { Permit, ContractTx, Eip2612Data, selectorOf } from "@stable-io/cctp-sdk-evm";
import { Corridor, execSelector } from "@stable-io/cctp-sdk-cctpr-evm";
import { SupportedPlatform } from "../../types/signer.js";
import { encoding } from "@stable-io/utils";

export type StepType = "sign-permit" | "pre-approve" | "transfer";

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

export type RouteExecutionStep = SignPermitStep | PreApproveStep | TransferStep;

export const SIGN_PERMIT = "sign-permit" as const;
export interface SignPermitStep extends BaseRouteExecutionStep {
  type: typeof SIGN_PERMIT;
};

export const PRE_APPROVE = "pre-approve" as const;
export interface PreApproveStep extends BaseRouteExecutionStep {
  type: typeof PRE_APPROVE;
};

export interface TransferStep extends BaseRouteExecutionStep {
  type: "transfer";
};

/**
 * @param txOrSig at the moment cctp-sdk returns either a contract transaction to sign and send
 *                or an eip2612 message to sign and return to it.
 */
export function getStepType(txOrSig: ContractTx | Eip2612Data): StepType {
  if (isEip2612Data(txOrSig)) return "sign-permit";
  if (isContractTx(txOrSig) && isTransferTx(txOrSig)) return "transfer";
  if (isContractTx(txOrSig) && isApprovalTx(txOrSig)) return "pre-approve";
  throw new Error("Unknown Step Type");
}

export function isContractTx(subject: unknown): subject is ContractTx {
  if (typeof subject !== "object" || subject === null) return false;
  return "data" in subject && "to" in subject;
}

export function isEip2612Data(subject: unknown): subject is Eip2612Data {
  if (typeof subject !== "object" || subject === null) return false;
  return "domain" in subject && "types" in subject && "message" in subject;
}

export function isApprovalTx(subject: ContractTx): boolean {
  const approvalFuncSelector = selectorOf("approve(address,uint256)");
  return encoding.bytes.equals(
    subject.data.subarray(0, approvalFuncSelector.length),
    approvalFuncSelector,
  );
}

export function isTransferTx(subject: ContractTx): boolean {
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
): RouteExecutionStep {
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
