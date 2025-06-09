// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  Usdc,
  Usd,
  EvmDomains,
  GasTokenOf,
} from "@stable-io/cctp-sdk-definitions";
import { Permit, ContractTx, Eip2612Data, selectorOf } from "@stable-io/cctp-sdk-evm";
import { Corridor, execSelector } from "@stable-io/cctp-sdk-cctpr-evm";
import { Intent } from "./intent.js";
import { SupportedPlatform } from "./signer.js";
import { encoding } from "@stable-io/utils";
import { TransferProgressEventEmitter } from "../progressEmitter.js";
import { TransactionEventEmitter } from "../transactionEmitter.js";

export type StepType = "sign-permit" | "pre-approve" | "transfer";

export type Fee = Usdc | GasTokenOf<keyof EvmDomains>;

export interface Route {
  corridor: Corridor;

  estimatedDuration: number; // seconds

  estimatedTotalCost: Usd;

  fees: Fee[];

  // "rates" property will contain information about relevant
  // rates that may have been used in the whole process.
  // The first example we'll need is going to be the gas
  // drop-off exchange rate
  // In the future we may have other rates such as the swap
  // exchange rate once we've incoorporated a swap layer.
  //
  // Type details to be defined by implementer
  // rates: Rates[];

  intent: Intent;

  // When using permit, the transactions require a an Eip2612
  // signature to be built, so they can not be built eagerly.
  // This is the reason behind workflow needing to be an async
  // generator or state machine, which is not serializable.
  // There are some scenarios where integrator may want to
  // prevent using this routes to generate a serializable workflow.
  // (eg: txs generated in the backend and signed on the front-end)
  requiresMessageSignature: boolean;

  steps: RouteExecutionStep[];

  // TODO:
  // ideally this generator should return typed steps so that they are easy to handle.
  // Since we are re-using the result of cctpr-evm we are limited by the fact that it
  // returns directly what needs to be signed or signed-and-sent.
  // But for example now that we are adding gasless we'll need to also return a type
  // for a relay request that is sent to our api instead of signed or sent to a node.
  // See `executeRouteSteps` where we need to do duck-typing to understand what kind
  // of step we'll be executing.
  workflow: AsyncGenerator<ContractTx | Eip2612Data, ContractTx, Permit | undefined>;

  /**
   * Tracking:
   */
  transactionListener: TransactionEventEmitter;
  progress: TransferProgressEventEmitter;
}

interface BaseRouteExecutionStep {
  type: StepType;
  chain: keyof EvmDomains;
  platform: SupportedPlatform;
  // This is the estimated cost of executing this step on-chain.
  // value=0 for permits
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
 *
 * @param txOrSig at the moment cctp-sdk returns either a contract transaction to sign and send
 *                or a eip2612 message to sign and return to it.
 */
export function getStepType(txOrSig: ContractTx | Eip2612Data): StepType {
  if (isEip2612Data(txOrSig)) return "sign-permit";
  if (isContractTx(txOrSig) && isTransferTx(txOrSig)) return "transfer";
  if (isContractTx(txOrSig) && isApprovalTx(txOrSig)) return "pre-approve";
  throw new Error("Unknown Step Type");
};

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
