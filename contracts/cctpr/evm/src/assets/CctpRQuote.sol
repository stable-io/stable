// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

pragma solidity ^0.8.28;

import {WORD_SIZE} from "wormhole-sdk/constants/Common.sol";
import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";
import {
  CHAIN_ID_SOLANA,
  CHAIN_ID_SUI,
  CHAIN_ID_APTOS,
  CHAIN_ID_NOBLE,
  CHAIN_ID_AVALANCHE
} from "wormhole-sdk/constants/Chains.sol";
import {eagerAnd, eagerOr} from "wormhole-sdk/Utils.sol";

import {
  DISPATCHER_PROTOCOL_VERSION0,
  PRICES_QUERIES_ID,
  QUERY_FEE_PARAMS_ID,
  CHAIN_ID_ID
} from "price-oracle/assets/PriceOracleIds.sol";
import "price-oracle/assets/types/ParamLibs.sol";
import "price-oracle/assets/types/EvmFeeParams.sol";
import "price-oracle/assets/types/SolanaFeeParams.sol";
import "price-oracle/assets/types/SuiFeeParams.sol";
import {CctpRBase, Route} from "cctp-xr/assets/CctpRBase.sol";

//constants are declared outside so they can be used in tests

uint constant EVM_GAS_DROPOFF_GAS_COST = 22_000; //estimated using avalanche testnet

//see sample tx:
//https://etherscan.io/tx/0x9020dd97e93263239d65357504fdc2813c126a755cd6304d197b70642d529e2c
// Size of the whole serialized tx in bytes
uint constant EVM_V1_BILLED_SIZE = 664;
uint constant EVM_V1_GAS_COST    = 165_000; //sampled gas usage is mostly between 140k and 163k

//see sample tx:
//https://sepolia.etherscan.io/tx/0xee70b773052207050070e05b8fdf8d0687f5fa64f15153464b19daacf11153d4
// Size of the whole serialized tx in bytes
uint constant EVM_V2_BILLED_SIZE = 793;
uint constant EVM_V2_GAS_COST    = 175_000; //sampled gas usage is between 150k and 171k

//see representative transfer sample tx:
//https://suiscan.xyz/mainnet/tx/13nTP2FKisQvGaZ4HFNLFsThgisaqmsSsPxuvUXGgQmz
// computation fee:   750,000 MIST / 750 MIST/gas unit => 1000 gas units
// storage fee:     1,976,000 MIST / 7600 MIST/byte => 260 bytes
// storage rebate:  1,956,240 MIST / 0.99 = 1,976,000 MIST / 7600 MIST/byte => 260 bytes
// storage diff:       19,760 MIST / 7600 MIST/byte => 2.6 bytes final billing
uint constant SUI_GAS_DROPOFF_COMPUTE_BUDGET = 1000;
uint constant SUI_GAS_DROPOFF_STORAGE_BYTES  = 260;
uint constant SUI_GAS_DROPOFF_STORAGE_REBATE = 260;

//see representative sample tx:
//https://suiscan.xyz/mainnet/tx/8UWX76vcVPmcDrVsb2q62q9pNG5cGWF2heCe3XAEYCNw
// computation fee:  1,500,000 MIST / 750 MIST/gas unit => 2000 gas units
// storage fee:     17,958,800 MIST / 7600 MIST/byte => 2363 bytes
// storage rebate:  14,889,996 MIST / 0.99 = 15,040,400 MIST / 7600 MIST/byte => 1979 bytes
// storage diff:     3,068,804 MIST / 7600 MIST/byte => 403.79 bytes
// so while only 384 bytes are ultimately stored, the final billing is closer to 404 bytes
uint constant SUI_COMPUTE_BUDGET = 2000;
uint constant SUI_STORAGE_BYTES  = 2363;
uint constant SUI_STORAGE_REBATE = 1979;

//Solana gas dropoff cost is entirely negligible (costs 300 CUs)
uint constant SOLANA_COMPUTE_BUDGET  = 200_000; //sampled consumption is 180k+
uint constant SOLANA_STORAGE_BYTES   = 128 + 165; //size of an ATA (account overhead + data)
uint constant SOLANA_SIGNATURE_COUNT = 1;

//fork testing suggests gas costs of ~240k but Avalanche testnet gives 281k:
//https://testnet.snowtrace.io/address/0xE3a43C797B4f43eb0015d182e072809fA3827BF1
//not sure where this discrepancy is coming from
uint constant AVAX_HOP_GAS_COST = 281_200;

