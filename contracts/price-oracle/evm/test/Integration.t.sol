// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { PRICES_QUERIES_ID, QUERY_FEE_PARAMS_ID } from "price-oracle/assets/PriceOracleIds.sol";
import { BaseFeeLib, GasDropoffLib } from "price-oracle/assets/types/ParamLibs.sol";
import { SolanaFeeParams } from "price-oracle/assets/types/SolanaFeeParams.sol";
import { EvmFeeParams } from "price-oracle/assets/types/EvmFeeParams.sol";
import { InvalidAddress } from "price-oracle/PriceOracleIntegration.sol";
import { BytesParsing } from "wormhole-sdk/libraries/BytesParsing.sol";
import { IntegratorTester } from "./utils/IntegratorTester.sol";
import { PriceOracleTestBase } from "./utils/OTBase.sol";

contract IntegrationTest is PriceOracleTestBase {
  using BytesParsing for bytes;
  IntegratorTester integrator;

  function _setUp1() internal override {
    integrator = new IntegratorTester(address(priceOracle));
  }

  function testIntegratonConstructor() public {
    vm.expectRevert(
      abi.encodeWithSelector(InvalidAddress.selector)
    );
    new IntegratorTester(address(0));
  }

  function testGetOracleOwner() public view {
    assertEq(integrator.getOracleOwner(), owner);
  }

  function testGetOraclePendingOwner() public view {
    assertEq(integrator.getOraclePendingOwner(), address(0));
  }

  function testGetOracleAdmin(address fakeAdmin) public view {
    vm.assume(fakeAdmin != admin);
    assertEq(integrator.getOracleIsAdmin(admin), true);
    assertEq(integrator.getOracleIsAdmin(fakeAdmin), false);
  }

  function testGetOracleAssistant() public view {
    assertEq(integrator.getOracleAssistant(), assistant);
  }

  function testGetOracleImplementation() public view {
    assertEq(integrator.getOracleImplementation(), priceOracleImplementation);
  }

  function testGetOracleFeeParams() public view {
    assertEq(integrator.getFeeParams(EVM_CHAIN_ID), EvmFeeParams.unwrap(baseEvmFeeParams));
    assertEq(integrator.getFeeParams(SOLANA_CHAIN_ID), SolanaFeeParams.unwrap(baseSolanaFeeParams));
  }

  function testOracleBatchGet() public view {
    uint8 subcommandCount = 2;

    bytes memory integrationResult = integrator.batchGet(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        subcommandCount,
        QUERY_FEE_PARAMS_ID,
        uint16(SOLANA_CHAIN_ID),
        QUERY_FEE_PARAMS_ID,
        uint16(EVM_CHAIN_ID)
      )
    );

    (uint256 solanaFeeParams,) = integrationResult.asUint256MemUnchecked(0);
    (uint256 evmFeeParams,) = integrationResult.asUint256MemUnchecked(32);

    assertEq(solanaFeeParams, SolanaFeeParams.unwrap(baseSolanaFeeParams));
    assertEq(evmFeeParams, EvmFeeParams.unwrap(baseEvmFeeParams));
  }

  function testEvmTransactionQuote() public view {
    uint gasDropoff = 1 ether;
    uint32 gas = 1e7;
    uint baseFee = 10; //usd
    uint32 billedSize = 0;

    uint expectedTotalUsdQuote = baseFee * 1e18 +
      (gasDropoff + gas * EVM_GAS_PRICE + billedSize * EVM_PRICE_PER_BYTE) * EVM_GAS_TOKEN_PRICE;
    uint expectedQuote = expectedTotalUsdQuote / HOME_GAS_TOKEN_PRICE;

    uint quote = integrator.getEvmTransactionQuote(
      EVM_CHAIN_ID,
      GasDropoffLib.to(gasDropoff),
      gas,
      BaseFeeLib.to(baseFee * 1e18),
      billedSize
    );
    assertEq(quote, expectedQuote);
  }

  function testEvmTransactionWithTxSizeQuote() public view {
    uint gasDropoff = 1 ether;
    uint32 gas = 1e7;
    uint baseFee = 10; //usd
    uint32 billedSize = 1e3;

    uint expectedTotalUsdQuote = baseFee * 1e18 +
      (gasDropoff + gas * EVM_GAS_PRICE + billedSize * EVM_PRICE_PER_BYTE) * EVM_GAS_TOKEN_PRICE;
    uint expectedQuote = expectedTotalUsdQuote / HOME_GAS_TOKEN_PRICE;

    uint quote = integrator.getEvmTransactionQuote(
      EVM_CHAIN_ID,
      GasDropoffLib.to(gasDropoff),
      gas,
      BaseFeeLib.to(baseFee * 1e18),
      billedSize
    );
    assertEq(quote, expectedQuote);
  }

  function testSolanaTransactionQuote() public view {
    uint gasDropoff = 1; //sol
    uint computationUnits = 1e5;
    uint numberOfSpawnedAccounts = 5;
    uint totalSizeOfAccounts = 1e5 + numberOfSpawnedAccounts * 128;
    uint signatureCount = 1;
    uint baseFee = 10; //usd

    uint expectedTotalUsdQuote = baseFee * 1e18 +
      (gasDropoff * 1e18 +
       computationUnits * SOLANA_COMPUTATION_COST * 1e3 +
       totalSizeOfAccounts * SOLANA_PRICE_PER_ACCOUNT_BYTE * 1e9 +
       signatureCount * SOLANA_SIGNATURE_PRICE * 1e9
      ) * SOLANA_GAS_TOKEN_PRICE;
    uint expectedQuote = expectedTotalUsdQuote / HOME_GAS_TOKEN_PRICE;

    uint quote = integrator.getSolanaTransactionQuote(
      GasDropoffLib.to(gasDropoff * 1e18),
      uint32(computationUnits ),
      uint32(totalSizeOfAccounts),
      uint8(signatureCount),
      BaseFeeLib.to(baseFee * 1e18)
    );
    assertEq(quote, expectedQuote);
  }
}