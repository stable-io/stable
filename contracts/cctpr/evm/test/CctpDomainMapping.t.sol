// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

import "cctp-xr/assets/CctpRBase.sol";

import {
  CHAIN_ID_ETHEREUM,
  CHAIN_ID_AVALANCHE,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_SOLANA,
  CHAIN_ID_BASE,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SUI,
  CHAIN_ID_APTOS,
  CHAIN_ID_UNICHAIN,
  CHAIN_ID_SEPOLIA,
  CHAIN_ID_OPTIMISM_SEPOLIA,
  CHAIN_ID_ARBITRUM_SEPOLIA,
  CHAIN_ID_BASE_SEPOLIA,
  CHAIN_ID_POLYGON_SEPOLIA
} from "wormhole-sdk/constants/Chains.sol";

contract CctpDomainMappingTest is Test {
  function testCctpDomainMapping() public pure {
    assertEq(domainToChainId(0,  MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_ETHEREUM         );
    assertEq(domainToChainId(0,  TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_SEPOLIA          );
    assertEq(domainToChainId(1,  MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_AVALANCHE        );
    assertEq(domainToChainId(1,  TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_AVALANCHE        );
    assertEq(domainToChainId(2,  MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_OPTIMISM         );
    assertEq(domainToChainId(2,  TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_OPTIMISM_SEPOLIA );
    assertEq(domainToChainId(3,  MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_ARBITRUM         );
    assertEq(domainToChainId(3,  TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_ARBITRUM_SEPOLIA );
    assertEq(domainToChainId(4,  MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_NOBLE            );
    assertEq(domainToChainId(4,  TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_NOBLE            );
    assertEq(domainToChainId(5,  MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_SOLANA           );
    assertEq(domainToChainId(5,  TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_SOLANA           );
    assertEq(domainToChainId(6,  MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_BASE             );
    assertEq(domainToChainId(6,  TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_BASE_SEPOLIA     );
    assertEq(domainToChainId(7,  MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_POLYGON          );
    assertEq(domainToChainId(7,  TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_POLYGON_SEPOLIA  );
    assertEq(domainToChainId(8,  MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_SUI              );
    assertEq(domainToChainId(8,  TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_SUI              );
    assertEq(domainToChainId(9,  MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_APTOS            );
    assertEq(domainToChainId(9,  TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_APTOS            );
    assertEq(domainToChainId(10, MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_UNICHAIN         );
    assertEq(domainToChainId(10, TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_UNICHAIN         );
    assertEq(domainToChainId(11, MAINNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_LINEA            );
    assertEq(domainToChainId(11, TESTNET_CCTP_DOMAIN_TO_CHAIN_ID), CHAIN_ID_LINEA            );
  }
}