abstract contract CctpRQuote is CctpRBase {
  using BytesParsing for bytes;

  bytes4 private constant GET1959_SELECTOR = bytes4(keccak256("get1959()"));
  uint48 private constant PRICE_ORACLE_QUERY_PREFIX = uint48((
    uint(uint32(GET1959_SELECTOR))     << 8) +
    uint(DISPATCHER_PROTOCOL_VERSION0) << 8) +
    PRICES_QUERIES_ID;

  address private immutable _priceOracle;
  uint16  private immutable _chainId;

  constructor(address priceOracle) {
    _priceOracle = priceOracle;
    (_chainId, ) = _invokeOracle(
      abi.encodePacked(PRICE_ORACLE_QUERY_PREFIX, uint8(1), CHAIN_ID_ID)
    ).asUint16MemUnchecked(0);
    require(_chainId != 0, "PriceOracle misconfigured");
  }

  function _quoteInUsdc(
    uint8 destinationDomain,
    Route route,
    uint32 gasDropOffMicroGasToken
  ) internal view returns (uint) { unchecked {
    (uint16 targetChainId, int execAdjustmentAbsoluteUsdc, uint execAdjustmentRelativePercent) =
      _getTargetChainIdAndExecutionAdjustment(destinationDomain, route);

    //short-circuiting to avoid unnecessary oracle call
    if (eagerAnd(execAdjustmentRelativePercent == 0, gasDropOffMicroGasToken == 0)) {
      require(execAdjustmentAbsoluteUsdc >= 0, "misconfigured feeAdjustment");
      return uint(execAdjustmentAbsoluteUsdc);
    }

    uint hopUsd18 = 0;
    uint256 targetFeeParams;
    if (route == Route.AvaxHop) {
      bytes memory feeParams = _invokeOracle(
        abi.encodePacked(
          PRICE_ORACLE_QUERY_PREFIX,
          uint8(2),
          QUERY_FEE_PARAMS_ID,
          targetChainId,
          QUERY_FEE_PARAMS_ID,
          CHAIN_ID_AVALANCHE
        )
      );

      uint offset;
      uint256 avalancheFeeParams;
      (targetFeeParams, offset) = feeParams.asUint256MemUnchecked(0);
      (avalancheFeeParams,    ) = feeParams.asUint256MemUnchecked(offset);

      hopUsd18 = _calcHopUsd18(avalancheFeeParams);
    }
    else
      (targetFeeParams, ) = _invokeOracle(
        abi.encodePacked(PRICE_ORACLE_QUERY_PREFIX, uint8(1), QUERY_FEE_PARAMS_ID, targetChainId)
      ).asUint256MemUnchecked(0);

    uint usd18Quote = _quoteInUsd18(
      route,
      hopUsd18,
      targetChainId,
      targetFeeParams,
      gasDropOffMicroGasToken,
      execAdjustmentAbsoluteUsdc,
      execAdjustmentRelativePercent,
      destinationDomain
    );

    return usd18Quote / 1e12;
  }}

  function _quoteInGasToken(
    uint8 destinationDomain,
    Route route,
    uint32 gasDropOffMicroGasToken
  ) internal view returns (uint) { unchecked {
    (uint16 targetChainId, int execAdjustmentAbsoluteUsdc, uint execAdjustmentRelativePercent) =
      _getTargetChainIdAndExecutionAdjustment(destinationDomain, route);

    uint256 localChainFeeParams;
    uint usd18Quote;
    if (eagerAnd(execAdjustmentRelativePercent == 0, gasDropOffMicroGasToken == 0)) {
      require(execAdjustmentAbsoluteUsdc >= 0, "misconfigured feeAdjustment");
      (localChainFeeParams, ) = _invokeOracle(
        abi.encodePacked(
          PRICE_ORACLE_QUERY_PREFIX,
          uint8(1),
          QUERY_FEE_PARAMS_ID,
          _chainId
        )
      ).asUint256MemUnchecked(0);
      usd18Quote = uint(execAdjustmentAbsoluteUsdc) * 1e12;
    }
    else {
      uint hopUsd18 = 0;
      uint256 targetFeeParams;
      if (route == Route.AvaxHop) {
        bytes memory feeParams = _invokeOracle(
          abi.encodePacked(
            PRICE_ORACLE_QUERY_PREFIX,
            uint8(3),
            QUERY_FEE_PARAMS_ID,
            targetChainId,
            QUERY_FEE_PARAMS_ID,
            _chainId,
            QUERY_FEE_PARAMS_ID,
            CHAIN_ID_AVALANCHE
          )
        );

        uint offset;
        uint256 avalancheFeeParams;
        (targetFeeParams,     offset) = feeParams.asUint256MemUnchecked(0);
        (localChainFeeParams, offset) = feeParams.asUint256MemUnchecked(offset);
        (avalancheFeeParams,        ) = feeParams.asUint256MemUnchecked(offset);

        hopUsd18 = _calcHopUsd18(avalancheFeeParams);
      }
      else {
        bytes memory feeParams = _invokeOracle(
          abi.encodePacked(
            PRICE_ORACLE_QUERY_PREFIX,
            uint8(2),
            QUERY_FEE_PARAMS_ID,
            targetChainId,
            QUERY_FEE_PARAMS_ID,
            _chainId
          )
        );

        uint offset;
        (targetFeeParams, offset) = feeParams.asUint256MemUnchecked(0);
        (localChainFeeParams,   ) = feeParams.asUint256MemUnchecked(offset);
      }

      usd18Quote = _quoteInUsd18(
        route,
        hopUsd18,
        targetChainId,
        targetFeeParams,
        gasDropOffMicroGasToken,
        execAdjustmentAbsoluteUsdc,
        execAdjustmentRelativePercent,
        destinationDomain
      );
    }

    return usd18Quote * 1e18 / EvmFeeParams.wrap(localChainFeeParams).gasTokenPrice().from();
  }}

  // -- private --

  function _invokeOracle(bytes memory encodedCall) private view returns (bytes memory response) {
    (bool success, bytes memory result) = address(_priceOracle).staticcall(encodedCall);
    require(success, "PriceOracle call failed");

    //manual impl of abi.decode(result, (bytes))
    (uint length, uint offset) = result.asUint256MemUnchecked(WORD_SIZE);
    (response, ) = result.sliceMemUnchecked(offset, length);
  }

  function _quoteInUsd18(
    Route route,
    uint hopUsd18,
    uint16 targetChainId,
    uint256 targetFeeParams,
    uint32 gasDropOffMicroGasToken,
    int execAdjustmentAbsoluteUsdc,
    uint execAdjustmentRelativePercent,
    uint8 destinationDomain
  ) private view returns (uint) { unchecked {
    function(uint16,uint256,bool) internal pure returns (uint,uint) func =
      route == Route.V2Direct
      ? _v2ExecutionCostAndGasTokenPrice
      : _v1ExecutionCostAndGasTokenPrice;

    (uint targetExecutionCost, uint targetGasTokenPrice) =
      func(targetChainId, targetFeeParams, gasDropOffMicroGasToken != 0);

    //adjust execution cost
    uint unadjustedExecutionCostUsd18 = hopUsd18 + targetExecutionCost * targetGasTokenPrice / 1e18;
    uint finalExecutionCostUsd18 = _applyFeeAdjustment(
      unadjustedExecutionCostUsd18,
      execAdjustmentAbsoluteUsdc,
      execAdjustmentRelativePercent
    );

    uint finalGasDropoffUsd18 = 0;
    if (gasDropOffMicroGasToken != 0) {
      //adjust gas dropoff
      uint unadjustedGasDropoffUsd18 =
        GasDropoff.wrap(gasDropOffMicroGasToken).from() * targetGasTokenPrice / 1e18;
      (int gasDropoffAbsoluteUsdc, uint gasDropoffRelativePercent) =
        _getGasDropoffAdjustment(destinationDomain);
      finalGasDropoffUsd18 = _applyFeeAdjustment(
        unadjustedGasDropoffUsd18,
        gasDropoffAbsoluteUsdc,
        gasDropoffRelativePercent
      );
    }

    //total quote
    return finalExecutionCostUsd18 + finalGasDropoffUsd18;
  }}

  function _v1ExecutionCostAndGasTokenPrice(
    uint16 targetChainId,
    uint256 targetFeeParams,
    bool gasDropoffRequested
  ) private pure returns (uint targetExecutionCost, uint targetGasTokenPrice) { unchecked {
    if (targetChainId == CHAIN_ID_SOLANA) {
      //gas dropoff costs are negligible and hence ignored on Solana
      SolanaFeeParams solanaFeeParams = SolanaFeeParams.wrap(targetFeeParams);
      targetExecutionCost =
        SOLANA_COMPUTE_BUDGET * solanaFeeParams.computationPrice().from()
        + SOLANA_STORAGE_BYTES * solanaFeeParams.pricePerAccountByte().from()
        + SOLANA_SIGNATURE_COUNT * solanaFeeParams.signaturePrice().from();
      targetGasTokenPrice = solanaFeeParams.gasTokenPrice().from();
    }
    else if (targetChainId == CHAIN_ID_SUI) {
      SuiFeeParams suiFeeParams = SuiFeeParams.wrap(targetFeeParams);
      uint computeCost = SUI_COMPUTE_BUDGET;
      uint storageBytes = SUI_STORAGE_BYTES;
      uint storageRebate = SUI_STORAGE_REBATE;
      if (gasDropoffRequested) {
        computeCost += SUI_GAS_DROPOFF_COMPUTE_BUDGET;
        storageBytes += SUI_GAS_DROPOFF_STORAGE_BYTES;
        storageRebate += SUI_GAS_DROPOFF_STORAGE_REBATE;
      }
      uint storagePrice = suiFeeParams.storagePrice().from();
      targetExecutionCost =
        computeCost * suiFeeParams.computationPrice().from()
        + storageBytes * storagePrice
        - (storageRebate * storagePrice *
           suiFeeParams.storageRebate().from() / StorageRebateLib.MAX
          );
      targetGasTokenPrice = suiFeeParams.gasTokenPrice().from();
    }
    else if (eagerOr(targetChainId == CHAIN_ID_APTOS, targetChainId == CHAIN_ID_NOBLE))
      revert("Aptos/Noble only supports flat fee and no gas dropoff");
    else {
      EvmFeeParams evmFeeParams = EvmFeeParams.wrap(targetFeeParams);
      uint gasCost = EVM_V1_GAS_COST;
      if (gasDropoffRequested)
        gasCost += EVM_GAS_DROPOFF_GAS_COST;

      targetExecutionCost =
        gasCost * evmFeeParams.gasPrice().from()
        + EVM_V1_BILLED_SIZE * evmFeeParams.pricePerTxByte().from();
      targetGasTokenPrice = evmFeeParams.gasTokenPrice().from();
    }
  }}

  function _v2ExecutionCostAndGasTokenPrice(
    uint16 targetChainId,
    uint256 targetFeeParams,
    bool gasDropoffRequested
  ) private pure returns (uint targetExecutionCost, uint targetGasTokenPrice) { unchecked {
    bool isSolana = targetChainId == CHAIN_ID_SOLANA;
    bool isSui = targetChainId == CHAIN_ID_SUI;
    bool isAptos = targetChainId == CHAIN_ID_APTOS;
    require(!eagerOr(eagerOr(isSolana, isSui), isAptos), "v2Direct only supports EVM");

    EvmFeeParams evmFeeParams = EvmFeeParams.wrap(targetFeeParams);
    uint gasCost = EVM_V2_GAS_COST;
    if (gasDropoffRequested)
      gasCost += EVM_GAS_DROPOFF_GAS_COST;

    targetExecutionCost =
      gasCost * evmFeeParams.gasPrice().from()
      + EVM_V2_BILLED_SIZE * evmFeeParams.pricePerTxByte().from();
    targetGasTokenPrice = evmFeeParams.gasTokenPrice().from();
  }}

  function _calcHopUsd18(uint256 avalancheFeeParams) private pure returns (uint) { unchecked {
    EvmFeeParams feeParams = EvmFeeParams.wrap(avalancheFeeParams);
    return AVAX_HOP_GAS_COST *
      feeParams.gasPrice().from() * feeParams.gasTokenPrice().from() / 1e18;
  }}

  function _applyFeeAdjustment(
    uint usd18,
    int adjustmentAbsoluteUsdc,
    uint adjustmentRelativePercent
  ) private pure returns (uint) { unchecked {
    uint scaledUsd18 = usd18 * adjustmentRelativePercent / FEE_ADJUSTMENT_RELATIVE_DENOMINATOR;
    int signedUsd18 = int(scaledUsd18) + adjustmentAbsoluteUsdc * 1e12;
    return signedUsd18 < 0 ? 0 : uint(signedUsd18);
  }}
}
