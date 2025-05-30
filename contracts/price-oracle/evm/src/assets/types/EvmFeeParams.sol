// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import {
  GasTokenPrice, GasTokenPriceLib,
  GasPrice, GasPriceLib,
  PricePerTxByte, PricePerTxByteLib
} from "./ParamLibs.sol";

error InvalidEvmLayout(uint256 value);

//store everything in one slot and make reads and writes cheap (no struct in memory nonsense)
type EvmFeeParams is uint256;
library EvmFeeParamsLib {
  //layout (low to high bits - i.e. in packed struct order) with internal and external units:
  //  6 bytes gasTokenPrice - μusd / eth (=> min: 1e-6 usd/eth, max: ~1e8 usd/eth)
  //  4 bytes gasPrice - Mwei / gas
  //  4 bytes pricePerTxByte - Mwei / byte
  // 18 bytes currently unused

  uint256 private constant GAS_TOKEN_PRICE_SIZE = GasTokenPriceLib.BYTE_SIZE * 8;
  uint256 private constant GAS_TOKEN_PRICE_OFFSET = 0;
  uint256 private constant GAS_TOKEN_PRICE_WRITE_MASK =
    ~(((1 << GAS_TOKEN_PRICE_SIZE) - 1) << GAS_TOKEN_PRICE_OFFSET);

  uint256 private constant GAS_PRICE_SIZE = GasPriceLib.BYTE_SIZE * 8;
  uint256 private constant GAS_PRICE_OFFSET =
    GAS_TOKEN_PRICE_OFFSET + GAS_TOKEN_PRICE_SIZE;
  uint256 private constant GAS_PRICE_WRITE_MASK =
    ~(((1 << GAS_PRICE_SIZE) - 1) << GAS_PRICE_OFFSET);

  uint256 private constant PRICE_PER_BYTE_SIZE = PricePerTxByteLib.BYTE_SIZE * 8;
  uint256 private constant PRICE_PER_BYTE_OFFSET =
    GAS_PRICE_OFFSET + GAS_PRICE_SIZE;
  uint256 private constant PRICE_PER_BYTE_WRITE_MASK =
    ~(((1 << PRICE_PER_BYTE_SIZE) - 1) << PRICE_PER_BYTE_OFFSET);

  uint256 private constant LAYOUT_WRITE_MASK = //all unused bits are 1
    PRICE_PER_BYTE_WRITE_MASK & GAS_PRICE_WRITE_MASK & GAS_TOKEN_PRICE_WRITE_MASK;

  function checkedWrap(uint256 value) internal pure returns (EvmFeeParams) { unchecked {
    if ((value & LAYOUT_WRITE_MASK) != 0)
      revert InvalidEvmLayout(value);

    return EvmFeeParams.wrap(value);
  }}

  function gasTokenPrice(EvmFeeParams params) internal pure returns (GasTokenPrice) { unchecked {
    return GasTokenPrice.wrap(
      uint48(EvmFeeParams.unwrap(params) >> GAS_TOKEN_PRICE_OFFSET)
    );
  }}

  function gasTokenPrice(
    EvmFeeParams params,
    GasTokenPrice gasTokenPrice_
  ) internal pure returns (EvmFeeParams) { unchecked {
    return EvmFeeParams.wrap(
      (EvmFeeParams.unwrap(params) & GAS_TOKEN_PRICE_WRITE_MASK) |
      (uint256(GasTokenPrice.unwrap(gasTokenPrice_)) << GAS_TOKEN_PRICE_OFFSET)
    );
  }}

  function gasPrice(EvmFeeParams params) internal pure returns (GasPrice) { unchecked {
    return GasPrice.wrap(
      uint32(EvmFeeParams.unwrap(params) >> GAS_PRICE_OFFSET)
    );
  }}

  function gasPrice(
    EvmFeeParams params,
    GasPrice gasPrice_
  ) internal pure returns (EvmFeeParams) { unchecked {
    return EvmFeeParams.wrap(
      (EvmFeeParams.unwrap(params) & GAS_PRICE_WRITE_MASK) |
      (uint256(GasPrice.unwrap(gasPrice_)) << GAS_PRICE_OFFSET)
    );
  }}

  function pricePerTxByte(EvmFeeParams params) internal pure returns (PricePerTxByte) { unchecked {
    return PricePerTxByte.wrap(
      uint32(EvmFeeParams.unwrap(params) >> PRICE_PER_BYTE_OFFSET)
    );
  }}

  function pricePerTxByte(
    EvmFeeParams params,
    PricePerTxByte pricePerTxByte_
  ) internal pure returns (EvmFeeParams) { unchecked {
    return EvmFeeParams.wrap(
      (EvmFeeParams.unwrap(params) & PRICE_PER_BYTE_WRITE_MASK) |
      (uint256(PricePerTxByte.unwrap(pricePerTxByte_)) << PRICE_PER_BYTE_OFFSET)
    );
  }}
}
using EvmFeeParamsLib for EvmFeeParams global;
