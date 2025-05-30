// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.28;

import "./CctpRTestBase.t.sol";

import {
  EVM_GAS_DROPOFF_GAS_COST,
  EVM_V1_GAS_COST,
  EVM_V1_BILLED_SIZE,
  EVM_V2_GAS_COST,
  EVM_V2_BILLED_SIZE,
  SUI_GAS_DROPOFF_COMPUTE_BUDGET,
  SUI_GAS_DROPOFF_STORAGE_BYTES,
  SUI_GAS_DROPOFF_STORAGE_REBATE,
  SUI_COMPUTE_BUDGET,
  SUI_STORAGE_BYTES,
  SUI_STORAGE_REBATE,
  SOLANA_COMPUTE_BUDGET,
  SOLANA_STORAGE_BYTES,
  SOLANA_SIGNATURE_COUNT,
  AVAX_HOP_GAS_COST
} from "cctp-xr/assets/CctpRQuote.sol";

contract Quote is CctpRTestBase {
  int constant FEE_ADJUSTMENT_ABSOLUTE_MULTIPLIER = 1e16;
  uint constant FEE_ADJUSTMENT_RELATIVE_DENOMINATOR = 1e2;

  //always uses 1 gas token (=MEGA in micro gas tokens) as dropoff amount
  uint32 constant MEGA = 1e6;

  function _setFeeAdjustments(Route route, uint256 adjustments, uint8 mappingIndex) internal {
    vm.prank(feeAdjuster);
    _cctpRExec(
      abi.encodePacked(UPDATE_FEE_ADJUSTMENTS_ID, route, mappingIndex, uint256(adjustments)),
      0
    );
  }

  function _applyRelativeFeeAdjustment(
    uint value,
    uint feeAdjustmentRelative
  ) internal pure returns (uint) {
    return value * feeAdjustmentRelative / FEE_ADJUSTMENT_RELATIVE_DENOMINATOR;
  }

  function _applyAbsoluteFeeAdjustment(
    uint usdc,
    int16 feeAdjustmentAbsolute
  ) internal pure returns (uint) {
    int ret = int(usdc) + int(feeAdjustmentAbsolute) * FEE_ADJUSTMENT_ABSOLUTE_MULTIPLIER;
    return ret < 0 ? 0 : uint(ret);
  }

  function testQuoteSolanaV1WithAbsDiscount() public {
    uint feeAdjustments = _setFeeAdjustmentInSlot(
      0,
      CCTP_DOMAIN_SOLANA,
      ONE_USD_DISCOUNT_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );
    _setFeeAdjustments(Route.V1, feeAdjustments, 0);
    _checkQuoteSolanaV1(ONE_USD_DISCOUNT_FEE_ADJUSTMENT);
  }

  function testQuoteSolanaV1() public view {
    _checkQuoteSolanaV1(ONE_USD_OVERHEAD_FEE_ADJUSTMENT);
  }

  function _checkQuoteSolanaV1(int16 absAdjustment) public view {
    uint txCostInSol =
      SOLANA_COMPUTE_BUDGET * SOLANA_COMPUTATION_COST * 1e3 +
      SOLANA_STORAGE_BYTES * SOLANA_ACCOUNT_SIZE_COST * 1e9 +
      SOLANA_SIGNATURE_COUNT * SOLANA_SIGNATURE_COST * 1e9;
    uint adjustedTxCostInSol =
      _applyRelativeFeeAdjustment(txCostInSol, AT_COST_RELATIVE_FEE_ADJUSTMENT);
    uint adjustedTxCostInUsd = adjustedTxCostInSol * SOLANA_GAS_TOKEN_PRICE;
    uint expectedUsdQuoteNoDropoff =
      _applyAbsoluteFeeAdjustment(adjustedTxCostInUsd, absAdjustment);

    uint gasDropoffCostInUsd = SOLANA_GAS_TOKEN_PRICE * 1e18;
    uint adjustedGasDropoffCostInUsd =
      _applyRelativeFeeAdjustment(gasDropoffCostInUsd, ADD_FIVE_PERCENT_FEE_ADJUSTMENT);
    uint expectedUsdQuoteWithDropoff = expectedUsdQuoteNoDropoff + adjustedGasDropoffCostInUsd;

    uint usdcQuoteNoDropoff = _quoteRelay(CCTP_DOMAIN_SOLANA, Route.V1, 0, true);
    assertEq(usdcQuoteNoDropoff, expectedUsdQuoteNoDropoff / 1e12);

    uint usdcQuoteWithDropoff = _quoteRelay(CCTP_DOMAIN_SOLANA, Route.V1, MEGA, true);
    assertEq(usdcQuoteWithDropoff, expectedUsdQuoteWithDropoff / 1e12);

    uint gasQuoteNoDropoff = _quoteRelay(CCTP_DOMAIN_SOLANA, Route.V1, 0, false);
    assertEq(gasQuoteNoDropoff, expectedUsdQuoteNoDropoff / ETHEREUM_GAS_TOKEN_PRICE);

    uint gasQuoteWithDropoff = _quoteRelay(CCTP_DOMAIN_SOLANA, Route.V1, MEGA, false);
    assertEq(gasQuoteWithDropoff, expectedUsdQuoteWithDropoff / ETHEREUM_GAS_TOKEN_PRICE);
  }

  function testQuoteSuiV1FullDiscount() public {
    uint feeAdjustments = _setFeeAdjustmentInSlot(
      0,
      CCTP_DOMAIN_SUI,
      ONE_USD_OVERHEAD_FEE_ADJUSTMENT,
      FULLY_DISCOUNTED_FEE_ADJUSTMENT
    );
    _setFeeAdjustments(Route.V1, feeAdjustments, 0);

    uint expectedUsdQuoteNoDropoff =
      _applyAbsoluteFeeAdjustment(0, ONE_USD_OVERHEAD_FEE_ADJUSTMENT);

    uint gasDropoffCostInUsd = SUI_GAS_TOKEN_PRICE * 1e18;
    uint adjustedGasDropoffCostInUsd =
      _applyAbsoluteFeeAdjustment(
        _applyRelativeFeeAdjustment(gasDropoffCostInUsd, ADD_FIVE_PERCENT_FEE_ADJUSTMENT),
        ONE_USD_OVERHEAD_FEE_ADJUSTMENT
      );

    uint expectedUsdQuoteWithDropoff = expectedUsdQuoteNoDropoff + adjustedGasDropoffCostInUsd;

    uint usdcQuoteNoDropoff = _quoteRelay(CCTP_DOMAIN_SUI, Route.V1, 0, true);
    assertEq(usdcQuoteNoDropoff, expectedUsdQuoteNoDropoff / 1e12);

    uint usdcQuoteWithDropoff = _quoteRelay(CCTP_DOMAIN_SUI, Route.V1, MEGA, true);
    assertEq(usdcQuoteWithDropoff, expectedUsdQuoteWithDropoff / 1e12);

    uint gasQuoteNoDropoff = _quoteRelay(CCTP_DOMAIN_SUI, Route.V1, 0, false);
    assertEq(gasQuoteNoDropoff, expectedUsdQuoteNoDropoff / ETHEREUM_GAS_TOKEN_PRICE);

    uint gasQuoteWithDropoff = _quoteRelay(CCTP_DOMAIN_SUI, Route.V1, MEGA, false);
    assertEq(gasQuoteWithDropoff, expectedUsdQuoteWithDropoff / ETHEREUM_GAS_TOKEN_PRICE);
  }

  function testQuoteSuiV1() public view {
    uint executionCostInSui =
      SUI_COMPUTE_BUDGET * SUI_COMPUTATION_PRICE * 1e9 +
      SUI_STORAGE_BYTES * SUI_STORAGE_PRICE * 1e9 -
      SUI_STORAGE_REBATE * SUI_STORAGE_PRICE * SUI_REBATE_PERCENTAGE / 100 * 1e9;

    uint expectedUsdQuoteNoDropoff = executionCostInSui * SUI_GAS_TOKEN_PRICE;

    uint gasDropoffOverheadCostInSui =
      SUI_GAS_DROPOFF_COMPUTE_BUDGET * SUI_COMPUTATION_PRICE * 1e9 +
      SUI_GAS_DROPOFF_STORAGE_BYTES * SUI_STORAGE_PRICE * 1e9 -
      SUI_GAS_DROPOFF_STORAGE_REBATE * SUI_STORAGE_PRICE * SUI_REBATE_PERCENTAGE / 100 * 1e9;

    uint gasDropoffOverheadCostInUsd = gasDropoffOverheadCostInSui * SUI_GAS_TOKEN_PRICE;
    uint gasDropoffCostInUsd = SUI_GAS_TOKEN_PRICE * 1e18;
    uint adjustedGasDropoffCostInUsd =
      _applyAbsoluteFeeAdjustment(
        _applyRelativeFeeAdjustment(gasDropoffCostInUsd, ADD_FIVE_PERCENT_FEE_ADJUSTMENT),
        ONE_USD_OVERHEAD_FEE_ADJUSTMENT
      );

    uint totalGasDropoffCostInUsd = gasDropoffOverheadCostInUsd + adjustedGasDropoffCostInUsd;
    uint expectedUsdQuoteWithDropoff = expectedUsdQuoteNoDropoff + totalGasDropoffCostInUsd;

    uint usdcQuoteNoDropoff = _quoteRelay(CCTP_DOMAIN_SUI, Route.V1, 0, true);
    assertEq(usdcQuoteNoDropoff, expectedUsdQuoteNoDropoff / 1e12);

    uint usdcQuoteWithDropoff = _quoteRelay(CCTP_DOMAIN_SUI, Route.V1, MEGA, true);
    assertEq(usdcQuoteWithDropoff, expectedUsdQuoteWithDropoff / 1e12);

    uint gasQuoteNoDropoff = _quoteRelay(CCTP_DOMAIN_SUI, Route.V1, 0, false);
    assertEq(gasQuoteNoDropoff, expectedUsdQuoteNoDropoff / ETHEREUM_GAS_TOKEN_PRICE);

    uint gasQuoteWithDropoff = _quoteRelay(CCTP_DOMAIN_SUI, Route.V1, MEGA, false);
    assertEq(gasQuoteWithDropoff, expectedUsdQuoteWithDropoff / ETHEREUM_GAS_TOKEN_PRICE);
  }

  function _testQuoteWithBaseParamsV1(uint32 domain) private view {
    uint executionCostInEther =
      EVM_V1_GAS_COST * BASE_GAS_PRICE +
      EVM_V1_BILLED_SIZE * BASE_PRICE_PER_BYTE;

    uint executionCostInUsd = executionCostInEther * ETHEREUM_GAS_TOKEN_PRICE;

    uint expectedUsdQuoteNoDropoff =
      _applyAbsoluteFeeAdjustment(
        _applyRelativeFeeAdjustment(executionCostInUsd, DISCOUNT_BY_HALF_FEE_ADJUSTMENT),
        ONE_USD_OVERHEAD_FEE_ADJUSTMENT
      );

    uint gasDropoffOverheadCostInEther = EVM_GAS_DROPOFF_GAS_COST * BASE_GAS_PRICE;
    uint gasDropoffOverheadCostInUsd = gasDropoffOverheadCostInEther * ETHEREUM_GAS_TOKEN_PRICE;
    uint gasDropoffExecutionCostInUsd =
      _applyAbsoluteFeeAdjustment(
        _applyRelativeFeeAdjustment(
          executionCostInUsd + gasDropoffOverheadCostInUsd,
          DISCOUNT_BY_HALF_FEE_ADJUSTMENT
        ),
        ONE_USD_OVERHEAD_FEE_ADJUSTMENT
      );

    uint gasDropoffCostInUsd = ETHEREUM_GAS_TOKEN_PRICE * 1e18;
    uint adjustedGasDropoffCostInUsd =
      _applyAbsoluteFeeAdjustment(gasDropoffCostInUsd, ONE_USD_OVERHEAD_FEE_ADJUSTMENT);

    uint expectedUsdQuoteWithDropoff = gasDropoffExecutionCostInUsd + adjustedGasDropoffCostInUsd;

    uint usdcQuoteNoDropoff = _quoteRelay(domain, Route.V1, 0, true);
    assertEq(usdcQuoteNoDropoff, expectedUsdQuoteNoDropoff / 1e12);

    uint usdcQuoteWithDropoff = _quoteRelay(domain, Route.V1, MEGA, true);
    assertEq(usdcQuoteWithDropoff, expectedUsdQuoteWithDropoff / 1e12);

    uint gasQuoteNoDropoff = _quoteRelay(domain, Route.V1, 0, false);
    assertEq(gasQuoteNoDropoff, expectedUsdQuoteNoDropoff / ETHEREUM_GAS_TOKEN_PRICE);

    uint gasQuoteWithDropoff = _quoteRelay(domain, Route.V1, MEGA, false);
    assertEq(gasQuoteWithDropoff, expectedUsdQuoteWithDropoff / ETHEREUM_GAS_TOKEN_PRICE);
  }

  function _testQuoteWithBaseParamsV2(uint32 domain) public view {
    uint executionCostInEther =
      EVM_V2_GAS_COST * BASE_GAS_PRICE +
      EVM_V2_BILLED_SIZE * BASE_PRICE_PER_BYTE;

    uint expectedUsdQuoteNoDropoff = executionCostInEther * ETHEREUM_GAS_TOKEN_PRICE;

    uint gasDropoffOverheadCostInEther = EVM_GAS_DROPOFF_GAS_COST * BASE_GAS_PRICE;
    uint gasDropoffOverheadCostInUsd = gasDropoffOverheadCostInEther * ETHEREUM_GAS_TOKEN_PRICE;

    uint gasDropoffCostInUsd = ETHEREUM_GAS_TOKEN_PRICE * 1e18;
    uint adjustedGasDropoffCostInUsd =
      _applyAbsoluteFeeAdjustment(gasDropoffCostInUsd, ONE_USD_OVERHEAD_FEE_ADJUSTMENT);

    uint expectedUsdQuoteWithDropoff =
      expectedUsdQuoteNoDropoff + gasDropoffOverheadCostInUsd + adjustedGasDropoffCostInUsd;

    uint usdcQuoteNoDropoff = _quoteRelay(domain, Route.V2Direct, 0, true);
    assertEq(usdcQuoteNoDropoff, expectedUsdQuoteNoDropoff / 1e12);

    uint usdcQuoteWithDropoff = _quoteRelay(domain, Route.V2Direct, MEGA, true);
    assertEq(usdcQuoteWithDropoff, expectedUsdQuoteWithDropoff / 1e12);

    uint gasQuoteNoDropoff = _quoteRelay(domain, Route.V2Direct, 0, false);
    assertEq(gasQuoteNoDropoff, expectedUsdQuoteNoDropoff / ETHEREUM_GAS_TOKEN_PRICE);

    uint gasQuoteWithDropoff = _quoteRelay(domain, Route.V2Direct, MEGA, false);
    assertEq(gasQuoteWithDropoff, expectedUsdQuoteWithDropoff / ETHEREUM_GAS_TOKEN_PRICE);
  }

  function _testQuoteWithBaseParamsAvaxHop(uint32 domain) public view {
    uint expectedUsdQuoteNoDropoff =
      (EVM_V1_GAS_COST * BASE_GAS_PRICE +
       EVM_V1_BILLED_SIZE * BASE_PRICE_PER_BYTE
      ) * ETHEREUM_GAS_TOKEN_PRICE +
      AVAX_HOP_GAS_COST * AVALANCHE_GAS_PRICE * AVALANCHE_GAS_TOKEN_PRICE;

    uint gasDropoffOverheadCostInUsd =
      EVM_GAS_DROPOFF_GAS_COST * BASE_GAS_PRICE * ETHEREUM_GAS_TOKEN_PRICE;

    uint gasDropoffCostInUsd = ETHEREUM_GAS_TOKEN_PRICE * 1e18;
    uint adjustedGasDropoffCostInUsd =
      _applyAbsoluteFeeAdjustment(gasDropoffCostInUsd, ONE_USD_OVERHEAD_FEE_ADJUSTMENT);

    uint expectedUsdQuoteWithDropoff =
      expectedUsdQuoteNoDropoff + gasDropoffOverheadCostInUsd + adjustedGasDropoffCostInUsd;

    uint usdcQuoteNoDropoff = _quoteRelay(domain, Route.AvaxHop, 0, true);
    assertEq(usdcQuoteNoDropoff, expectedUsdQuoteNoDropoff / 1e12);

    uint usdcQuoteWithDropoff = _quoteRelay(domain, Route.AvaxHop, MEGA, true);
    assertEq(usdcQuoteWithDropoff, expectedUsdQuoteWithDropoff / 1e12);

    uint gasQuoteNoDropoff = _quoteRelay(domain, Route.AvaxHop, 0, false);
    assertEq(gasQuoteNoDropoff, expectedUsdQuoteNoDropoff / ETHEREUM_GAS_TOKEN_PRICE);

    uint gasQuoteWithDropoff = _quoteRelay(domain, Route.AvaxHop, MEGA, false);
    assertEq(gasQuoteWithDropoff, expectedUsdQuoteWithDropoff / ETHEREUM_GAS_TOKEN_PRICE);
  }

  function testQuoteBaseV1() public view {
    _testQuoteWithBaseParamsV1(CCTP_DOMAIN_BASE);
  }

  function testQuoteBaseV2() public view {
    _testQuoteWithBaseParamsV2(CCTP_DOMAIN_BASE);
  }

  function testQuoteBaseAvaxHop() public view {
    _testQuoteWithBaseParamsAvaxHop(CCTP_DOMAIN_BASE);
  }

  function testQuoteUnichainV1() public view {
    _testQuoteWithBaseParamsV1(CCTP_DOMAIN_UNICHAIN);
  }

  function testQuoteUnichainV2() public view {
    _testQuoteWithBaseParamsV2(CCTP_DOMAIN_UNICHAIN);
  }

  function testQuoteUnichainAvaxHop() public view {
    _testQuoteWithBaseParamsAvaxHop(CCTP_DOMAIN_UNICHAIN);
  }

  function testQuoteFutureEVM() public {
    vm.prank(owner);
    _cctpRExec(abi.encodePacked(
      OWNER_SET_CHAIN_ID_FOR_DOMAIN_ID, CCTP_DOMAIN_FUTURE_EVM, FUTURE_EVM
    ), 0);
    _setFeeAdjustment(
      v1Adjustments,
      CCTP_DOMAIN_FUTURE_EVM,
      ONE_USD_OVERHEAD_FEE_ADJUSTMENT,
      DISCOUNT_BY_HALF_FEE_ADJUSTMENT
    );
    _setFeeAdjustment(
      v2DirectAdjustments,
      CCTP_DOMAIN_FUTURE_EVM,
      AT_COST_ABSOLUTE_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );
    _setFeeAdjustment(
      avaxHopAdjustments,
      CCTP_DOMAIN_FUTURE_EVM,
      AT_COST_ABSOLUTE_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );
    _setFeeAdjustment(
      gasDropoffAdjustments,
      CCTP_DOMAIN_FUTURE_EVM,
      ONE_USD_OVERHEAD_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );
    uint8 mappingIndex = uint8(CCTP_DOMAIN_FUTURE_EVM / ADJUSTMENTS_PER_SLOT);
    uint8 update_op = UPDATE_FEE_ADJUSTMENTS_ID;
    vm.prank(feeAdjuster);
    _cctpRExec(abi.encodePacked(
      update_op,          uint8(Route.V1), mappingIndex, v1Adjustments[mappingIndex],
      update_op,    uint8(Route.V2Direct), mappingIndex, v2DirectAdjustments[mappingIndex],
      update_op,     uint8(Route.AvaxHop), mappingIndex, avaxHopAdjustments[mappingIndex],
      update_op, 1 + uint8(Route.AvaxHop), mappingIndex, gasDropoffAdjustments[mappingIndex]
    ), 0);
    _testQuoteWithBaseParamsV1(CCTP_DOMAIN_FUTURE_EVM);
    _testQuoteWithBaseParamsV2(CCTP_DOMAIN_FUTURE_EVM);
    _testQuoteWithBaseParamsAvaxHop(CCTP_DOMAIN_FUTURE_EVM);
  }
}
