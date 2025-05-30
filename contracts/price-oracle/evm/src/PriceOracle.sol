// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { CHAIN_ID_SOLANA, CHAIN_ID_SUI } from "wormhole-sdk/constants/Chains.sol";
import { ICoreBridge } from "wormhole-sdk/interfaces/ICoreBridge.sol";
import { BytesParsing } from "wormhole-sdk/libraries/BytesParsing.sol";
import { PriceOracleDispatcher } from "./assets/PriceOracleDispatcher.sol";
import { PriceOraclePrices } from "./assets/PriceOraclePrices.sol";
import { EvmFeeParamsLib } from "./assets/types/EvmFeeParams.sol";
import { SuiFeeParamsLib } from "./assets/types/SuiFeeParams.sol";
import { SolanaFeeParamsLib } from "./assets/types/SolanaFeeParams.sol";

contract PriceOracle is PriceOracleDispatcher {
  using BytesParsing for bytes;

  constructor(
    ICoreBridge wormholeCore
  ) PriceOraclePrices(wormholeCore) {}

  //constructor of the proxy contract setting storage variables
  function _proxyConstructor(bytes calldata args) internal override {
    uint offset = 0;

    address owner;
    uint8 adminCount;
    (owner, offset) = args.asAddressCdUnchecked(offset);
    (adminCount, offset) = args.asUint8CdUnchecked(offset);

    address[] memory admins = new address[](adminCount);
    for (uint8 i = 0; i < adminCount; ++i) {
      address admin;
      (admin, offset) = args.asAddressCdUnchecked(offset);
      admins[i] = admin;
    }

    address assistant;
    (assistant, offset) = args.asAddressCdUnchecked(offset);

    _accessControlConstruction(owner, admins);
    _configConstruction(assistant);

    while (offset < args.length) {
      uint16 targetChain;
      uint256 feeParams;
      (targetChain, offset) = args.asUint16CdUnchecked(offset);
      (feeParams, offset) = args.asUint256CdUnchecked(offset);

      if (targetChain == CHAIN_ID_SOLANA)
        SolanaFeeParamsLib.checkedWrap(feeParams);
      else if (targetChain == CHAIN_ID_SUI)
        SuiFeeParamsLib.checkedWrap(feeParams);
      else
        EvmFeeParamsLib.checkedWrap(feeParams);

      _setFeeParams(targetChain, feeParams);
    }

    BytesParsing.checkLength(offset, args.length);
  }
}
