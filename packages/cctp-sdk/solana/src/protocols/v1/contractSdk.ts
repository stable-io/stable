// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { TransactionMessage, TransactionMessageWithFeePayer } from "@solana/kit";
import { AccountRole } from "@solana/kit";
import { serialize } from "binary-layout";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import {
  UniversalAddress,
  Usdc,
  usdcContracts,
  v1,
} from "@stable-io/cctp-sdk-definitions";
import {
  type SolanaClient,
  SolanaAddress,
  findAta,
  composeIx,
  systemProgramId,
  tokenProgramId,
  cctpAccounts,
  getAccountInfo,
  feePayerTxFromIxs,
  composeCreateAtaIx,
} from "../../index.js";
import { type ForeignDomain } from "./constants.js";
import {
  type DepositForBurnParams,
  depositForBurnParamsLayout,
  receiveMessageParamsLayout,
} from "./layouts.js";

export function composeDepositForBurn<N extends Network, DD extends ForeignDomain<N>>(
  network: N,
  destination: DD,
  amount: Usdc,
  mintRecipient: UniversalAddress,
  sender: SolanaAddress,
  messageSentEventData: SolanaAddress,
  senderUsdc?: SolanaAddress,
): TransactionMessage & TransactionMessageWithFeePayer {
  const {
    usdcMint,
    messageTransmitter,
    messageTransmitterConfig,
    tokenMessenger,
    tokenMessengerConfig,
    tokenMinter,
    senderAuthority,
    remoteTokenMessengers,
    localToken,
    eventAuthority,
  } = cctpAccounts[network]["v1"];
  const remoteTokenMessenger = remoteTokenMessengers[destination];

  senderUsdc = senderUsdc ?? findAta(sender, usdcMint);

  const accounts = [
    [sender,                   AccountRole.READONLY_SIGNER],
    [sender,                   AccountRole.WRITABLE_SIGNER],
    [senderAuthority,          AccountRole.READONLY       ],
    [senderUsdc,               AccountRole.WRITABLE       ],
    [messageTransmitterConfig, AccountRole.WRITABLE       ],
    [tokenMessengerConfig,     AccountRole.READONLY       ],
    [remoteTokenMessenger,     AccountRole.READONLY       ],
    [tokenMinter,              AccountRole.READONLY       ],
    [localToken,               AccountRole.WRITABLE       ],
    [usdcMint,                 AccountRole.WRITABLE       ],
    [messageSentEventData,     AccountRole.WRITABLE       ],
    [messageTransmitter,       AccountRole.READONLY       ],
    [tokenMessenger,           AccountRole.READONLY       ],
    [tokenProgramId,           AccountRole.READONLY       ],
    [systemProgramId,          AccountRole.READONLY       ],
    [eventAuthority,           AccountRole.READONLY       ],
    [tokenMessenger,           AccountRole.READONLY       ],
  ] as const;

  const params = {
    amount,
    destination: destination as unknown as DepositForBurnParams<N>["destination"],
    mintRecipient,
  } as const;

  return feePayerTxFromIxs(
    composeIx(accounts, depositForBurnParamsLayout(network), params, tokenMessenger),
    sender,
  );
}

export async function composeRedeem<N extends Network>(
  network: N,
  client: SolanaClient,
  payer: SolanaAddress,
  message: v1.BurnMessage,
  attestation: Uint8Array,
  recipientUsdc?: SolanaAddress,
): Promise<TransactionMessage & TransactionMessageWithFeePayer> {
  const {
    usdcMint,
    messageTransmitter,
    messageTransmitterConfig,
    tokenMessenger,
    tokenMessengerConfig,
    tokenMinter,
    remoteTokenMessengers,
    localToken,
    messageTransmitterAuthority,
    eventAuthority,
    usedNonces,
    tokenPair,
    custody,
  } = cctpAccounts[network]["v1"];
  const remoteTokenMessenger = remoteTokenMessengers[message.sourceDomain];
  const mintRecipient = message.messageBody.mintRecipient.toPlatformAddress("Solana");
  const recipientAta = findAta(mintRecipient, usdcMint);

  recipientUsdc = recipientUsdc ?? recipientAta;

  if (message.destinationDomain !== "Solana")
    throw new Error(`Expected destination domain Solana, got ${message.destinationDomain}`);

  if (!message.messageBody.burnToken.equals(usdcMint.toUniversalAddress()))
    throw new Error("Invalid burn token, only USDC is supported");

  const accounts = [
    [payer,                                           AccountRole.WRITABLE_SIGNER],
    [payer,                                           AccountRole.READONLY_SIGNER],
    [messageTransmitterAuthority,                     AccountRole.READONLY       ],
    [messageTransmitterConfig,                        AccountRole.READONLY       ],
    [usedNonces(message.sourceDomain, message.nonce), AccountRole.WRITABLE       ],
    [tokenMessenger,                                  AccountRole.READONLY       ],
    [systemProgramId,                                 AccountRole.READONLY       ],
    [tokenMessengerConfig,                            AccountRole.READONLY       ],
    [remoteTokenMessenger,                            AccountRole.READONLY       ],
    [tokenMinter,                                     AccountRole.READONLY       ],
    [localToken,                                      AccountRole.WRITABLE       ],
    [tokenPair(message.sourceDomain),                 AccountRole.READONLY       ],
    [recipientUsdc,                                   AccountRole.WRITABLE       ],
    [custody,                                         AccountRole.WRITABLE       ],
    [tokenProgramId,                                  AccountRole.READONLY       ],
    [eventAuthority,                                  AccountRole.READONLY       ],
    [tokenMessenger,                                  AccountRole.READONLY       ],
  ] as const;

  const receiveMessageIx = composeIx(
    accounts,
    receiveMessageParamsLayout,
    { message, attestation },
    messageTransmitter,
  );

  const maybeCreateAtaIx = [];
  if (!(await getAccountInfo(client, recipientUsdc))) {
    if (!recipientUsdc.equals(recipientAta))
      throw new Error("Only ATA creation is currently supported");

    maybeCreateAtaIx.push(composeCreateAtaIx(payer, mintRecipient, usdcMint));
  }

  return feePayerTxFromIxs([...maybeCreateAtaIx, receiveMessageIx], payer);
}
