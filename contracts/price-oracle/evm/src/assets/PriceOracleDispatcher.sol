// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { Upgrade } from "wormhole-sdk/components/dispatcher/Upgrade.sol";
import { BytesParsing } from "wormhole-sdk/libraries/BytesParsing.sol";
import { RawDispatcher } from "wormhole-sdk/RawDispatcher.sol";
import "wormhole-sdk/components/dispatcher/Ids.sol";

import { PriceOraclePrices } from "./PriceOraclePrices.sol";
import "./PriceOracleIds.sol";

error UnsupportedVersion(uint8 version);
error InvalidCommand(uint8 command, uint offset);

abstract contract PriceOracleDispatcher is RawDispatcher, PriceOraclePrices, Upgrade {
  using BytesParsing for bytes;

  function _exec(bytes calldata data) internal override returns (bytes memory) {
    uint offset = 0;
    uint8 version;
    (version, offset) = data.asUint8CdUnchecked(offset);

    if (version != DISPATCHER_PROTOCOL_VERSION0)
      revert UnsupportedVersion(version);

    while (offset < data.length) {
      uint8 command;
      (command, offset) = data.asUint8CdUnchecked(offset);

      if (command == PRICES_ID)
        offset = _batchPriceCommands(data, offset);
      else if (command == UPDATE_ASSISTANT_ID)
        offset = _setAssistant(data, offset);
      else {
        bool dispatched;
        (dispatched, offset) = dispatchExecAccessControl(data, offset, command);
        if (!dispatched)
          (dispatched, offset) = dispatchExecUpgrade(data, offset, command);
        if (!dispatched)
          revert InvalidCommand(command, offset - 1);
      }
    }

    BytesParsing.checkLength(offset, data.length);

    return new bytes(0);
  }

  function _get(bytes calldata data) internal view override returns (bytes memory) {
    bytes memory ret;
    uint offset = 0;
    uint8 version;
    (version, offset) = data.asUint8CdUnchecked(offset);

    if (version != DISPATCHER_PROTOCOL_VERSION0)
      revert UnsupportedVersion(version);
      
    while (offset < data.length) {
      uint8 query;
      (query, offset) = data.asUint8CdUnchecked(offset);
      
      bytes memory result;
      if (query == PRICES_QUERIES_ID)
        (result, offset) = _batchPriceQueries(data, offset);
      else if (query == ASSISTANT_ID)
        result = abi.encodePacked(_getAssistant());
      else {
        bool dispatched;
        (dispatched, result, offset) = dispatchQueryAccessControl(data, offset, query);
        if (!dispatched)
          (dispatched, result, offset) = dispatchQueryUpgrade(data, offset, query);
        if (!dispatched)
          revert InvalidCommand(query, offset - 1);
      }

      ret = abi.encodePacked(ret, result);
    }

    BytesParsing.checkLength(offset, data.length);
    
    return ret;
  }
}