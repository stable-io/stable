// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Network, Domain } from "./chains/index.js";

export const contractAddressOf = {
  Mainnet: {
    Ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    Avalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    Optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    Arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    Noble: "uusdc",
    Solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    Base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    Polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    Sui: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    Aptos: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
    Unichain: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
    Linea: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    Sonic: "", //TODO
  },
  Testnet: {
    Ethereum: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    Avalanche: "0x5425890298aed601595a70AB815c96711a31Bc65",
    Optimism: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    Arbitrum: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    Noble: "uusdc",
    Solana: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    Base: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    Polygon: "0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97",
    Sui: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
    Aptos: "0x69091fbab5f7d635ee7ac5098cf0c1efbe31d68fec0f2cd565e8d168daf52832",
    Unichain: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
    Linea: "0xFEce4462D57bD51A6A552365A011b95f0E16d9B7",
    Sonic: "", //TODO
  },
} as const satisfies Record<Network, Record<Domain, string>>;

export const init = <N extends Network>(network: N) => ({
  contractAddressOf: contractAddressOf[network],
} as const);
