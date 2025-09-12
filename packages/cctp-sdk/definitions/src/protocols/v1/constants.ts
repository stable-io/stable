// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ContractName, Domain, Network } from "../../constants/index.js";
import { constMap, MapLevels, RoArray } from "@stable-io/map-utils";

export const contractEntries = [[
  "Mainnet", [[
    "Ethereum", [
      ["messageTransmitter", "0x0a992d191deec32afe36203ad87d7d289a738f81"],
      ["tokenMessenger",     "0xbd3fa81b58ba92a82136038b25adec7066af3155"],
    ]], [
    "Avalanche", [
      ["messageTransmitter", "0x8186359af5f57fbb40c6b14a588d2a59c0c29880"],
      ["tokenMessenger",     "0x6b25532e1060ce10cc3b0a99e5683b91bfde6982"],
    ]], [
    "Optimism", [
      ["messageTransmitter", "0x4d41f22c5a0e5c74090899e5a8fb597a8842b3e8"],
      ["tokenMessenger",     "0x2B4069517957735bE00ceE0fadAE88a26365528f"],
    ]], [
    "Arbitrum", [
      ["messageTransmitter", "0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca"],
      ["tokenMessenger",     "0x19330d10D9Cc8751218eaf51E8885D058642E08A"],
    ]], [
    "Base", [
      ["messageTransmitter", "0xAD09780d193884d503182aD4588450C416D6F9D4"],
      ["tokenMessenger",     "0x1682Ae6375C4E4A97e4B583BC394c861A46D8962"],
    ]], [
    "Solana", [
      ["messageTransmitter", "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd"],
      ["tokenMessenger",     "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3"],
    ]], [
    "Polygon", [
      ["messageTransmitter", "0xF3be9355363857F3e001be68856A2f96b4C39Ba9"],
      ["tokenMessenger",     "0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE"],
    ]], [
    "Sui", [
      ["messageTransmitter", "0x08d87d37ba49e785dde270a83f8e979605b03dc552b5548f26fdf2f49bf7ed1b"],
      ["tokenMessenger",     "0x2aa6c5d56376c371f88a6cc42e852824994993cb9bab8d3e6450cbe3cb32b94e"],
    ]], [
    "Aptos", [
      ["messageTransmitter", "0x177e17751820e4b4371873ca8c30279be63bdea63b88ed0f2239c2eea10f1772"],
      ["tokenMessenger",     "0x9e6702a472080ea3caaf6ba9dfaa6effad2290a9ba9adaacd5af5c618e42782d"],
    ]], [
    "Unichain", [
      ["messageTransmitter", "0x353bE9E2E38AB1D19104534e4edC21c643Df86f4"],
      ["tokenMessenger",     "0x4e744b28E787c3aD0e810eD65A24461D4ac5a762"],
    ]],
  ]], [
  "Testnet", [[
    "Ethereum", [
      ["messageTransmitter", "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD"],
      ["tokenMessenger",     "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"],
    ]], [
    "Avalanche", [
      ["messageTransmitter", "0xa9fb1b3009dcb79e2fe346c16a604b8fa8ae0a79"],
      ["tokenMessenger",     "0xeb08f243e5d3fcff26a9e38ae5520a669f4019d0"],
    ]], [
    "Optimism", [
      ["messageTransmitter", "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD"],
      ["tokenMessenger",     "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"],
    ]], [
    "Arbitrum", [
      ["messageTransmitter", "0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872"],
      ["tokenMessenger",     "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"],
    ]], [
    "Base", [
      ["messageTransmitter", "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD"],
      ["tokenMessenger",     "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"],
    ]], [
    "Solana", [
      ["messageTransmitter", "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd"],
      ["tokenMessenger",     "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3"],
    ]], [
    "Polygon", [
      ["messageTransmitter", "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD"],
      ["tokenMessenger",     "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5"],
    ]], [
    "Sui", [
      ["messageTransmitter", "0x4931e06dce648b3931f890035bd196920770e913e43e45990b383f6486fdd0a5"],
      ["tokenMessenger",     "0x31cc14d80c175ae39777c0238f20594c6d4869cfab199f40b69f3319956b8beb"],
    ]], [
    "Aptos", [
      ["messageTransmitter", "0x081e86cebf457a0c6004f35bd648a2794698f52e0dde09a48619dcd3d4cc23d9"],
      ["tokenMessenger",     "0x5f9b937419dda90aa06c1836b7847f65bbbe3f1217567758dc2488be31a477b9"],
    ]], [
    "Unichain", [
      ["messageTransmitter", "0xbc498c326533d675cf571B90A2Ced265ACb7d086"],
      ["tokenMessenger",     "0x8ed94B8dAd2Dc5453862ea5e316A8e71AAed9782"],
    ]],
  ]],
] as const satisfies MapLevels<[Network, Domain, ContractName, string]>;
export const contractAddressOf = constMap(contractEntries);

export const supportedDomains = constMap(contractEntries, [0, 1]);
export type SupportedDomain<N extends Network> = ReturnType<typeof supportedDomains<N>>[number];

export const isSupportedDomain = <N extends Network>(network: N) =>
  (domain: Domain): domain is SupportedDomain<N> =>
    (supportedDomains(network) as RoArray<Domain>).includes(domain);

// See https://developers.circle.com/stablecoins/required-block-confirmations
export const attestationTimeEstimates = {
  Mainnet:{
    Ethereum:    992.75,
    Avalanche:   5.13,
    Optimism:    1243.29,
    Arbitrum:    1017.26,
    Base:        1086.82,
    Polygon:     69.08,
    Unichain:    1604.94,
    // Codex:       20,
    // TODO Add a proper value for Solana
    Solana:      25,
    // Sui:         20, // TODO
    // Aptos:       20, // TODO
  },
  Testnet:{
    Ethereum:    27.71,
    Avalanche:   8.19,
    Optimism:    4.99,
    Arbitrum:    4.09,
    Base:        4.27,
    Polygon:     12.07, // TODO
    Unichain:    20, // TODO
    // Noble:       20, // TODO
    Solana:      25,
    Sui:         20, // TODO
    Aptos:       20, // TODO
  },
} as const satisfies Record<Network, Record<string, number>>;

export const init = <N extends Network>(network: N) => ({
  contractAddressOf: contractAddressOf.subMap(network),
  isSupportedDomain: isSupportedDomain(network),
  attestationTimeEstimates: attestationTimeEstimates[network],
} as const);
