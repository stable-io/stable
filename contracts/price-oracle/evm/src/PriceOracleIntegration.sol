// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { BytesParsing } from "wormhole-sdk/libraries/BytesParsing.sol";
import { RawDispatcher} from "wormhole-sdk/RawDispatcher.sol";
import { reRevert } from "wormhole-sdk/Utils.sol";
import "wormhole-sdk/components/dispatcher/Ids.sol";

import { GasDropoff, BaseFee } from "./assets/types/ParamLibs.sol";
import { IPriceOracle } from "./IPriceOracle.sol";
import "./assets/PriceOracleIds.sol";

error InvalidAddress();

abstract contract PriceOracleIntegration {
  using BytesParsing for bytes;

  address internal immutable _priceOracle;

  constructor(address priceOracle) {
    if (priceOracle == address(0))
      revert InvalidAddress();

    _priceOracle = priceOracle;
  }

  // -----------------------------------------------------------------------------------------------
  // ------------------------------------------- Quotes --------------------------------------------
  // -----------------------------------------------------------------------------------------------

  /**
   * @notice Get the quote for an EVM transaction.
   * @dev See evmTransactionQuote in PriceOraclePrices for more details.
   */
  function _evmTransactionQuote(
    uint16 targetChainId,
    GasDropoff gasDropoff,
    uint32 gas,
    BaseFee baseFee,
    uint32 billedBytes
  ) internal view returns (uint quote) {
    uint8 subcommandCount = 1;

    (quote,) = _invokeOracle(
      abi.encodePacked(
        IPriceOracle.get1959.selector,
        DISPATCHER_PROTOCOL_VERSION0,
        PRICES_QUERIES_ID,
        subcommandCount,
        EVM_TX_QUOTE_ID,
        targetChainId,
        gasDropoff,
        gas,
        baseFee,
        billedBytes
      )
    ).asUint256MemUnchecked(0);
  }

  /**
   * @notice Get the quote for a Solana transaction.
   * @dev See solanaTransactionQuote in PriceOraclePrices for more details.
   */
  function _solanaTransactionQuote(
    GasDropoff gasDropoff,
    uint32 computationUnits,
    uint32 totalSizeOfAccounts,
    uint8 signatureCount,
    BaseFee baseFee
  ) internal view returns (uint quote) {
    uint8 subcommandCount = 1;

    (quote,) = _invokeOracle(
      abi.encodePacked(
        IPriceOracle.get1959.selector,
        DISPATCHER_PROTOCOL_VERSION0,
        PRICES_QUERIES_ID,
        subcommandCount,
        SOLANA_TX_QUOTE_ID,
        gasDropoff,
        computationUnits,
        totalSizeOfAccounts,
        signatureCount,
        baseFee
      )
    ).asUint256MemUnchecked(0);
  }

  /**
   * @notice Get the quote for a Sui transaction.
   * @dev See suiTransactionQuote in PriceOraclePrices for more details.
   */
  function _suiTransactionQuote(
    GasDropoff gasDropoff,
    uint32 computationUnits,
    uint32 storageBytes,
    uint32 rebateBytes,
    BaseFee baseFee
  ) internal view returns (uint quote) {
    uint8 subcommandCount = 1;

    (quote,) = _invokeOracle(
      abi.encodePacked(
        IPriceOracle.get1959.selector,
        DISPATCHER_PROTOCOL_VERSION0,
        PRICES_QUERIES_ID,
        subcommandCount,
        SUI_TX_QUOTE_ID,
        gasDropoff,
        computationUnits,
        storageBytes,
        rebateBytes,
        baseFee
      )
    ).asUint256MemUnchecked(0);
  }

  // -----------------------------------------------------------------------------------------------
  // --------------------------------------- Getters & Utils ---------------------------------------
  // -----------------------------------------------------------------------------------------------

  // ---- Mutable Getters ----

  function _oracleOwner() internal view returns (address) {
    uint8 subcommandCount = 1;
    return _getAddr(
      abi.encodePacked(
        ACCESS_CONTROL_QUERIES_ID,
        subcommandCount,
        OWNER_ID
      )
    );
  }

  function _oraclePendingOwner() internal view returns (address) {
    uint8 subcommandCount = 1;
    return _getAddr(
      abi.encodePacked(
        ACCESS_CONTROL_QUERIES_ID,
        subcommandCount,
        PENDING_OWNER_ID
      )
    );
  }

  function _oracleAssistant() internal view returns (address) {
    return _getAddr(
      abi.encodePacked(
        ASSISTANT_ID
      )
    );
  }

  function _oracleImplementation() internal view returns (address) {
    return _getAddr(
      abi.encodePacked(     
        IMPLEMENTATION_ID
      )
    );
  }

  function _oracleIsAdmin(address admin) internal view returns (bool isAdmin) {
    uint8 subcommandCount = 1;
    (isAdmin, ) = _invokeOracle(
      abi.encodePacked(
        IPriceOracle.get1959.selector,
        DISPATCHER_PROTOCOL_VERSION0,
        ACCESS_CONTROL_QUERIES_ID,
        subcommandCount,
        IS_ADMIN_ID,
        admin
      )
    ).asBoolMemUnchecked(0);
  }

  function _feeParams(uint16 chainId) internal view returns (uint256 data) {
    uint8 subcommandCount = 1;
    (data, ) = _invokeOracle(
      abi.encodePacked(
        IPriceOracle.get1959.selector,
        DISPATCHER_PROTOCOL_VERSION0,
        PRICES_QUERIES_ID,
        subcommandCount,
        QUERY_FEE_PARAMS_ID,
        uint16(chainId)
      )
    ).asUint256MemUnchecked(0);
  }

  function _oracleBatchGet(bytes memory data) internal view returns (bytes memory) {
    return _invokeOracle(
      abi.encodePacked(
        IPriceOracle.get1959.selector,
        DISPATCHER_PROTOCOL_VERSION0,
        data
      )
    );
  }

  // ---- Immutable Getters ----

  function _oracleChainId() internal virtual returns (uint16 chainId) {
    uint8 subcommandCount = 1;

    (chainId, ) = _invokeOracle(
      abi.encodePacked(
        IPriceOracle.get1959.selector,
        DISPATCHER_PROTOCOL_VERSION0,
        PRICES_QUERIES_ID,
        subcommandCount,
        CHAIN_ID_ID
      )
    ).asUint16MemUnchecked(0);
  }

  // -----------------------------------------------------------------------------------------------
  // ------------------------------------------- Private -------------------------------------------
  // -----------------------------------------------------------------------------------------------

  function _invokeOracle(bytes memory encode) private view returns (bytes memory data) {
    (bool success, bytes memory result) = address(_priceOracle).staticcall(encode);
    if (!success)
      reRevert(result);

    (uint length,) = result.asUint256MemUnchecked(32);
    (data,) = result.sliceMemUnchecked(64, length);
  }

  function _getAddr(bytes memory query) private view returns (address addr) {
    (addr, ) = _invokeOracle(
      abi.encodePacked(
        IPriceOracle.get1959.selector,
        DISPATCHER_PROTOCOL_VERSION0,
        query
      )
    ).asAddressMemUnchecked(0);
  }
}