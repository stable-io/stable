import { EventEmitter } from "events";
import { Eip712Data } from "@stable-io/cctp-sdk-evm";
import { Hex, Intent, Network, TxHash } from "./types/index.js";
import { CctpAttestation } from "./methods/executeRoute/findTransferAttestation.js";
import { Receive } from "./types/receive.js";
import { Usdc } from "@stable-io/cctp-sdk-definitions";
import { LoadedCctprDomain, SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";

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

  "hop-received": HopReceivedEventData;

  "hop-confirmed": HopConfirmedEventData;

  "transfer-received": TransferReceivedEventData;

  "error": TransferFailedEventData;

  // Catch all:
  "step-completed": StepCompletedEventData<keyof TransferProgressEvent>;
}

/**
 * Transfer Life Cycle Events
 */

export type TransferInitiatedEventData<N extends Network = Network> = {
  intent: Intent<N, LoadedCctprDomain<N>, SupportedDomain<N>>;
  // other info could be added here such as
  // quote, corridor, gasless or not, etc.
};

/**
 * Approval:
 */

export type ApprovalSentEventData = {
  transactionHash: TxHash;
  approvalAmount: bigint;
};

export type MessageSignedEventData = {
  signer: Hex;
  messageSigned: Eip712Data;
  signature: Hex;
};

/**
 * Transfer:
 */

export type TransferSentEventData = {
  transactionHash: TxHash;
  approvalType: "Permit" | "Preapproval" | "Gasless";
  gasDropOff: bigint;
  usdcAmount: Usdc;
  recipient: Hex;
  quoted: "onChainUsdc" | "onChainGas" | "offChain";
};

export type TransferConfirmedEventData = CctpAttestation;

export type TransferReceivedEventData = Receive;

/**
 * Hop:
 */
export type HopReceivedEventData = Receive;

export type HopConfirmedEventData = CctpAttestation;

/**
 * Error:
 */
export type FailureScenarios = "transfer-failed" // tokens never left the account
  | "attestation-failed" // ball is on circle's court
  | "receive-failed"; // ball is on blockchain watcher or relayers court

export type TransferFailedEventData<S extends FailureScenarios=FailureScenarios> = {
  type: FailureScenarios;
  details: S extends "transfer-failed"
    ? undefined
    : S extends "attestation-failed"
    ? { txHash: TxHash } // timeout boolean
    : S extends "receive-failed"
    ? { txHash: TxHash }
    : never;
};

/**
 * Catch all:
 */
export interface StepCompletedEventData<K extends keyof TransferProgressEvent> {
  name: K;
  data: TransferProgressEvent[K];
}
