import type { Domain, Network } from "@stable-io/cctp-sdk-definitions";
import {
  type Byte,
  byte,
  domains,
  v1,
  v2,
  usdcContracts,
  domainIdOf,
} from "@stable-io/cctp-sdk-definitions";
import { SolanaAddress } from "./address.js";
import { findPda, Seeds } from "./utils.js";

const pda = (seeds: Seeds, address: SolanaAddress) =>
  findPda(seeds, address)[0];

const localToken = (tokenMessenger: SolanaAddress) =>
  (mint: SolanaAddress) =>
    pda(["local_token", mint], tokenMessenger);

const localUsdc = (network: Network, tokenMessenger: SolanaAddress) =>
  localToken(tokenMessenger)(
    new SolanaAddress(usdcContracts.contractAddressOf[network]["Solana"])
  );

const remoteTokenMessengers = (tokenMessenger: SolanaAddress) =>
  Object.fromEntries(domains.map(domain =>
    [ domain,
      pda(["remote_token_messenger", domainIdOf(domain).toString()], tokenMessenger),
    ] as const,
  )) as Record<Domain, SolanaAddress>;

const getAddress = (
  network: Network,
  version: "v1" | "v2",
  contract: "tokenMessenger" | "messageTransmitter",
) => new SolanaAddress(
  ((version === "v1" ? v1 : v2) as any).contractAddressOf(network, "Solana", contract)
);

const accounts = <V extends "v1" | "v2">(network: Network, version: V) => {
  const messageTransmitter = getAddress(network, version, "messageTransmitter");
  const tokenMessenger     = getAddress(network, version, "tokenMessenger");
  const denylist = {
    denylist: (user: SolanaAddress) => pda(["denylist_account", user], tokenMessenger)
  } as const;
  return {
    messageTransmitter:       messageTransmitter,
    tokenMessenger:           tokenMessenger,
    messageTransmitterConfig: pda(["message_transmitter"], messageTransmitter),
    tokenMessengerConfig:     pda(["token_messenger"], tokenMessenger),
    tokenMinter:              pda(["token_minter"], tokenMessenger),
    senderAuthority:          pda(["sender_authority"], tokenMessenger),
    remoteTokenMessengers:    remoteTokenMessengers(tokenMessenger),
    eventAuthority:           pda(["__event_authority"], tokenMessenger),
    localToken:               localUsdc(network, tokenMessenger),
    ...(version === "v2" ? denylist : {}) as V extends "v2" ? typeof denylist : {},
  } as const;
}

const networkAccounts = (network: Network) => ({
  v1: accounts(network, "v1"),
  v2: accounts(network, "v2"),
} as const);

export const cctpAccounts = {
  Mainnet: networkAccounts("Mainnet"),
  Testnet: networkAccounts("Testnet"),
} as const;

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
export const v1SentEventDataSize = byte(292);

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
export const v2SentEventDataSize = (hookDataSize: Byte) => byte(428).add(hookDataSize);
