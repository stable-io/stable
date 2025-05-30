// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

import { NotAuthorized } from "wormhole-sdk/components/dispatcher/AccessControl.sol";
import { BytesParsing } from "wormhole-sdk/libraries/BytesParsing.sol";
import { IdempotentUpgrade } from "wormhole-sdk/proxy/ProxyBase.sol";
import "wormhole-sdk/components/dispatcher/Ids.sol";
import { PriceOracle } from "price-oracle/PriceOracle.sol";
import "price-oracle/assets/PriceOracleIds.sol";

import { UpgradeTester } from "./utils/UpgradeTester.sol";
import { PriceOracleTestBase } from "./utils/OTBase.sol";

contract DispatcherComponentsTest is PriceOracleTestBase {
  using BytesParsing for bytes;

  function testContractUpgrade() public {
    UpgradeTester upgradeTester = new UpgradeTester();

    bytes memory response = invokeStaticOracle(
      abi.encodePacked(
        IMPLEMENTATION_ID
      )
    );
    assertEq(response.length, 20);
    (address implementation,) = response.asAddressMemUnchecked(0);

    vm.expectRevert(NotAuthorized.selector);
    invokeOracle(
      abi.encodePacked(
        UPGRADE_CONTRACT_ID,
        address(upgradeTester)
      )
    );

    vm.startPrank(admin);
    vm.expectRevert(NotAuthorized.selector);
    invokeOracle(
      abi.encodePacked(
        UPGRADE_CONTRACT_ID,
        address(upgradeTester)
      )
    );

    vm.startPrank(owner);
    invokeOracle(
      abi.encodePacked(
        UPGRADE_CONTRACT_ID,
        address(upgradeTester)
      )
    );

    vm.expectRevert(IdempotentUpgrade.selector);
    UpgradeTester(address(priceOracle)).upgradeTo(address(upgradeTester), new bytes(0));

    UpgradeTester(address(priceOracle)).upgradeTo(implementation, new bytes(0));

    response = invokeStaticOracle(
      abi.encodePacked(
        IMPLEMENTATION_ID
      )
    );
    assertEq(response.length, 20);
    (address restoredImplementation,) = response.asAddressMemUnchecked(0);
    assertEq(restoredImplementation, implementation);
  }

  function testOwnershipTransfer(address newOwner) public {
    vm.assume(newOwner != owner);
    uint8 commandCount = 1;

    vm.prank(owner);
    invokeOracle(
      abi.encodePacked(
        ACCESS_CONTROL_ID,
        commandCount,
        PROPOSE_OWNERSHIP_TRANSFER_ID,
        newOwner
      )
    );

    commandCount = 2;
    bytes memory getRes = invokeStaticOracle(
      abi.encodePacked(
        ACCESS_CONTROL_QUERIES_ID,
        commandCount,
        OWNER_ID,
        PENDING_OWNER_ID
      )
    );
    (address owner_,        ) = getRes.asAddressMemUnchecked(0);
    (address pendingOwner_, ) = getRes.asAddressMemUnchecked(20);

    assertEq(owner_,        owner);
    assertEq(pendingOwner_, newOwner);

    vm.prank(owner);
    vm.expectRevert(NotAuthorized.selector);
    invokeOracle(
      abi.encodePacked(
        ACQUIRE_OWNERSHIP_ID
      )
    );

    vm.prank(newOwner);
    invokeOracle(
      abi.encodePacked(
        ACQUIRE_OWNERSHIP_ID
      )
    );

    getRes = invokeStaticOracle(
      abi.encodePacked(
        ACCESS_CONTROL_QUERIES_ID,
        commandCount,
        OWNER_ID,
        PENDING_OWNER_ID
      )
    );
    (owner_,        ) = getRes.asAddressMemUnchecked(0);
    (pendingOwner_, ) = getRes.asAddressMemUnchecked(20);

    assertEq(owner_, newOwner);
    assertEq(pendingOwner_, address(0));
  }
}
