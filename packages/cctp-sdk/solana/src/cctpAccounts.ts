// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ProperLayout, CustomizableBytes } from "binary-layout";
import { boolItem, calcStaticSize } from "binary-layout";
import { encoding } from "@stable-io/utils";
import type { Domain, Network } from "@stable-io/cctp-sdk-definitions";
import {
  Byte,
  byte,
  Percentage,
  domains,
  v1,
  v2,
  usdcContracts,
  domainIdOf,
  amountItem,
  linearTransform,
  universalAddressItem,
  domainItem,
  fixedDomainItem,
} from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "./address.js";
import { findPda, Seeds } from "./utils.js";
import {
  solanaAddressItem,
  bumpItem,
  vecBytesItem,
  vecArrayItem,
  accountLayout,
  littleEndian,
} from "./layoutItems.js";

const pda = (seeds: Seeds, address: SolanaAddress) => findPda(seeds, address)[0];

const getAddress = (
  network: Network,
  version: "v1" | "v2",
  contract: "tokenMessenger" | "messageTransmitter",
) => new SolanaAddress(
  ((version === "v1" ? v1 : v2) as any).contractAddressOf(network, "Solana", contract),
);

const accounts = <V extends "v1" | "v2">(network: Network, version: V) => {
  const usdcMint = new SolanaAddress(usdcContracts.contractAddressOf[network]["Solana"]);
  const messageTransmitter = getAddress(network, version, "messageTransmitter");
  const tokenMessenger     = getAddress(network, version, "tokenMessenger");

  const remoteTokenMessengers = Object.fromEntries(domains.map(domain =>
    [ domain,
      pda(["remote_token_messenger", domainIdOf(domain).toString()], tokenMessenger),
    ] as const,
  )) as Record<Domain, SolanaAddress>;

  const tokenPair = (sourceDomain: Domain) =>
    //see https://github.com/circlefin/solana-cctp-contracts/blob/9f8cf26d059cf8927ae0a0b351f3a7a88c7bdade/programs/token-messenger-minter/src/token_messenger/instructions/handle_receive_message.rs#L82-L86
    pda(
      ["token_pair", domainIdOf(sourceDomain).toString(), usdcMint.toUint8Array()],
      tokenMessenger,
    );

  const v1Specific = {
    usedNonces: (sourceDomain: Domain, nonce: bigint) => {
      const sourceDomainId = domainIdOf(sourceDomain);

      //see https://github.com/circlefin/solana-cctp-contracts/blob/9f8cf26d059cf8927ae0a0b351f3a7a88c7bdade/programs/message-transmitter/src/state.rs#L249-L258
      const usedNoncesSeedDelimiter = sourceDomainId < 11 ? "" : "-";

      //see https://github.com/circlefin/solana-cctp-contracts/blob/9f8cf26d059cf8927ae0a0b351f3a7a88c7bdade/programs/message-transmitter/src/state.rs#L193
      const nonceBitmapSize = 6400n;

      //see https://github.com/circlefin/solana-cctp-contracts/blob/9f8cf26d059cf8927ae0a0b351f3a7a88c7bdade/programs/message-transmitter/src/state.rs#L195-L212
      //nonce -> firstNonce: 1 -> 1, 6400 -> 1, 6401 -> 6401
      const firstNonce = nonce - ((nonce - 1n) % nonceBitmapSize);

      //see https://github.com/circlefin/solana-cctp-contracts/blob/9f8cf26d059cf8927ae0a0b351f3a7a88c7bdade/programs/message-transmitter/src/instructions/receive_message.rs#L62-L67
      return pda(
        ["used_nonces", sourceDomainId.toString(), usedNoncesSeedDelimiter, firstNonce.toString()], messageTransmitter,
      );
    },
  } as const;

  const v2Specific = {
    denylist:  (user: SolanaAddress) => pda(["denylist_account", user], tokenMessenger),
    usedNonce: (nonce: Uint8Array)   => pda(["used_nonce", nonce],      tokenMessenger),
  } as const;

  const specific = (version === "v1" ? v1Specific : v2Specific) as
    V extends "v1" ? typeof v1Specific : typeof v2Specific;

  return {
    usdcMint,
    messageTransmitter,
    tokenMessenger,
    remoteTokenMessengers,
    tokenPair,
    messageTransmitterConfig:    pda(["message_transmitter"],              messageTransmitter),
    tokenMessengerConfig:        pda(["token_messenger"],                  tokenMessenger),
    tokenMinter:                 pda(["token_minter"],                     tokenMessenger),
    senderAuthority:             pda(["sender_authority"],                 tokenMessenger),
    messageTransmitterAuthority: pda(["message_transmitter_authority"],    tokenMessenger),
    eventAuthority:              pda(["__event_authority"],                tokenMessenger),
    localToken:                  pda(["local_token", usdcMint],            tokenMessenger),
    custody:                     pda(["custody", usdcMint.toUint8Array()], tokenMessenger),
    ...specific,
  } as const;
};

