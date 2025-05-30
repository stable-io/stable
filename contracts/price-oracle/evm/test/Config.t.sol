// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { NotAuthorized } from "wormhole-sdk/components/dispatcher/AccessControl.sol";
import { BytesParsing } from "wormhole-sdk/libraries/BytesParsing.sol";
import "wormhole-sdk/components/dispatcher/Ids.sol";
import { PriceOracle } from "price-oracle/PriceOracle.sol";
import "price-oracle/assets/PriceOracleIds.sol";

import { PriceOracleTestBase } from "./utils/OTBase.sol";

contract ConfigTest is PriceOracleTestBase {
  using BytesParsing for bytes;

  function testUpdateAssistant(address newAssistant) public {
    vm.expectRevert(NotAuthorized.selector);
    invokeOracle(
      abi.encodePacked(
        UPDATE_ASSISTANT_ID,
        newAssistant
      )
    );

    vm.prank(admin);
    invokeOracle(
      abi.encodePacked(
        UPDATE_ASSISTANT_ID,
        newAssistant
      )
    );

    (address newAssistant_, ) = invokeStaticOracle(
      abi.encodePacked(
        ASSISTANT_ID
      )
    ).asAddressMemUnchecked(0);

    assertEq(newAssistant_, newAssistant);
  }

  function testBatchGovernance(
    address newOwner,
    address newAdmin,
    address newAssistant
  ) public {
    uint8 commandCount = 2;

    vm.startPrank(owner);
    invokeOracle(
      abi.encodePacked(
        ACCESS_CONTROL_ID,
        commandCount,
        ADD_ADMIN_ID, newAdmin,
        PROPOSE_OWNERSHIP_TRANSFER_ID, newOwner,
        UPDATE_ASSISTANT_ID, newAssistant
      )
    );

    bytes memory getRes = invokeStaticOracle(
      abi.encodePacked(
        ACCESS_CONTROL_QUERIES_ID,
        commandCount,
        PENDING_OWNER_ID,
        IS_ADMIN_ID,
        newAdmin,
        ASSISTANT_ID
      )
    );

    uint offset = 0;
    address pendingOwner_;
    bool isAdmin;
    address assistant_;

    (pendingOwner_, offset) = getRes.asAddressMemUnchecked(offset);
    (isAdmin, offset) = getRes.asBoolMemUnchecked(offset);
    (assistant_, offset) = getRes.asAddressMemUnchecked(offset);

    assertEq(pendingOwner_, newOwner);
    assertEq(isAdmin, true);
    assertEq(assistant_, newAssistant);
  }
}
