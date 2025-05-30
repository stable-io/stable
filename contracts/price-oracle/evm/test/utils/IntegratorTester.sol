// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { 
  PriceOracleIntegration, 
  GasDropoff,
  BaseFee
} from "price-oracle/PriceOracleIntegration.sol";

contract IntegratorTester is PriceOracleIntegration {
  constructor(address priceOracle) PriceOracleIntegration(priceOracle) {}

  function getOracleOwner() public view returns (address) {
    return _oracleOwner();
  }

  function getOraclePendingOwner() public view returns (address) {
    return _oraclePendingOwner();
  }

  function getOracleIsAdmin(address admin) public view returns (bool) {
    return _oracleIsAdmin(admin);
  }

  function getOracleAssistant() public view returns (address) {
    return _oracleAssistant();
  }

  function getOracleImplementation() public view returns (address) {
    return _oracleImplementation();
  }

  function getFeeParams(uint16 chainId) public view returns (uint256) {
    return _feeParams(chainId);
  }

  function batchGet(bytes memory data) public view returns (bytes memory) {
    return _oracleBatchGet(data);
  }

  function getEvmTransactionQuote(
    uint16 targetChainId,
    GasDropoff gasDropoff,
    uint32 gas,
    BaseFee baseFee,
    uint32 billedSize
  ) public view returns (uint) {
    return _evmTransactionQuote(targetChainId, gasDropoff, gas, baseFee, billedSize);
  }

  function getSolanaTransactionQuote(
    GasDropoff gasDropoff,
    uint32 computationUnits,
    uint32 totalSizeOfAccounts,
    uint8 signatureCount,
    BaseFee baseFee
  ) public view returns (uint) {
    return _solanaTransactionQuote(gasDropoff, computationUnits, totalSizeOfAccounts, signatureCount, baseFee);
  }

  function getSuiTransactionQuote(
    GasDropoff gasDropoff,
    uint32 computationUnits,
    uint32 storageBytes,
    uint32 rebateBytes,
    BaseFee baseFee
  ) public view returns (uint) {
    return _suiTransactionQuote(gasDropoff, computationUnits, storageBytes, rebateBytes, baseFee);
  }
}
