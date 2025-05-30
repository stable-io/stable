// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import {
  PricePerTxByte,
  GasPrice,
  GasTokenPrice,
  SolanaComputationPrice,
  PricePerAccountByte,
  SignaturePrice,
  GasDropoff,
  BaseFee,
  PricePerTxByteLib,
  GasPriceLib,
  GasTokenPriceLib,
  SolanaComputationPriceLib,
  PricePerAccountByteLib,
  GasDropoffLib,
  BaseFeeLib,
  checkedUnitDiv,
  LosingAllPrecision,
  ExceedsMax
} from "price-oracle/assets/types/ParamLibs.sol";
import {
  SolanaFeeParams,
  SolanaFeeParamsLib,
  InvalidSolanaLayout
} from "price-oracle/assets/types/SolanaFeeParams.sol";
import {
  EvmFeeParams,
  EvmFeeParamsLib,
  InvalidEvmLayout
} from "price-oracle/assets/types/EvmFeeParams.sol";
import "forge-std/Test.sol";

contract FeeParamsTest is Test {

  function testEvmFeeParams(
    uint32 gasPrice,
    uint32 pricePerTxByte,
    uint48 gasTokenPrice
  ) public pure {
    gasPrice = uint32(bound(gasPrice, 1e6 + 1, type(uint32).max));
    pricePerTxByte = uint32(bound(pricePerTxByte, 1e6 + 1, type(uint32).max));
    gasTokenPrice = uint48(bound(gasTokenPrice, 1e12 + 1, type(uint48).max));

    EvmFeeParams evmFeeParams;
    evmFeeParams = evmFeeParams.pricePerTxByte(PricePerTxByte.wrap(pricePerTxByte));
    evmFeeParams = evmFeeParams.gasPrice(GasPrice.wrap(gasPrice));
    evmFeeParams = evmFeeParams.gasTokenPrice(GasTokenPrice.wrap(gasTokenPrice));

    assertEq(PricePerTxByte.unwrap(evmFeeParams.pricePerTxByte()), pricePerTxByte);
    assertEq(GasPrice.unwrap(evmFeeParams.gasPrice()), gasPrice);
    assertEq(GasTokenPrice.unwrap(evmFeeParams.gasTokenPrice()), gasTokenPrice);
  }

  // TODO: rewrite this test to avoid this?
  /// forge-config: default.allow_internal_expect_revert = true
  function testWrapEvmFeeParams(
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

    EvmFeeParams wrapped = EvmFeeParamsLib.checkedWrap(EvmFeeParams.unwrap(evmFeeParams));
    assertEq(EvmFeeParams.unwrap(wrapped), EvmFeeParams.unwrap(evmFeeParams));

    // 4 bytes * 8 bits = 32 bits
    uint8 offset = 4 * 8;
    uint256 wrongWrapped = uint256(EvmFeeParams.unwrap(evmFeeParams)) << offset;
    vm.expectRevert(
      abi.encodeWithSelector(InvalidEvmLayout.selector, wrongWrapped)
    );
    EvmFeeParamsLib.checkedWrap(wrongWrapped);
  }

  function testSolanaFeeParams(
    uint32 computationPrice,
    uint32 pricePerAccountByte,
    uint48 gasTokenPrice
  ) public pure {
    computationPrice = uint32(bound(computationPrice, 1e9, type(uint32).max));
    pricePerAccountByte = uint32(bound(pricePerAccountByte, 1e9, type(uint32).max));
    gasTokenPrice = uint48(bound(gasTokenPrice, 1e12, type(uint48).max));

    SolanaFeeParams solanaFeeParams;
    solanaFeeParams = solanaFeeParams.computationPrice(SolanaComputationPrice.wrap(computationPrice));
    solanaFeeParams = solanaFeeParams.pricePerAccountByte(PricePerAccountByte.wrap(pricePerAccountByte));
    solanaFeeParams = solanaFeeParams.gasTokenPrice(GasTokenPrice.wrap(gasTokenPrice));

    assertEq(SolanaComputationPrice.unwrap(solanaFeeParams.computationPrice()), computationPrice);
    assertEq(PricePerAccountByte.unwrap(solanaFeeParams.pricePerAccountByte()), pricePerAccountByte);
    assertEq(GasTokenPrice.unwrap(solanaFeeParams.gasTokenPrice()), gasTokenPrice);
  }

  // TODO: rewrite this test to avoid this?
  /// forge-config: default.allow_internal_expect_revert = true
  function testWrapSolanaFeeParams(
    uint32 computationPrice,
    uint32 pricePerAccountByte,
    uint32 signaturePrice,
    uint48 gasTokenPrice
  ) public {
    computationPrice = uint32(bound(computationPrice, 1e3, type(uint32).max));
    pricePerAccountByte = uint32(bound(pricePerAccountByte, 1e9, type(uint32).max));
    signaturePrice = uint32(bound(signaturePrice, 1e9, type(uint32).max));
    gasTokenPrice = uint48(bound(gasTokenPrice, 1e12, type(uint48).max));

    SolanaFeeParams solanaFeeParams;
    solanaFeeParams = solanaFeeParams.computationPrice(SolanaComputationPrice.wrap(computationPrice));
    solanaFeeParams = solanaFeeParams.pricePerAccountByte(PricePerAccountByte.wrap(pricePerAccountByte));
    solanaFeeParams = solanaFeeParams.signaturePrice(SignaturePrice.wrap(signaturePrice));
    solanaFeeParams = solanaFeeParams.gasTokenPrice(GasTokenPrice.wrap(gasTokenPrice));

    SolanaFeeParams wrapped = SolanaFeeParamsLib.checkedWrap(SolanaFeeParams.unwrap(solanaFeeParams));
    assertEq(SolanaFeeParams.unwrap(wrapped), SolanaFeeParams.unwrap(solanaFeeParams));

    // 4 bytes * 8 bits = 32 bits
    uint8 offset = 4 * 8;
    uint256 wrongWrapped = uint256(SolanaFeeParams.unwrap(solanaFeeParams)) << offset;
    vm.expectRevert(
      abi.encodeWithSelector(InvalidSolanaLayout.selector, wrongWrapped)
    );
    SolanaFeeParamsLib.checkedWrap(wrongWrapped);
  }

  function testCheckedUnitDiv_zeroReturnsZero() public {
    uint val = 0;
    uint divisor = 0;
    uint max = 0;

    uint result = checkedUnitDiv(val, divisor, max);
    assertEq(result, 0);
  }

  // TODO: rewrite this test to avoid this?
  /// forge-config: default.allow_internal_expect_revert = true
  function testCheckedUnitDiv_noPrecision() public {
    uint val = 1;
    uint divisor = 10;
    uint max = 1;

    vm.expectRevert(
      abi.encodeWithSelector(LosingAllPrecision.selector, val, divisor)
    );
    checkedUnitDiv(val, divisor, max);
  }

  // TODO: rewrite this test to avoid this?
  /// forge-config: default.allow_internal_expect_revert = true
  function testCheckedUnitDiv_exceedsMax() public {
    uint val = 10;
    uint divisor = 2;
    uint max = 4;

    uint ret = val / divisor;
    vm.expectRevert(
      abi.encodeWithSelector(ExceedsMax.selector, ret, max)
    );
    checkedUnitDiv(val, divisor, max);
  }

  function testCheckedUnitDiv_normalDivision() public {
    uint val = 10;
    uint divisor = 2;
    uint max = 5;

    uint ret = val / divisor;
    uint result = checkedUnitDiv(val, divisor, max);
    assertEq(result, ret);
  }

  function testGasTokenPriceLib(
    uint256 val
  ) public pure {
    uint unit = 1e12;
    val = bound(val, unit, type(uint48).max * unit);

    uint internalValue = checkedUnitDiv(val, unit, type(uint48).max);
    GasTokenPrice gasTokenPrice = GasTokenPriceLib.to(val);
    assertEq(GasTokenPrice.unwrap(gasTokenPrice), internalValue);

    uint result = GasTokenPriceLib.from(gasTokenPrice);
    assertEq(result, internalValue * unit);
  }

  function testGasPriceLib(
    uint256 val
  ) public pure {
    uint unit = 1e6;
    val = bound(val, unit, type(uint32).max * unit);

    uint internalValue = checkedUnitDiv(val, unit, type(uint32).max);
    GasPrice gasPrice = GasPriceLib.to(val);
    assertEq(GasPrice.unwrap(gasPrice), internalValue);

    uint result = GasPriceLib.from(gasPrice);
    assertEq(result, internalValue * unit);
  }

  function testPricePerTxByteLib(
    uint256 val
  ) public pure {
    uint unit = 1e6;
    val = bound(val, unit, type(uint32).max * unit);

    uint internalValue = checkedUnitDiv(val, unit, type(uint32).max);
    PricePerTxByte pricePerTxByte = PricePerTxByteLib.to(val);
    assertEq(PricePerTxByte.unwrap(pricePerTxByte), internalValue);

    uint result = PricePerTxByteLib.from(pricePerTxByte);
    assertEq(result, internalValue * unit);
  }

  function testSolanaComputationPriceLib(
    uint256 val
  ) public pure {
    uint unit = 1e3;
    val = bound(val, unit, type(uint32).max * unit);

    uint internalValue = checkedUnitDiv(val, unit, type(uint32).max);
    SolanaComputationPrice computationPrice = SolanaComputationPriceLib.to(val);
    assertEq(SolanaComputationPrice.unwrap(computationPrice), internalValue);

    uint result = SolanaComputationPriceLib.from(computationPrice);
    assertEq(result, internalValue * unit);
  }

  function testPricePerAccountByteLib(
    uint256 val
  ) public pure {
    uint unit = 1e9;
    val = bound(val, unit, type(uint32).max * unit);

    uint internalValue = checkedUnitDiv(val, unit, type(uint32).max);
    PricePerAccountByte pricePerAccountByte = PricePerAccountByteLib.to(val);
    assertEq(PricePerAccountByte.unwrap(pricePerAccountByte), internalValue);

    uint result = PricePerAccountByteLib.from(pricePerAccountByte);
    assertEq(result, internalValue * unit);
  }

  function testGasDropoffLib(
    uint256 val
  ) public pure {
    uint unit = 1e12;
    val = bound(val, unit, type(uint32).max * unit);

    uint internalValue = checkedUnitDiv(val, unit, type(uint32).max);
    GasDropoff gasDropoff = GasDropoffLib.to(val);
    assertEq(GasDropoff.unwrap(gasDropoff), internalValue);

    uint result = GasDropoffLib.from(gasDropoff);
    assertEq(result, internalValue * unit);
  }

  function testBaseFeeLib(
    uint256 val
  ) public pure {
    uint unit = 1e12;
    val = bound(val, unit, type(uint32).max * unit);

    uint internalValue = checkedUnitDiv(val, unit, type(uint32).max);
    BaseFee baseFee = BaseFeeLib.to(val);
    assertEq(BaseFee.unwrap(baseFee), internalValue);

    uint result = BaseFeeLib.from(baseFee);
    assertEq(result, internalValue * unit);
  }
}