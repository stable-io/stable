// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { BytesParsing } from "wormhole-sdk/libraries/BytesParsing.sol";
import "wormhole-sdk/components/dispatcher/Ids.sol";
import { EvmFeeParams, EvmFeeParamsLib } from "price-oracle/assets/types/EvmFeeParams.sol";
import { GasPrice } from "price-oracle/assets/types/ParamLibs.sol";
import "price-oracle/assets/PriceOracleIds.sol";
import { 
  UnsupportedVersion,  
  InvalidCommand 
} from "price-oracle/assets/PriceOracleDispatcher.sol";

import { PriceOracleTestBase } from "./utils/OTBase.sol";

contract DispatcherTest is PriceOracleTestBase {
  using BytesParsing for bytes;

  function testExec_wrongVersion() public {
    uint8 wrongVersion = 1;

    vm.expectRevert(
      abi.encodeWithSelector(UnsupportedVersion.selector, wrongVersion)
    );
    (bool success, ) = address(priceOracle).call(abi.encodePacked(priceOracle.exec768.selector, wrongVersion));
    vm.assertTrue(success);
  }

  function testExec() public {
    // This is the first query command, so it should fail because the exec
    // function will not be able to handle it.
    uint8 fakeCommand = 0x80;
    uint expectedFailureOffset = 1;
    vm.expectRevert(
      abi.encodeWithSelector(InvalidCommand.selector, fakeCommand, expectedFailureOffset)
    );
    invokeOracle(
      abi.encodePacked(fakeCommand)
    );
  }

  function testGetFoo_wrongVersion() public {
    uint8 wrongVersion = 1;

    vm.expectRevert(
      abi.encodeWithSelector(UnsupportedVersion.selector, wrongVersion)
    );
    (bool success, ) = address(priceOracle).staticcall(abi.encodePacked(priceOracle.get1959.selector, wrongVersion));
    vm.assertTrue(success);
  }

  function testGetFoo_invalidQuery() public {
    // This is the last exec command, so it should fail because the get
    // function will not be able to handle it.
    uint8 fakeQuery = 0x79;
    uint expectedFailureOffset = 1;
    vm.expectRevert(
      abi.encodeWithSelector(InvalidCommand.selector, fakeQuery, expectedFailureOffset)
    );
    invokeStaticOracle(
      abi.encodePacked(fakeQuery)
    );
  }

  function testBatchCommands(address newAdmin, uint32 gasPrice) public {
    gasPrice = uint32(bound(gasPrice, 1e9 + 1, type(uint32).max));
    uint8 commandCount = 1;

    vm.startPrank(owner);
    invokeOracle(
      abi.encodePacked(
        PRICES_ID,
        commandCount,
        EVM_GAS_PRICE_ID, uint16(EVM_CHAIN_ID), gasPrice,
        ACCESS_CONTROL_ID,
        commandCount,
        ADD_ADMIN_ID, newAdmin
      )
    );

    commandCount = 1;
    uint8 queryCount = 2;
    bytes memory getRes = invokeStaticOracle(
      abi.encodePacked(
        ACCESS_CONTROL_QUERIES_ID,
        commandCount,
        IS_ADMIN_ID,
        newAdmin,
        ASSISTANT_ID,
        PRICES_QUERIES_ID,
        queryCount,
        QUERY_FEE_PARAMS_ID, uint16(EVM_CHAIN_ID),
        CHAIN_ID_ID
      )
    );

    uint offset = 0;
    bool isAdmin;
    address assistant_;
    uint256 evmParams_;
    uint16 chainId_;

    (isAdmin, offset) = getRes.asBoolMemUnchecked(offset);
    (assistant_, offset) = getRes.asAddressMemUnchecked(offset);
    assertEq(isAdmin, true);
    assertEq(assistant_, assistant);

    (evmParams_, offset) = getRes.asUint256MemUnchecked(offset);
    (chainId_, offset) = getRes.asUint16MemUnchecked(offset);
    EvmFeeParams evmFeeParams = EvmFeeParamsLib.checkedWrap(evmParams_);
    assertEq(gasPrice, GasPrice.unwrap(evmFeeParams.gasPrice()));
    assertEq(HOME_CHAIN_ID, chainId_);
  }
}
