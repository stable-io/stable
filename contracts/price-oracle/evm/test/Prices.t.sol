// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { NotAuthorized } from "wormhole-sdk/components/dispatcher/AccessControl.sol";
import { BytesParsing } from "wormhole-sdk/libraries/BytesParsing.sol";
import { PriceOracleTestBase } from "./utils/OTBase.sol";
import {
  InvalidPriceQuery,
  ChainNotSupportedByCommand
} from "price-oracle/assets/PriceOraclePrices.sol";
import {
  PricePerTxByte,
  GasDropoffLib,
  BaseFeeLib,
  GasPrice,
  PricePerAccountByte,
  SolanaComputationPrice,
  GasTokenPrice
} from "price-oracle/assets/types/ParamLibs.sol";
import {
  SolanaFeeParams,
  SolanaFeeParamsLib
} from "price-oracle/assets/types/SolanaFeeParams.sol";
import {
  EvmFeeParams,
  EvmFeeParamsLib
} from "price-oracle/assets/types/EvmFeeParams.sol";
import "price-oracle/assets/PriceOracleIds.sol";

contract PricesTest is PriceOracleTestBase {
  using BytesParsing for bytes;

  function testSetWithoutRole() public {
    uint8 commandCount = 1;

    vm.expectRevert(NotAuthorized.selector);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount
      )
    );
  }

  function testSetEvmFeeParams(
    uint32 gasPrice,
    uint32 pricePerTxByte,
    uint48 gasTokenPrice
  ) public {
    gasPrice = uint32(bound(gasPrice, 1e6 + 1, type(uint32).max));
    pricePerTxByte = uint32(bound(pricePerTxByte, 1e6 + 1, type(uint32).max));
    gasTokenPrice = uint48(bound(gasTokenPrice, 1e12 + 1, type(uint48).max));

    EvmFeeParams evmFeeParams;
    evmFeeParams = evmFeeParams.pricePerTxByte(PricePerTxByte.wrap(pricePerTxByte));
    evmFeeParams = evmFeeParams.gasPrice(GasPrice.wrap(gasPrice));
    evmFeeParams = evmFeeParams.gasTokenPrice(GasTokenPrice.wrap(gasTokenPrice));
    uint8 commandCount = 1;

    vm.prank(assistant);
    vm.expectRevert(
      abi.encodeWithSelector(
        ChainNotSupportedByCommand.selector,
        SOLANA_CHAIN_ID,
        EVM_FEE_PARAMS_ID
      )
    );
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        EVM_FEE_PARAMS_ID,
        SOLANA_CHAIN_ID
      )
    );

    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        EVM_FEE_PARAMS_ID,
        EVM_CHAIN_ID,
        EvmFeeParams.unwrap(evmFeeParams)
      )
    );

    (uint256 evmParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        EVM_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);
    assertEq(EvmFeeParams.unwrap(evmFeeParams), evmParams);
  }


  function testSetEvmFeeParams_Zero() public {
    uint32 gasPrice = 0;
    uint32 pricePerTxByte = 0;
    uint48 gasTokenPrice = 0;

    EvmFeeParams evmFeeParams;
    evmFeeParams = evmFeeParams.pricePerTxByte(PricePerTxByte.wrap(pricePerTxByte));
    evmFeeParams = evmFeeParams.gasPrice(GasPrice.wrap(gasPrice));
    evmFeeParams = evmFeeParams.gasTokenPrice(GasTokenPrice.wrap(gasTokenPrice));
    uint8 commandCount = 1;

    vm.prank(assistant);
    vm.expectRevert(
      abi.encodeWithSelector(
        ChainNotSupportedByCommand.selector,
        SOLANA_CHAIN_ID,
        EVM_FEE_PARAMS_ID
      )
    );
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        EVM_FEE_PARAMS_ID,
        SOLANA_CHAIN_ID
      )
    );

    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        EVM_FEE_PARAMS_ID,
        EVM_CHAIN_ID,
        EvmFeeParams.unwrap(evmFeeParams)
      )
    );

    (uint256 evmParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        EVM_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);
    assertEq(EvmFeeParams.unwrap(evmFeeParams), evmParams);
  }

  function testSetGasPrice(
    uint32 gasPrice
  ) public {
    gasPrice = uint32(bound(gasPrice, 1e6 + 1, type(uint32).max));
    uint8 commandCount = 1;

    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        EVM_GAS_PRICE_ID,
        EVM_CHAIN_ID,
        uint32(gasPrice)
      )
    );

    (uint256 evmParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        EVM_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    EvmFeeParams evmFeeParams = EvmFeeParamsLib.checkedWrap(evmParams);
    assertEq(gasPrice, GasPrice.unwrap(evmFeeParams.gasPrice()));
  }

  function testSetGasPrice_Zero() public {
    uint32 gasPrice = 0;
    uint8 commandCount = 1;

    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        EVM_GAS_PRICE_ID,
        EVM_CHAIN_ID,
        uint32(gasPrice)
      )
    );

    (uint256 evmParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        EVM_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    EvmFeeParams evmFeeParams = EvmFeeParamsLib.checkedWrap(evmParams);
    assertEq(gasPrice, GasPrice.unwrap(evmFeeParams.gasPrice()));
  }

  function testSetPricePerTxByte(
    uint32 pricePerTxByte
  ) public {
    pricePerTxByte = uint32(bound(pricePerTxByte, 1e6 + 1, type(uint32).max));
    uint8 commandCount = 1;

    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        EVM_PRICE_PER_TX_BYTE_ID,
        EVM_CHAIN_ID,
        pricePerTxByte
      )
    );

    (uint256 evmParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        EVM_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    EvmFeeParams evmFeeParams = EvmFeeParamsLib.checkedWrap(evmParams);
    assertEq(pricePerTxByte, PricePerTxByte.unwrap(evmFeeParams.pricePerTxByte()));
  }

  function testSetPricePerTxByte_Zero() public {
    uint32 pricePerTxByte = 0;
    uint8 commandCount = 1;

    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        EVM_PRICE_PER_TX_BYTE_ID,
        EVM_CHAIN_ID,
        pricePerTxByte
      )
    );

    (uint256 evmParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        EVM_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    EvmFeeParams evmFeeParams = EvmFeeParamsLib.checkedWrap(evmParams);
    assertEq(pricePerTxByte, PricePerTxByte.unwrap(evmFeeParams.pricePerTxByte()));
  }

  function testSetGasTokenPrice(
    uint48 gasTokenPrice
  ) public {
    gasTokenPrice = uint48(bound(gasTokenPrice, 1e12 + 1, type(uint48).max));
    uint8 commandCount = 1;

    // Evm gas token price
    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        GAS_TOKEN_PRICE_ID,
        EVM_CHAIN_ID,
        gasTokenPrice
      )
    );

    (uint256 evmParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        EVM_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    EvmFeeParams evmFeeParams = EvmFeeParamsLib.checkedWrap(evmParams);
    assertEq(gasTokenPrice, GasTokenPrice.unwrap(evmFeeParams.gasTokenPrice()));

    // Solana gas token price
    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        GAS_TOKEN_PRICE_ID,
        SOLANA_CHAIN_ID,
        gasTokenPrice
      )
    );

    (uint256 solanaParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        SOLANA_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    SolanaFeeParams solanaFeeParams = SolanaFeeParamsLib.checkedWrap(solanaParams);
    assertEq(gasTokenPrice, GasTokenPrice.unwrap(solanaFeeParams.gasTokenPrice()));
  }

  function testSetGasTokenPrice_Zero() public {
    uint48 gasTokenPrice = 0;
    uint8 commandCount = 1;

    // Evm gas token price
    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        GAS_TOKEN_PRICE_ID,
        EVM_CHAIN_ID,
        gasTokenPrice
      )
    );

    (uint256 evmParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        EVM_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    EvmFeeParams evmFeeParams = EvmFeeParamsLib.checkedWrap(evmParams);
    assertEq(gasTokenPrice, GasTokenPrice.unwrap(evmFeeParams.gasTokenPrice()));

    // Solana gas token price
    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        GAS_TOKEN_PRICE_ID,
        SOLANA_CHAIN_ID,
        gasTokenPrice
      )
    );

    (uint256 solanaParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        SOLANA_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    SolanaFeeParams solanaFeeParams = SolanaFeeParamsLib.checkedWrap(solanaParams);
    assertEq(gasTokenPrice, GasTokenPrice.unwrap(solanaFeeParams.gasTokenPrice()));
  }

  function testSetSolanaComputationPrice(
    uint32 computationPrice
  ) public {
    computationPrice = uint32(bound(computationPrice, 1e9 + 1, type(uint32).max));
    uint8 commandCount = 1;

    vm.expectRevert(NotAuthorized.selector);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        SOLANA_COMPUTATION_PRICE_ID,
        SOLANA_CHAIN_ID,
        uint32(computationPrice)
      )
    );

    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        SOLANA_COMPUTATION_PRICE_ID,
        SOLANA_CHAIN_ID,
        uint32(computationPrice)
      )
    );

    (uint256 solanaParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        SOLANA_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    SolanaFeeParams solanaFeeParams = SolanaFeeParamsLib.checkedWrap(solanaParams);

    assertEq(computationPrice, SolanaComputationPrice.unwrap(solanaFeeParams.computationPrice()));
  }

  function testSetSolanaComputationPrice_Zero() public {
    uint32 computationPrice = 0;
    uint8 commandCount = 1;

    vm.expectRevert(NotAuthorized.selector);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        SOLANA_COMPUTATION_PRICE_ID,
        SOLANA_CHAIN_ID,
        uint32(computationPrice)
      )
    );

    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        SOLANA_COMPUTATION_PRICE_ID,
        SOLANA_CHAIN_ID,
        uint32(computationPrice)
      )
    );

    (uint256 solanaParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        SOLANA_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    SolanaFeeParams solanaFeeParams = SolanaFeeParamsLib.checkedWrap(solanaParams);

    assertEq(computationPrice, SolanaComputationPrice.unwrap(solanaFeeParams.computationPrice()));
  }

  function testSetPricePerAccountByte(
    uint32 pricePerAccountByte
  ) public {
    pricePerAccountByte = uint32(bound(pricePerAccountByte, 1e9 + 1, type(uint32).max));
    uint8 commandCount = 1;

    vm.expectRevert(NotAuthorized.selector);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        SOLANA_PRICE_PER_ACCOUNT_BYTE_ID,
        SOLANA_CHAIN_ID,
        uint32(pricePerAccountByte)
      )
    );

    vm.expectRevert(NotAuthorized.selector);
    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        SOLANA_PRICE_PER_ACCOUNT_BYTE_ID,
        SOLANA_CHAIN_ID,
        uint32(pricePerAccountByte)
      )
    );

    vm.prank(admin);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        SOLANA_PRICE_PER_ACCOUNT_BYTE_ID,
        SOLANA_CHAIN_ID,
        uint32(pricePerAccountByte)
      )
    );

    (uint256 solanaParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        SOLANA_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    SolanaFeeParams solanaFeeParams = SolanaFeeParamsLib.checkedWrap(solanaParams);

    assertEq(pricePerAccountByte, PricePerAccountByte.unwrap(solanaFeeParams.pricePerAccountByte()));
  }

  function testSetPricePerAccountByte_Zero() public {
    uint32 pricePerAccountByte = 0;
    uint8 commandCount = 1;

    vm.expectRevert(NotAuthorized.selector);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        SOLANA_PRICE_PER_ACCOUNT_BYTE_ID,
        SOLANA_CHAIN_ID,
        uint32(pricePerAccountByte)
      )
    );

    vm.expectRevert(NotAuthorized.selector);
    vm.prank(assistant);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        SOLANA_PRICE_PER_ACCOUNT_BYTE_ID,
        SOLANA_CHAIN_ID,
        uint32(pricePerAccountByte)
      )
    );

    vm.prank(admin);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        SOLANA_PRICE_PER_ACCOUNT_BYTE_ID,
        SOLANA_CHAIN_ID,
        uint32(pricePerAccountByte)
      )
    );

    (uint256 solanaParams,) = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        SOLANA_CHAIN_ID
      )
    ).asUint256MemUnchecked(0);

    SolanaFeeParams solanaFeeParams = SolanaFeeParamsLib.checkedWrap(solanaParams);

    assertEq(pricePerAccountByte, PricePerAccountByte.unwrap(solanaFeeParams.pricePerAccountByte()));
  }

  function testEvmTransactionQuote() public view {
    uint gasDropoff = 1 ether;
    uint gas = 1e7;
    uint baseFee = 10; //usd
    uint billedSize = 0;
    uint8 commandCount = 1;

    uint expectedTotalUsdQuote = baseFee * 1e18 +
      (gasDropoff + gas * EVM_GAS_PRICE + billedSize * EVM_PRICE_PER_BYTE) * EVM_GAS_TOKEN_PRICE;
    uint expectedQuote = expectedTotalUsdQuote / HOME_GAS_TOKEN_PRICE;

    bytes memory response = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        EVM_TX_QUOTE_ID,
        EVM_CHAIN_ID,
        GasDropoffLib.to(gasDropoff),
        uint32(gas),
        BaseFeeLib.to(baseFee * 1e18),
        uint32(billedSize)
      )
    );
    assertEq(response.length, 32);
    (uint quote,) = response.asUint256MemUnchecked(0);

    assertEq(expectedQuote, quote);
  }

  function testEvmTransactionWithTxSizeQuote() public view {
    uint gasDropoff = 1 ether;
    uint gas = 1e7;
    uint baseFee = 10; //usd
    uint billedSize = 1e3;
    uint8 commandCount = 1;

    uint expectedTotalUsdQuote = baseFee * 1e18 +
      (gasDropoff + gas * EVM_GAS_PRICE + billedSize * EVM_PRICE_PER_BYTE) * EVM_GAS_TOKEN_PRICE;
    uint expectedQuote = expectedTotalUsdQuote / HOME_GAS_TOKEN_PRICE;

    bytes memory response = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        EVM_TX_QUOTE_ID,
        EVM_CHAIN_ID,
        GasDropoffLib.to(gasDropoff),
        uint32(gas),
        BaseFeeLib.to(baseFee * 1e18),
        uint32(billedSize)
      )
    );
    assertEq(response.length, 32);
    (uint quote,) = response.asUint256MemUnchecked(0);

    assertEq(expectedQuote, quote);
  }

  function testSolanaTransactionQuote() public view {
    uint gasDropoff = 1; //sol
    uint numberOfSpawnedAccounts = 5;
    uint computationUnits = 5e4;
    uint totalSizeOfAccounts = 1e5 + numberOfSpawnedAccounts * 128;
    uint signatureCount = 2;
    uint baseFee = 10; //usd

    uint expectedTotalUsdQuote = baseFee * 1e18 +
      (gasDropoff * 1e18 +
       computationUnits * SOLANA_COMPUTATION_COST * 1e3 +
       totalSizeOfAccounts * SOLANA_PRICE_PER_ACCOUNT_BYTE * 1e9 +
       signatureCount * SOLANA_SIGNATURE_PRICE * 1e9
      ) * SOLANA_GAS_TOKEN_PRICE;
    uint expectedQuote = expectedTotalUsdQuote / HOME_GAS_TOKEN_PRICE;
    uint8 queryCount = 1;

    bytes memory response = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        queryCount,
        SOLANA_TX_QUOTE_ID,
        GasDropoffLib.to(gasDropoff * 1e18),
        uint32(computationUnits),
        uint32(totalSizeOfAccounts),
        uint8(signatureCount),
        BaseFeeLib.to(baseFee * 1e18)
      )
    );
    assertEq(response.length, 32);
    (uint quote,) = response.asUint256MemUnchecked(0);

    assertEq(expectedQuote, quote);
  }

  function testGetFeeParams() public view {
    uint8 commandCount = 1;

    bytes memory response = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        SOLANA_CHAIN_ID
      )
    );
    assertEq(response.length, 32);
    (uint256 solanaParams,) = response.asUint256MemUnchecked(0);
    assertEq(SolanaFeeParams.unwrap(baseSolanaFeeParams), solanaParams);

    response = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID,
        EVM_CHAIN_ID
      )
    );
    assertEq(response.length, 32);
    (uint256 evmParams,) = response.asUint256MemUnchecked(0);
    assertEq(EvmFeeParams.unwrap(baseEvmFeeParams), evmParams);
  }

  function testGetChainId() public view {
    uint8 commandCount = 1;

    bytes memory response = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        CHAIN_ID_ID
      )
    );
    assertEq(response.length, 2);
    (uint16 chainId,) = response.asUint16MemUnchecked(0);
    assertEq(HOME_CHAIN_ID, chainId);
  }

  function testBatchPrice() public {
    uint32 gasPrice = 1e9;
    uint32 computationPrice = 1e5;
    uint32 pricePerAccountByte = 1e5;
    uint8 commandCount = 3;

    vm.startPrank(admin);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        EVM_GAS_PRICE_ID, EVM_CHAIN_ID, gasPrice,
        SOLANA_COMPUTATION_PRICE_ID, SOLANA_CHAIN_ID, computationPrice,
        SOLANA_PRICE_PER_ACCOUNT_BYTE_ID, SOLANA_CHAIN_ID, pricePerAccountByte
      )
    );

    bytes memory getRes = invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        QUERY_FEE_PARAMS_ID, EVM_CHAIN_ID,
        QUERY_FEE_PARAMS_ID, SOLANA_CHAIN_ID,
        CHAIN_ID_ID
      )
    );

    assertEq(getRes.length, 32 * 2 + 2);
    (uint256 evmParams,)    = getRes.asUint256MemUnchecked(0);
    (uint256 solanaParams,) = getRes.asUint256MemUnchecked(32);
    (uint16 chainId,)       = getRes.asUint16MemUnchecked(64);

    EvmFeeParams evmFeeParams = EvmFeeParamsLib.checkedWrap(evmParams);
    SolanaFeeParams solanaFeeParams = SolanaFeeParamsLib.checkedWrap(solanaParams);

    assertEq(gasPrice, GasPrice.unwrap(evmFeeParams.gasPrice()));
    assertEq(computationPrice, SolanaComputationPrice.unwrap(solanaFeeParams.computationPrice()));
    assertEq(pricePerAccountByte, PricePerAccountByte.unwrap(solanaFeeParams.pricePerAccountByte()));
    assertEq(HOME_CHAIN_ID, chainId);
  }

  function testInvalidPriceQuery() public {
    uint8 commandCount = 1;
    uint8 invalidQuery = 0xFF;

    vm.expectRevert(
      abi.encodeWithSelector(
        InvalidPriceQuery.selector,
        invalidQuery
      )
    );
    invokeStaticOracle(
      abi.encodePacked(
        PRICES_QUERIES_ID,
        commandCount,
        invalidQuery
      )
    );
  }
}
