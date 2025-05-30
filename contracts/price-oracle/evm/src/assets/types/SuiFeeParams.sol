// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import {
  GasTokenPrice, GasTokenPriceLib,
  SuiComputationPrice, SuiComputationPriceLib,
  StoragePrice, StoragePriceLib,
  StorageRebate, StorageRebateLib
} from "./ParamLibs.sol";

error InvalidSuiLayout(uint256 value);

//store everything in one slot and make reads and writes cheap (no struct in memory nonsense)
type SuiFeeParams is uint256;
library SuiFeeParamsLib {
  // layout (low to high bits - i.e. in packed struct order) - unit:
  //  6 bytes gasTokenPrice    - μusd/sui (=> min: 1e-6 usd/sui, max: ~1e8 usd/sui)
  //  4 bytes computationPrice - mist/computationUnit
  //  4 bytes storagePrice     - mist/byte
  //  1 byte  storageRebate    - number between 0 and 100
  // 17 bytes currently unused

  uint256 private constant GAS_TOKEN_PRICE_SIZE = GasTokenPriceLib.BYTE_SIZE * 8;
  uint256 private constant GAS_TOKEN_PRICE_OFFSET = 0;
  uint256 private constant GAS_TOKEN_PRICE_WRITE_MASK =
    ~(((1 << GAS_TOKEN_PRICE_SIZE) - 1) << GAS_TOKEN_PRICE_OFFSET);

  uint256 private constant COMPUTATION_PRICE_SIZE = SuiComputationPriceLib.BYTE_SIZE * 8;
  uint256 private constant COMPUTATION_PRICE_OFFSET =
    GAS_TOKEN_PRICE_OFFSET + GAS_TOKEN_PRICE_SIZE;
  uint256 private constant COMPUTATION_PRICE_WRITE_MASK =
    ~(((1 << COMPUTATION_PRICE_SIZE) - 1) << COMPUTATION_PRICE_OFFSET);

  uint256 private constant STORAGE_PRICE_SIZE = StoragePriceLib.BYTE_SIZE * 8;
  uint256 private constant STORAGE_PRICE_OFFSET =
    COMPUTATION_PRICE_OFFSET + COMPUTATION_PRICE_SIZE;
  uint256 private constant STORAGE_PRICE_WRITE_MASK =
    ~(((1 << STORAGE_PRICE_SIZE) - 1) << STORAGE_PRICE_OFFSET);

  uint256 private constant STORAGE_REBATE_SIZE = StoragePriceLib.BYTE_SIZE * 8;
  uint256 private constant STORAGE_REBATE_OFFSET =
    STORAGE_PRICE_OFFSET + STORAGE_PRICE_SIZE;
  uint256 private constant STORAGE_REBATE_WRITE_MASK =
    ~(((1 << STORAGE_REBATE_SIZE) - 1) << STORAGE_REBATE_OFFSET);

  uint256 private constant LAYOUT_WRITE_MASK = //all unused bits are 1
    GAS_TOKEN_PRICE_WRITE_MASK & COMPUTATION_PRICE_WRITE_MASK & 
    STORAGE_PRICE_WRITE_MASK & STORAGE_REBATE_WRITE_MASK;

  function checkedWrap(uint256 value) internal pure returns (SuiFeeParams) { unchecked {
    if ((value & LAYOUT_WRITE_MASK) != 0)
      revert InvalidSuiLayout(value);

    return SuiFeeParams.wrap(value);
  }}

  function gasTokenPrice(
    SuiFeeParams params
  ) internal pure returns (GasTokenPrice) { unchecked {
    return GasTokenPrice.wrap(
      uint48(SuiFeeParams.unwrap(params) >> GAS_TOKEN_PRICE_OFFSET)
    );
  }}

  function gasTokenPrice(
    SuiFeeParams params,
    GasTokenPrice gasTokenPrice_
  ) internal pure returns (SuiFeeParams) { unchecked {
    return SuiFeeParams.wrap(
      (SuiFeeParams.unwrap(params) & GAS_TOKEN_PRICE_WRITE_MASK) |
      (uint256(GasTokenPrice.unwrap(gasTokenPrice_)) << GAS_TOKEN_PRICE_OFFSET)
    );
  }}

  function computationPrice(
    SuiFeeParams params
  ) internal pure returns (SuiComputationPrice) { unchecked {
    return SuiComputationPrice.wrap(
      uint32(SuiFeeParams.unwrap(params) >> COMPUTATION_PRICE_OFFSET)
    );
  }}

  function computationPrice(
    SuiFeeParams params,
    SuiComputationPrice computationPrice_
  ) internal pure returns (SuiFeeParams) { unchecked {
    return SuiFeeParams.wrap(
      (SuiFeeParams.unwrap(params) & COMPUTATION_PRICE_WRITE_MASK) |
      (uint256(SuiComputationPrice.unwrap(computationPrice_)) << COMPUTATION_PRICE_OFFSET)
    );
  }}

  function storagePrice(
    SuiFeeParams params
  ) internal pure returns (StoragePrice) { unchecked {
    return StoragePrice.wrap(
      uint32(SuiFeeParams.unwrap(params) >> STORAGE_PRICE_OFFSET)
    );
  }}

  function storagePrice(
    SuiFeeParams params,
    StoragePrice storagePrice_
  ) internal pure returns (SuiFeeParams) { unchecked {
    return SuiFeeParams.wrap(
      (SuiFeeParams.unwrap(params) & STORAGE_PRICE_WRITE_MASK) |
      (uint256(StoragePrice.unwrap(storagePrice_)) << STORAGE_PRICE_OFFSET)
    );
  }}

  function storageRebate(
    SuiFeeParams params
  ) internal pure returns (StorageRebate) { unchecked {
    return StorageRebate.wrap(
      uint8(SuiFeeParams.unwrap(params) >> STORAGE_REBATE_OFFSET)
    );
  }}

  function storageRebate(
    SuiFeeParams params,
    StorageRebate storageRebate_
  ) internal pure returns (SuiFeeParams) { unchecked {
    return SuiFeeParams.wrap(
      (SuiFeeParams.unwrap(params) & STORAGE_REBATE_WRITE_MASK) |
      (uint256(StorageRebate.unwrap(storageRebate_)) << STORAGE_REBATE_OFFSET)
    );
  }}
}

using SuiFeeParamsLib for SuiFeeParams global;