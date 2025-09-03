// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { deserialize } from "binary-layout";
import { Hex } from "viem";
import { duration, EvmDomains, LoadedDomain, UniversalAddress, v1, v2 } from "@stable-io/cctp-sdk-definitions";
import type { Address, Network, TxHash } from "../../types/index.js";
import { encoding, pollUntil, type PollingConfig } from "@stable-io/utils";

export async function findTransferAttestation<N extends Network>(
  network: N,
  sourceChain: LoadedDomain,
  transactionHash: TxHash,
  config: PollingConfig = {},
): Promise<CctpAttestation> {
  const fetchMessages = v2.fetchMessagesFactory(network);
  const { messages: [message] } = await pollUntil(
    () => fetchMessages(sourceChain, { transactionHash }, duration(0, "sec")),
    (result): result is Extract<v2.GetMessagesResponse, { status: "success" }> => result.status === "success",
    config,
  );
  return message.cctpVersion === 1 ? parseV1Attestation(message) : parseV2Attestation(message);
}

export type CctpAttestation = CctpV1Attestation | CctpV2Attestation;

export type CctpV1Attestation = {
  cctpVersion: 1;
  nonce: bigint;
  sender: Address;
  recipient: Address;
  destinationCaller: Address;
  sourceDomain: LoadedDomain;
  targetDomain: LoadedDomain;
  messageBody: {
    burnToken: Address;
    mintRecipient: Address;
    amount: string;
    messageSender: Address;
  };
};

function parseV1Attestation(message: v2.ApiResponseMessage): CctpV1Attestation {
  const attestation = deserialize(v1.burnMessageLayout(), message.message);
  return {
    cctpVersion: 1,
    nonce: attestation.nonce,
    sender: toEvmAddress(attestation.sender),
    recipient: toEvmAddress(attestation.recipient),
    destinationCaller: toEvmAddress(attestation.destinationCaller),
    sourceDomain: attestation.sourceDomain as LoadedDomain,
    targetDomain: attestation.destinationDomain as LoadedDomain,
    messageBody: {
      burnToken: toEvmAddress(attestation.messageBody.burnToken),
      mintRecipient: toEvmAddress(attestation.messageBody.mintRecipient),
      /**
       * @todo: check that this units make sense.
       */
      amount: attestation.messageBody.amount.toString(),
      messageSender: toEvmAddress(attestation.messageBody.messageSender),
    },
  };
};

export type CctpV2Attestation = {
  cctpVersion: 2;
  nonce: Hex; // 32 bytes hex string
  sender: Address;
  recipient: Address;
  destinationCaller: Address;
  sourceDomain: LoadedDomain;
  targetDomain: LoadedDomain;
  messageBody: {
    burnToken: Address;
    mintRecipient: Address;
    amount: string;
    messageSender: Address;
    maxFee: string;
    feeExecuted?: string;
    expirationBlock: string;
    hookData: string;
  };
  minFinalityThreshold: number;
  finalityThresholdExecuted: number;
};

function parseV2Attestation(message: v2.ApiResponseMessage): CctpV2Attestation {
  const attestation = deserialize(v2.burnMessageLayout(), message.message);
  return {
    cctpVersion: 2,
    nonce: `0x${encoding.hex.encode(attestation.nonce)}`,
    sender: toEvmAddress(attestation.sender),
    recipient: toEvmAddress(attestation.recipient),
    destinationCaller: toEvmAddress(attestation.destinationCaller),
    sourceDomain: attestation.sourceDomain as LoadedDomain,
    targetDomain: attestation.destinationDomain as LoadedDomain,
    minFinalityThreshold: attestation.minFinalityThreshold,
    finalityThresholdExecuted: attestation.finalityThresholdExecuted,
    messageBody: {
      burnToken: toEvmAddress(attestation.messageBody.burnToken),
      mintRecipient: toEvmAddress(attestation.messageBody.mintRecipient),
      amount: attestation.messageBody.amount.toString(),
      messageSender: toEvmAddress(attestation.messageBody.messageSender),
      maxFee: attestation.messageBody.maxFee.toString(),
      feeExecuted: attestation.messageBody.feeExecuted.toString(),
      expirationBlock: attestation.messageBody.expirationBlock.toString(),
      hookData: encoding.hex.encode(attestation.messageBody.hookData),
    },
  };
};

function toEvmAddress(address: UniversalAddress): Address {
  return address.toPlatformAddress("Evm").toString();
}
