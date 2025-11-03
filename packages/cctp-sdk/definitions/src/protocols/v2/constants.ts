// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { MapLevels, RoArray } from "@stable-io/map-utils";
import { constMap, deepReadonly, zip } from "@stable-io/map-utils";
import type { ContractName, Domain, Network } from "../../constants/index.js";

//TODO all the same for now - should we dedup?
export const contractEntries = [[
  "Mainnet", [[
    "Ethereum", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]], [
    "Avalanche", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]], [
    "Arbitrum", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]], [
    "Optimism", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]], [
    "Polygon", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]], [
    "Unichain", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]], [
    "Base", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]], [
    "Solana", [
      ["messageTransmitter", "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC"],
      ["tokenMessenger",     "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe"],
    ]], [
    "Linea", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]], [
    "Codex", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]], [
    "Sonic", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]], [
    "Worldchain", [
      ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
      ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    ]],
    // ["Sei", [
    //   ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
    //   ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    // ]],
    // ["BNB", [
    //   ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
    //   ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    // ]],
    // ["XDC", [
    //   ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
    //   ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    // ]],
    // ["HyperEVM", [
    //   ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
    //   ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    // ]],
    // ["Ink", [
    //   ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
    //   ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    // ]],
    // ["Plume", [
    //   ["messageTransmitter", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"],
    //   ["tokenMessenger",     "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"],
    // ]],
  ]], [
  "Testnet", [[
    "Ethereum", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]], [
    "Avalanche", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]], [
    "Arbitrum", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]], [
    "Optimism", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]], [
    "Polygon", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]], [
    "Unichain", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]], [
    "Base", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]], [
    "Solana", [
      ["messageTransmitter", "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC"],
      ["tokenMessenger",     "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe"],
    ]], [
    "Linea", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]], [
    "Codex", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]], [
    "Sonic", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]], [
    "Worldchain", [
      ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
      ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    ]],
    // ["Sei", [
    //   ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
    //   ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    // ]],
    // ["BNB", [
    //   ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
    //   ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    // ]],
    // ["XDC", [
    //   ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
    //   ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    // ]],
    // ["HyperEVM", [
    //   ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
    //   ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    // ]],
    // ["Ink", [
    //   ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
    //   ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    // ]],
    // ["Plume", [
    //   ["messageTransmitter", "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275"],
    //   ["tokenMessenger",     "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA"],
    // ]],
  ]],
] as const satisfies MapLevels<[Network, Domain, ContractName, string]>;

export const contractAddressOf = constMap(contractEntries);

export const supportedDomains = constMap(contractEntries, [0, 1]);
export type SupportedDomain<N extends Network> = ReturnType<typeof supportedDomains<N>>[number];

export const isSupportedDomain = <N extends Network>(network: N) =>
  (domain: Domain): domain is SupportedDomain<N> =>
    (supportedDomains(network) as RoArray<Domain>).includes(domain);

export const fastDomains = ["Avalanche"] as const satisfies RoArray<Domain>;
export type FastDomain = typeof fastDomains[number];
export const isFastDomain = (domain: Domain): domain is FastDomain =>
  (fastDomains as RoArray<string>).includes(domain);

// See https://developers.circle.com/stablecoins/required-block-confirmations
// TODO: review numbers and add slow transfer numbers
export const attestationTimeEstimates = {
  Mainnet: {
    Ethereum:   13.25,
    Avalanche:  100, // v2 is not used in avalanche.
    Arbitrum:   4.71,
    Base:       4.99,
    Linea:      1.85,     // TODO
    Optimism:   3.29,
    Unichain:   3.75,
    Polygon:    31.59,
    Worldchain: 2.22,
    Sonic:      3.32,
    Codex:      10,    // TODO
    Sei:        10,    // TODO
    // TODO Add a proper value for Solana
    Solana:     8,
  },
  Testnet: {
    Ethereum:   16.76,
    Avalanche:  8.19,
    Arbitrum:   3.18,
    Base:       1.43,
    Linea:      8,     // TODO
    Optimism:   0.85,
    Unichain:   8,    // TODO
    Polygon:    9.04,
    Worldchain: 8, // TODO
    Sonic:      8, // TODO
    Codex:      8, // TODO
    Sei:        8, // TODO
    Solana:     8,
  },
} as const satisfies Record<Network, Record<string, number>>;

export const finalityThresholdEntries = [
  [ 500, "TokenMessengerMin"],
  [1000, "Confirmed"        ],
  [2000, "Finalized"        ],
] as const;

const [finalityThresholdVals, finalityThresholdNames] =
  deepReadonly(zip(finalityThresholdEntries));
export type FinalityTresholdName = typeof finalityThresholdNames[number];

export const finalityThresholdValOf = constMap(finalityThresholdEntries, [1, 0]);

//return the name of the finality threshold which is >= the given threshold
// i.e. 500 -> "TokenMessengerMin", 501 -> "Confirmed", 1001+ -> "Finalized"
export const finalityThresholdNameOf = (finalityThreshold: number): FinalityTresholdName => {
  for (let i = finalityThresholdEntries.length - 2; i >= 0; --i)
    if (finalityThreshold > finalityThresholdEntries[i]![0])
      return finalityThresholdNames[i+1]!;

  return finalityThresholdNames[0];
};

export const init = <N extends Network>(network: N) => ({
  contractAddressOf: contractAddressOf.subMap(network),
  supportedDomains,
  isSupportedDomain: isSupportedDomain(network),
  fastDomains,
  isFastDomain,
  attestationTimeEstimates: attestationTimeEstimates[network],
  finalityThresholdEntries,
  finalityThresholdVals,
  finalityThresholdNames,
  finalityThresholdNameOf,
});
