// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import {
  GasTokenPrice, GasTokenPriceLib,
  PricePerAccountByte, PricePerAccountByteLib,
  SolanaComputationPrice, SolanaComputationPriceLib,
  SignaturePrice, SignaturePriceLib
} from "./ParamLibs.sol";

error InvalidSolanaLayout(uint256 value);

//store everything in one slot and make reads and writes cheap (no struct in memory nonsense)
type SolanaFeeParams is uint256;
library SolanaFeeParamsLib {
  // layout (low to high bits - i.e. in packed struct order) - unit:
  //  6 bytes gasTokenPrice    - μusd/sol (=> min: 1e-6 usd/sol, max: ~1e8 usd/sol)
  //  4 bytes computationPrice  - microlamports/CU
  //  4 bytes pricePerAccountByte  - lamports/byte
  //  4 bytes signaturePrice    - lamports/signature
  // 14 bytes currently unused

  uint256 private constant GAS_TOKEN_PRICE_SIZE = GasTokenPriceLib.BYTE_SIZE * 8;
  uint256 private constant GAS_TOKEN_PRICE_OFFSET = 0;
  uint256 private constant GAS_TOKEN_PRICE_WRITE_MASK =
    ~(((1 << GAS_TOKEN_PRICE_SIZE) - 1) << GAS_TOKEN_PRICE_OFFSET);

  uint256 private constant COMPUTATION_PRICE_SIZE = SolanaComputationPriceLib.BYTE_SIZE * 8;
  uint256 private constant COMPUTATION_PRICE_OFFSET =
    GAS_TOKEN_PRICE_OFFSET + GAS_TOKEN_PRICE_SIZE;
  uint256 private constant COMPUTATION_PRICE_WRITE_MASK =
    ~(((1 << COMPUTATION_PRICE_SIZE) - 1) << COMPUTATION_PRICE_OFFSET);

  uint256 private constant PRICE_PER_ACCOUNT_BYTE_SIZE = PricePerAccountByteLib.BYTE_SIZE * 8;
  uint256 private constant PRICE_PER_ACCOUNT_BYTE_OFFSET =
    COMPUTATION_PRICE_OFFSET + COMPUTATION_PRICE_SIZE;
  uint256 private constant PRICE_PER_ACCOUNT_BYTE_WRITE_MASK =
    ~(((1 << PRICE_PER_ACCOUNT_BYTE_SIZE) - 1) << PRICE_PER_ACCOUNT_BYTE_OFFSET);

  uint256 private constant SIGNATURE_PRICE_SIZE = SignaturePriceLib.BYTE_SIZE * 8;
  uint256 private constant SIGNATURE_PRICE_OFFSET =
    PRICE_PER_ACCOUNT_BYTE_OFFSET + PRICE_PER_ACCOUNT_BYTE_SIZE;
  uint256 private constant SIGNATURE_PRICE_WRITE_MASK =
    ~(((1 << SIGNATURE_PRICE_SIZE) - 1) << SIGNATURE_PRICE_OFFSET);

  uint256 private constant LAYOUT_WRITE_MASK = //all unused bits are 1
    GAS_TOKEN_PRICE_WRITE_MASK & COMPUTATION_PRICE_WRITE_MASK &
    PRICE_PER_ACCOUNT_BYTE_WRITE_MASK & SIGNATURE_PRICE_WRITE_MASK;

  function checkedWrap(uint256 value) internal pure returns (SolanaFeeParams) { unchecked {
    if ((value & LAYOUT_WRITE_MASK) != 0)
      revert InvalidSolanaLayout(value);

    return SolanaFeeParams.wrap(value);
  }}

  function gasTokenPrice(
    SolanaFeeParams params
  ) internal pure returns (GasTokenPrice) { unchecked {
    return GasTokenPrice.wrap(
      uint48(SolanaFeeParams.unwrap(params) >> GAS_TOKEN_PRICE_OFFSET)
    );
  }}

  function gasTokenPrice(
    SolanaFeeParams params,
    GasTokenPrice gasTokenPrice_
  ) internal pure returns (SolanaFeeParams) { unchecked {
    return SolanaFeeParams.wrap(
      (SolanaFeeParams.unwrap(params) & GAS_TOKEN_PRICE_WRITE_MASK) |
      (uint256(GasTokenPrice.unwrap(gasTokenPrice_)) << GAS_TOKEN_PRICE_OFFSET)
    );
  }}

  function pricePerAccountByte(
    SolanaFeeParams params
  ) internal pure returns (PricePerAccountByte) { unchecked {
    return PricePerAccountByte.wrap(
      uint32(SolanaFeeParams.unwrap(params) >> PRICE_PER_ACCOUNT_BYTE_OFFSET)
    );
  }}

  function pricePerAccountByte(
    SolanaFeeParams params,
    PricePerAccountByte pricePerAccountByte_
  ) internal pure returns (SolanaFeeParams) { unchecked {
    return SolanaFeeParams.wrap(
      (SolanaFeeParams.unwrap(params) & PRICE_PER_ACCOUNT_BYTE_WRITE_MASK) |
      (uint256(PricePerAccountByte.unwrap(pricePerAccountByte_)) << PRICE_PER_ACCOUNT_BYTE_OFFSET)
    );
  }}

  function computationPrice(
    SolanaFeeParams params
  ) internal pure returns (SolanaComputationPrice) { unchecked {
    return SolanaComputationPrice.wrap(
      uint32(SolanaFeeParams.unwrap(params) >> COMPUTATION_PRICE_OFFSET)
    );
  }}

  function computationPrice(
    SolanaFeeParams params,
    SolanaComputationPrice computationPrice_
  ) internal pure returns (SolanaFeeParams) { unchecked {
    return SolanaFeeParams.wrap(
      (SolanaFeeParams.unwrap(params) & COMPUTATION_PRICE_WRITE_MASK) |
      (uint256(SolanaComputationPrice.unwrap(computationPrice_)) << COMPUTATION_PRICE_OFFSET)
    );
  }}

  function signaturePrice(
    SolanaFeeParams params
  ) internal pure returns (SignaturePrice) { unchecked {
    return SignaturePrice.wrap(
      uint32(SolanaFeeParams.unwrap(params) >> SIGNATURE_PRICE_OFFSET)
    );
  }}

  function signaturePrice(
    SolanaFeeParams params,
    SignaturePrice signaturePrice_
  ) internal pure returns (SolanaFeeParams) { unchecked {
    return SolanaFeeParams.wrap(
      (SolanaFeeParams.unwrap(params) & SIGNATURE_PRICE_WRITE_MASK) |
      (uint256(SignaturePrice.unwrap(signaturePrice_)) << SIGNATURE_PRICE_OFFSET)
    );
  }}
}

using SolanaFeeParamsLib for SolanaFeeParams global;