const networkAccounts = (network: Network) => ({
  v1: accounts(network, "v1"),
  v2: accounts(network, "v2"),
} as const);

export const cctpAccounts = {
  Mainnet: networkAccounts("Mainnet"),
  Testnet: networkAccounts("Testnet"),
} as const;

// ---- Sent Event Data Layouts ----

//    8 discriminator
//+  32 rent payer
//+   4 vec.len
//+ 116 Message Header
//+ 132 Burn Message Length
//  ---
//  292 bytes (doesn't include additional 128 bytes of account overhead)
//
//see:
// * account struct: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/message-transmitter/src/events.rs#L49-L70
// * message header: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/message-transmitter/src/message.rs#L43
// * burn message: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/token-messenger-minter/src/token_messenger/burn_message.rs#L39
export const v1SentEventDataLayout = accountLayout("MessageSent", [
  { name: "rentPayer", ...solanaAddressItem },
  { name: "message", ...vecBytesItem(v1.burnMessageLayout()) },
]);

export const v1SentEventDataSize = byte(calcStaticSize(v1SentEventDataLayout)!);

//    8 discriminator
//+  32 rent payer
//+   8 timestamp
//+   4 vec.len
//+ 148 Message Header
//+ 228 Burn Message Length
//  ---
//  428 bytes (doesn't include additional 128 bytes of account overhead)
//
//see:
// * account struct: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/v2/message-transmitter-v2/src/events.rs#L49-L71
// * message header: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/v2/message-transmitter-v2/src/message.rs#L45
// * burn message: https://github.com/circlefin/solana-cctp-contracts/blob/b37d577fc1dc317ce9bc0316c5063afe38744ce3/programs/v2/token-messenger-minter-v2/src/token_messenger_v2/burn_message.rs#L41

const unixTimestampItem = {
  binary: "int",
  size: 8,
  endianness: "little",
  custom: {
    to: (value: bigint) => new Date(encoding.bignum.toNumber(value) * 1000),
    from: (date: Date) => BigInt(Math.floor(date.getTime() / 1000)),
  },
} as const;

export const v2SentEventDataLayout =
  <const H extends CustomizableBytes = undefined>(hookData?: H) =>
    accountLayout("MessageSent", [
      { name: "rentPayer", ...solanaAddressItem },
      { name: "createdAt", ...unixTimestampItem },
      { name: "message", ...vecBytesItem(v2.burnMessageLayout(hookData)) },
    ]);

export const v2SentEventDataSize = (hookDataSize: Byte) =>
  byte(calcStaticSize(v2SentEventDataLayout([]))!).add(hookDataSize);

// ---- Config Layouts ----

const configLayout = <const L extends ProperLayout>(name: string, layout: L) =>
  accountLayout(name, littleEndian(layout));

const ownershipLayout = [
  { name: "owner",        ...solanaAddressItem },
  { name: "pendingOwner", ...solanaAddressItem },
] as const;

const versionItem = { binary: "uint", size: 4 } as const;

const sharedConfigLayout = [
  ...ownershipLayout,
  { name: "attesterManager",    ...solanaAddressItem               },
  { name: "pauser",             ...solanaAddressItem               },
  { name: "paused",             ...boolItem()                      },
  { name: "localDomain",        ...fixedDomainItem("Solana")       },
  { name: "version",            ...versionItem                     },
  { name: "signatureThreshold", binary: "uint", size: 4            },
  { name: "enabledAttesters",   ...vecArrayItem(solanaAddressItem) },
  { name: "maxMessageBodySize", ...amountItem(8, Byte)             },
] as const;

export const v1MessageTransmitterConfigLayout =
  configLayout("MessageTransmitter", [
    ...sharedConfigLayout,
    { name: "nextAvailableNonce", ...v1.nonceItem },
  ]);

export const v2MessageTransmitterConfigLayout =
  configLayout("MessageTransmitter", sharedConfigLayout);

const messageBodyVersionAndAuthorityBumpLayout = [
  { name: "messageBodyVersion", ...versionItem },
  { name: "authorityBump",      ...bumpItem    },
] as const;

export const v1TokenMessengerConfigLayout =
  configLayout("TokenMessenger", [
    ...ownershipLayout,
    { name: "localMessageTransmitter", ...solanaAddressItem },
    ...messageBodyVersionAndAuthorityBumpLayout,
  ]);

const minFeeItem = amountItem(4, Percentage, "scalar", linearTransform("from->to", 1e7));

export const v2TokenMessengerConfigLayout =
  configLayout("TokenMessenger", [
    { name: "denylister",       ...solanaAddressItem },
    ...ownershipLayout,
    ...messageBodyVersionAndAuthorityBumpLayout,
    { name: "feeRecipient",     ...solanaAddressItem },
    { name: "minFeeController", ...solanaAddressItem },
    { name: "minFee",           ...minFeeItem        },
  ]);

export const remoteTokenMessengerLayout = configLayout("RemoteTokenMessenger", [
  { name: "domain",         ...domainItem()         },
  { name: "tokenMessenger", ...universalAddressItem },
]);
