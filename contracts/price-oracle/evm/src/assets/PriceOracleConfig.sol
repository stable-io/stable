// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { ProxyBase } from "wormhole-sdk/proxy/ProxyBase.sol";
import { BytesParsing } from "wormhole-sdk/libraries/BytesParsing.sol";
import { 
  AccessControl, 
  NotAuthorized,
  AccessControlState,
  accessControlState,
  senderAtLeastAdmin
} from "wormhole-sdk/components/dispatcher/AccessControl.sol";
import "./PriceOracleIds.sol";

//rationale for different roles (owner, admin, assistant):
// * refer to AccessControl component for owner and admin roles.
// * assistant is a hot wallet that is used to update fee parameters and the like.

struct ConfigState {
  address assistant;
}

// keccak256("ConfigState") - 1
bytes32 constant CONFIG_STORAGE_SLOT =
  0xa1f28b22c196686da956abee6956ab0f6625f5b97ed2295735931c66c7c7b5e8;

function configState() pure returns (ConfigState storage state) {
  assembly ("memory-safe") { state.slot := CONFIG_STORAGE_SLOT }
}

event AssistantUpdated(address oldAddress, address newAddress, uint256 timestamp);

abstract contract PriceOracleConfig is AccessControl {
  using BytesParsing for bytes;

  // ---- construction ----

  function _configConstruction(
    address assistant
  ) internal {
    configState().assistant = assistant;
  }

  // ---- internals ----

  function _setAssistant(    
    bytes calldata commands,
    uint offset
  ) internal returns (uint) {
    senderAtLeastAdmin();
    
    ConfigState storage state = configState();
    address oldAssistant = state.assistant;
    address newAssistant;
    (newAssistant, offset) = commands.asAddressCdUnchecked(offset);
    state.assistant = newAssistant;
    emit AssistantUpdated(oldAssistant, newAssistant, block.timestamp);
    return offset;
  }

  function _getAssistant() internal view returns (address) {
    return configState().assistant;
  }
}
