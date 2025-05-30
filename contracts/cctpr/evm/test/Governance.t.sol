// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.28;

import "./CctpRTestBase.t.sol";

struct ContractStorage {
  address feeRecipient;
  address offChainQuoter;
  address owner;
  address pendingOwner;
  address feeAdjuster;
}

struct FeeAdjustmentsForSlot {
  uint256 v1Adjustments;
  uint256 v2DirectAdjustments;
  uint256 avaxHopAdjustments;
  uint256 gasDropoffAdjustments;
}

contract Governance is CctpRTestBase {
  address constant TEST_ADDRESS = address(0x031337);

  function _loadUintSlot(uint256 slot) internal view returns (uint256) {
    bytes32 raw = vm.load(address(cctpR), bytes32(uint256(slot)));
    return uint256(raw);
  }

  function _loadAddressSlot(uint256 slot) internal view returns (address) {
    return address(uint160(_loadUintSlot(slot)));
  }

  function _slotOfMapping(uint256 mappingSlot, uint256 key) internal pure returns (uint256) {
    return uint256(keccak256(abi.encode(key, mappingSlot)));
  }

  function _loadSlotOfMapping(uint256 mappingSlot, uint256 key) internal view returns (uint256) {
    return _loadUintSlot(_slotOfMapping(mappingSlot, key));
  }

  function _loadContractStorage() internal view returns (ContractStorage memory) {
    return ContractStorage(
      _loadAddressSlot(5),
      _loadAddressSlot(6),
      _loadAddressSlot(7),
      _loadAddressSlot(8),
      _loadAddressSlot(9)
    );
  }

  function _loadFeeAdjustmentsForSlot(
    uint256 mappingIndex
  ) internal view returns (FeeAdjustmentsForSlot memory) {
    return FeeAdjustmentsForSlot(
      _loadSlotOfMapping(1, mappingIndex),
      _loadSlotOfMapping(2, mappingIndex),
      _loadSlotOfMapping(3, mappingIndex),
      _loadSlotOfMapping(4, mappingIndex)
    );
  }

  function _loadExtraChainIdsSlot(
    uint256 mappingIndex
  ) internal view returns (uint256) {
    return _loadSlotOfMapping(0, mappingIndex);
  }

  function testStorageLayout() public view {
    ContractStorage memory contractStorage = _loadContractStorage();
    for (uint mappingIndex = 0; mappingIndex < 2; ++mappingIndex) {
      FeeAdjustmentsForSlot memory feeAdjustments = _loadFeeAdjustmentsForSlot(mappingIndex);
      assertEq(feeAdjustments.v1Adjustments,         v1Adjustments[mappingIndex]        );
      assertEq(feeAdjustments.v2DirectAdjustments,   v2DirectAdjustments[mappingIndex]  );
      assertEq(feeAdjustments.avaxHopAdjustments,    avaxHopAdjustments[mappingIndex]   );
      assertEq(feeAdjustments.gasDropoffAdjustments, gasDropoffAdjustments[mappingIndex]);
    }
    assertEq(contractStorage.feeRecipient,   feeRecipient  );
    assertEq(contractStorage.offChainQuoter, offChainQuoter);
    assertEq(contractStorage.owner,          owner         );
    assertEq(contractStorage.pendingOwner,   address(0)    );
    assertEq(contractStorage.feeAdjuster,    feeAdjuster   );
  }

  function testProposeOwnershipTransfer() public {
    vm.prank(owner);
    _cctpRExec(abi.encodePacked(OWNER_PROPOSE_OWNERSHIP_TRANSFER_ID, TEST_ADDRESS), 0);
    ContractStorage memory contractStorage = _loadContractStorage();
    assertEq(contractStorage.owner,        owner       );
    assertEq(contractStorage.pendingOwner, TEST_ADDRESS);
  }

  function testAcceptOwnershipTransfer() public {
    vm.prank(owner);
    _cctpRExec(abi.encodePacked(OWNER_PROPOSE_OWNERSHIP_TRANSFER_ID, TEST_ADDRESS), 0);
    vm.prank(TEST_ADDRESS);
    _cctpRExec(abi.encodePacked(OWNER_ACCEPT_OWNERSHIP_TRANSFER_ID), 0);
    ContractStorage memory contractStorage = _loadContractStorage();
    assertEq(contractStorage.owner,        TEST_ADDRESS);
    assertEq(contractStorage.pendingOwner, address(0));
  }

  function testCancelOwnershipTransfer() public {
    vm.prank(owner);
    _cctpRExec(abi.encodePacked(OWNER_PROPOSE_OWNERSHIP_TRANSFER_ID, TEST_ADDRESS), 0);
    vm.prank(owner);
    _cctpRExec(abi.encodePacked(OWNER_CANCEL_OWNERSHIP_TRANSFER_ID), 0);
    ContractStorage memory contractStorage = _loadContractStorage();
    assertEq(contractStorage.owner,        owner);
    assertEq(contractStorage.pendingOwner, address(0));
  }

  function testUpdateFeeRecipient() public {
    vm.prank(owner);
    _cctpRExec(abi.encodePacked(OWNER_UPDATE_FEE_RECIPIENT_ID, TEST_ADDRESS), 0);
    assertEq(_loadContractStorage().feeRecipient, TEST_ADDRESS);
  }

  function testUpdateFeeAdjuster() public {
    vm.prank(owner);
    _cctpRExec(abi.encodePacked(OWNER_UPDATE_FEE_ADJUSTER_ID, TEST_ADDRESS), 0);
    assertEq(_loadContractStorage().feeAdjuster, TEST_ADDRESS);
  }

  function testUpdateOffchainQuoter() public {
    vm.prank(owner);
    _cctpRExec(abi.encodePacked(OWNER_UPDATE_OFFCHAIN_QUOTER_ID, TEST_ADDRESS), 0);
    assertEq(_loadContractStorage().offChainQuoter, TEST_ADDRESS);
  }

  function _setAndCheckFeeAdjustments(uint value) private {
    for (uint8 mappingIndex = 0; mappingIndex < 3; ++mappingIndex) {
      _cctpRExec(
        abi.encodePacked(
          UPDATE_FEE_ADJUSTMENTS_ID, uint8(0), mappingIndex, uint256(value),
          UPDATE_FEE_ADJUSTMENTS_ID, uint8(1), mappingIndex, uint256(value),
          UPDATE_FEE_ADJUSTMENTS_ID, uint8(2), mappingIndex, uint256(value),
          UPDATE_FEE_ADJUSTMENTS_ID, uint8(3), mappingIndex, uint256(value)
        ),
        0
      );
    }
    for (uint mappingIndex = 0; mappingIndex < 3; ++mappingIndex) {
      FeeAdjustmentsForSlot memory feeAdjustments = _loadFeeAdjustmentsForSlot(mappingIndex);
      assertEq(feeAdjustments.v1Adjustments,         uint256(value));
      assertEq(feeAdjustments.v2DirectAdjustments,   uint256(value));
      assertEq(feeAdjustments.avaxHopAdjustments,    uint256(value));
      assertEq(feeAdjustments.gasDropoffAdjustments, uint256(value));
    }
  }

  function testUpdateFeeAdjustments() public {
    vm.startPrank(owner);
    _setAndCheckFeeAdjustments(31337);

    vm.startPrank(feeAdjuster);
    _setAndCheckFeeAdjustments(1337);

    vm.stopPrank();
    vm.expectRevert("Not authorized");
    _cctpRExec(
      abi.encodePacked(
        UPDATE_FEE_ADJUSTMENTS_ID, uint8(0), uint8(0), uint256(0)
      ), 0
    );
  }

  function testSetChainIdForDomain() public {
    uint8 SET_CHAIN = OWNER_SET_CHAIN_ID_FOR_DOMAIN_ID;
    vm.prank(owner);
    vm.expectRevert("Chain ID was added at deployment");
    _cctpRExec(abi.encodePacked(SET_CHAIN, CCTP_DOMAIN_ETHEREUM, FUTURE_EVM), 0);
    vm.prank(owner);
    vm.expectRevert("Chain ID was added at deployment");
    _cctpRExec(abi.encodePacked(SET_CHAIN, CCTP_DOMAIN_UNICHAIN, FUTURE_EVM), 0);
    vm.prank(feeAdjuster);
    vm.expectRevert("Not authorized");
    _cctpRExec(abi.encodePacked(SET_CHAIN, CCTP_DOMAIN_FUTURE_EVM, FUTURE_EVM), 0);

    vm.startPrank(owner);
    for (uint8 i = 0; i < CHAIN_IDS_PER_SLOT + 8; ++i) {
      _cctpRExec(abi.encodePacked(SET_CHAIN, CCTP_DOMAIN_FUTURE_EVM + i, FUTURE_EVM + i), 0);
    }
    uint expectedFirstSlot = 0;
    for (uint i = 0; i < CHAIN_IDS_PER_SLOT; ++i) {
      expectedFirstSlot |= (uint256(FUTURE_EVM + i) << (i * 16));
    }
    uint expectedSecondSlot = 0;
    for (uint i = 0; i < 8; ++i) {
      expectedSecondSlot |= (uint256(FUTURE_EVM + CHAIN_IDS_PER_SLOT + i) << (i * 16));
    }
    // The first mapping is hardcoded so it is expected to be empty
    assertEq(_loadExtraChainIdsSlot(0), 0);
    assertEq(_loadExtraChainIdsSlot(1), expectedFirstSlot);
    assertEq(_loadExtraChainIdsSlot(2), expectedSecondSlot);
  }

  function testUnauthorized() public {
    vm.startPrank(TEST_ADDRESS);
    vm.expectRevert("Not authorized");
    _cctpRExec(abi.encodePacked(UPDATE_FEE_ADJUSTMENTS_ID, uint8(0), uint256(31337)), 0);
    vm.expectRevert("Not authorized");
    _cctpRExec(abi.encodePacked(OWNER_UPDATE_FEE_RECIPIENT_ID, TEST_ADDRESS), 0);
    vm.expectRevert("Not authorized");
    _cctpRExec(abi.encodePacked(OWNER_UPDATE_FEE_ADJUSTER_ID, TEST_ADDRESS), 0);
    vm.expectRevert("Not authorized");
    _cctpRExec(abi.encodePacked(OWNER_UPDATE_OFFCHAIN_QUOTER_ID, TEST_ADDRESS), 0);
    vm.stopPrank();
  }

  function testSweepTokens() public {
    deal(address(usdc()), address(cctpR), 1000);
    assertEq(usdc().balanceOf(address(cctpR)), 1000);
    vm.prank(owner);
    _cctpRExec(abi.encodePacked(OWNER_SWEEP_TOKENS_ID, address(usdc()), uint256(1000)), 0);
    assertEq(usdc().balanceOf(address(cctpR)), 0);
    assertEq(usdc().balanceOf(address(owner)), 1000);
  }
}
