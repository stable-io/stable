import { EventEmitter } from "events";
import { Eip712Data } from "@stable-io/cctp-sdk-evm";
import { Hex, Intent, Network } from "./types/index.js";
import { CctpAttestation } from "./methods/executeRoute/findTransferAttestation.js";
import { Redeem } from "./types/redeem.js";
import { Usdc } from "@stable-io/cctp-sdk-definitions";
import { SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";

export class TransferProgressEmitter extends (
  EventEmitter as { new(): TransferProgressEventEmitter }
) {
  emit<
    K extends keyof TransferProgressEvent,
  >(event: K, payload: TransferProgressEvent[K]): boolean {
    const result = super.emit(event, payload);
    super.emit("step-completed", { name: event, data: payload });
    return result;
  }
}

export interface TransferProgressEventEmitter extends EventEmitter {
  on<
    K extends keyof TransferProgressEvent,
  >(event: K, listener: (payload: TransferProgressEvent[K]) => void): this;

  emit<
    K extends keyof TransferProgressEvent,
  >(event: K, payload: TransferProgressEvent[K]): boolean;
}

// events related to the steps of the transfer, not necessarily
// transactions.
export interface TransferProgressEvent {
  "transfer-initiated": TransferInitiatedEventData;
  // Approval:
  "approval-sent": ApprovalSentEventData;

  // Message (permit or permit2):
  "message-signed": MessageSignedEventData;

  // Transfer:
  "transfer-sent": TransferSentEventData;

  "transfer-confirmed": TransferConfirmedEventData;

  "hop-redeemed": HopRedeemedEventData;

  "hop-confirmed": HopConfirmedEventData;

  "transfer-redeemed": TransferRedeemedEventData;

  "error": TransferFailedEventData;

  // Catch all:
  "step-completed": StepCompletedEventData<keyof TransferProgressEvent>;
}

/**
 * Transfer Life Cycle Events
 */

export type TransferInitiatedEventData = {
  intent: Intent<SupportedEvmDomain<Network>, SupportedEvmDomain<Network>>;
  // other info could be added here such as
  // quote, corridor, gasless or not, etc.
};

/**
 * Approval:
 */

export type ApprovalSentEventData = {
  transactionHash: Hex;
  approvalAmount: bigint;
};

export type MessageSignedEventData = {
  signer: Hex;
  messageSigned: Eip712Data<any>;
  signature: Hex;
};

/**
 * Transfer:
 */

export type TransferSentEventData = {
  transactionHash: Hex;
  approvalType: "Permit" | "Preapproval" | "Gasless";
  gasDropOff: bigint;
  usdcAmount: Usdc;
  recipient: Hex;
  quoted: "onChainUsdc" | "onChainGas" | "offChain";
};

export type TransferConfirmedEventData = CctpAttestation;

export type TransferRedeemedEventData = Redeem;

/**
 * Hop:
 */
export type HopRedeemedEventData = Redeem;

export type HopConfirmedEventData = CctpAttestation;

/**
 * Error:
 */
export type FailureScenarios = "transfer-failed" // tokens never left the account
  | "attestation-failed" // ball is on circle's court
  | "receive-failed"; // ball is on blockchain watcher or relayers court

export type TransferFailedEventData<S extends FailureScenarios=FailureScenarios> = {
  type: FailureScenarios;
  details: S extends "transfer-failed" ? undefined
            : S extends "attestation-failed" ? { txHash: Hex } // timeout boolean
            : S extends "receive-failed" ? { txHash: Hex }
            : never;
};

/**
 * Catch all:
 */
export interface StepCompletedEventData<K extends keyof TransferProgressEvent> {
  name: K;
  data: TransferProgressEvent[K];
}
