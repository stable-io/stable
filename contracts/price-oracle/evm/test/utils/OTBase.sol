// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { DISPATCHER_PROTOCOL_VERSION0 } from "price-oracle/assets/PriceOracleIds.sol";
import { SolanaFeeParams } from "price-oracle/assets/types/SolanaFeeParams.sol";
import { EvmFeeParams } from "price-oracle/assets/types/EvmFeeParams.sol";
import { BytesParsing } from "wormhole-sdk/libraries/BytesParsing.sol";
import { CHAIN_ID_SOLANA } from "wormhole-sdk/constants/Chains.sol";
import { ICoreBridge } from "wormhole-sdk/interfaces/ICoreBridge.sol";
import { PriceOracle } from "price-oracle/PriceOracle.sol";
import { Proxy } from "wormhole-sdk/proxy/Proxy.sol";
import { reRevert } from "wormhole-sdk/Utils.sol";
import "forge-std/Test.sol";
import {
  GasTokenPriceLib, 
  PricePerTxByteLib,
  GasPriceLib,
  SolanaComputationPriceLib,
  PricePerAccountByteLib,
  SignaturePriceLib
} from "price-oracle/assets/types/ParamLibs.sol";

contract PriceOracleTestBase is Test {
  using BytesParsing for bytes;

  address immutable owner;
  address immutable admin;
  address immutable assistant;

  EvmFeeParams baseEvmFeeParams;
  SolanaFeeParams baseSolanaFeeParams;

  uint16 HOME_CHAIN_ID = 2;
  uint HOME_GAS_TOKEN_PRICE = 500; //usd

  uint16 EVM_CHAIN_ID = 3;
  uint EVM_GAS_TOKEN_PRICE = 1000; //usd
  uint EVM_PRICE_PER_BYTE = 1 gwei;
  uint EVM_GAS_PRICE = 10 gwei;

  uint16 SOLANA_CHAIN_ID = CHAIN_ID_SOLANA;
  uint SOLANA_GAS_TOKEN_PRICE = 100; // usd
  uint SOLANA_COMPUTATION_COST = 100_000; // microlamports/cu
  uint SOLANA_PRICE_PER_ACCOUNT_BYTE = 6_960; // lamports/byte
  uint SOLANA_SIGNATURE_PRICE = 10_000; // lamports/signature

  address priceOracleImplementation;
  PriceOracle priceOracle;
  ICoreBridge wormholeCore;

  constructor() {
    owner        = makeAddr("owner");
    admin        = makeAddr("admin");
    assistant    = makeAddr("assistant");
    wormholeCore = ICoreBridge(makeAddr("wormholeCore"));
  }

  function _setUp1() internal virtual { }

  function setUp() public {
    uint8 adminCount = 1;

    vm.mockCall(
      address(wormholeCore),
      abi.encodeWithSelector(ICoreBridge.chainId.selector),
      abi.encode(HOME_CHAIN_ID)
    );

    baseEvmFeeParams = baseEvmFeeParams
      .gasTokenPrice(GasTokenPriceLib.to(EVM_GAS_TOKEN_PRICE * 1e18))
      .pricePerTxByte(PricePerTxByteLib.to(EVM_PRICE_PER_BYTE))
      .gasPrice(GasPriceLib.to(EVM_GAS_PRICE));

    baseSolanaFeeParams = baseSolanaFeeParams
      .gasTokenPrice(GasTokenPriceLib.to(SOLANA_GAS_TOKEN_PRICE * 1e18))
      .computationPrice(SolanaComputationPriceLib.to(SOLANA_COMPUTATION_COST * 1e3))
      .pricePerAccountByte(PricePerAccountByteLib.to(SOLANA_PRICE_PER_ACCOUNT_BYTE * 1e9))
      .signaturePrice(SignaturePriceLib.to(SOLANA_SIGNATURE_PRICE * 1e9));

    priceOracleImplementation = address(new PriceOracle(wormholeCore));

    priceOracle = PriceOracle(address(new Proxy(
      priceOracleImplementation,
      abi.encodePacked(
        owner,
        adminCount,
        admin,
        assistant,
        HOME_CHAIN_ID,
        EvmFeeParams.wrap(0).gasTokenPrice(GasTokenPriceLib.to(HOME_GAS_TOKEN_PRICE * 1e18)),
        EVM_CHAIN_ID,
        baseEvmFeeParams,
        CHAIN_ID_SOLANA,
        baseSolanaFeeParams
      )
    )));

    _setUp1();
  }


  function invokeStaticOracle(bytes memory messages) view internal returns (bytes memory data) {
    bytes memory getCall = abi.encodePacked(priceOracle.get1959.selector, DISPATCHER_PROTOCOL_VERSION0, messages);
    (bool success, bytes memory result) = address(priceOracle).staticcall(getCall);
    return decodeBytesResult(success, result);
  }

  function invokeOracle(bytes memory messages) internal returns (bytes memory data) {
    return invokeOracle(messages, 0);
  }

  function invokeOracle(bytes memory messages, uint value) internal returns (bytes memory data) {
    bytes memory execCall = abi.encodePacked(priceOracle.exec768.selector, DISPATCHER_PROTOCOL_VERSION0, messages);
    (bool success, bytes memory result) = address(priceOracle).call{value: value}(execCall);
    return decodeBytesResult(success, result);
  }

  function decodeBytesResult(bool success, bytes memory result) pure private returns (bytes memory data) {
    if (!success) {
      reRevert(result);
    }
    data = abi.decode(result, (bytes));
  }
}
