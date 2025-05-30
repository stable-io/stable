// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.19;

import "forge-std/Vm.sol";

import {IMessageTransmitter} from "wormhole-sdk/interfaces/cctp/IMessageTransmitter.sol";
import {LogUtils} from "wormhole-sdk/testing/LogUtils.sol";
import {VM_ADDRESS, DEVNET_GUARDIAN_PRIVATE_KEY} from "wormhole-sdk/testing/Constants.sol";
import {CctpMessageV2Lib, CctpTokenBurnMessageV2} from "./CctpMessagesV2.sol";

interface IMessageTransmitterV2 is IMessageTransmitter {}

//create fake CCTP attestations for forge tests
library CctpOverrideV2 {
  using CctpMessageV2Lib for bytes;
  using LogUtils for Vm.Log[];

  Vm constant vm = Vm(VM_ADDRESS);

  // keccak256("attesterPrivateKey") - 1
  bytes32 private constant _ATTESTER_PK_SLOT =
    0xb60bdf9c1f1404b33ce5538637aeb77ae8bc4e523cec04106ff4fbe1df885bf2;

  function setUpOverride(IMessageTransmitterV2 messageTransmitter) internal {
    setUpOverride(messageTransmitter, DEVNET_GUARDIAN_PRIVATE_KEY);
  }

  function setUpOverride(IMessageTransmitterV2 messageTransmitter, uint256 signer) internal {
    if (attesterPrivateKey(messageTransmitter) == signer)
      return;

    require(attesterPrivateKey(messageTransmitter) == 0, "CctpOverride: already set up");

    require(messageTransmitter.version() == CctpMessageV2Lib.HEADER_VERSION);

    //as pioneered in WormholeOverride
    vm.store(address(messageTransmitter), _ATTESTER_PK_SLOT, bytes32(signer));

    //usurp power
    vm.startPrank(messageTransmitter.attesterManager());
    messageTransmitter.setSignatureThreshold(1);
    messageTransmitter.enableAttester(vm.addr(attesterPrivateKey(messageTransmitter)));
    vm.stopPrank();
  }

  function attesterPrivateKey(
    IMessageTransmitterV2 messageTransmitter
  ) internal view returns (uint256 pk) {
    pk = uint256(vm.load(address(messageTransmitter), _ATTESTER_PK_SLOT));
  }

  //we only care about burn msgs, hence we don't implement a more generic sign() and fetch()

  function sign(
    IMessageTransmitterV2 messageTransmitter,
    CctpTokenBurnMessageV2 memory message
  ) internal view returns (bytes memory signature) {
    (uint8 v, bytes32 r, bytes32 s) =
      vm.sign(attesterPrivateKey(messageTransmitter), keccak256(message.encode()));
    return abi.encodePacked(r, s, v);
  }

  function fetchBurnMessages(
    IMessageTransmitterV2 messageTransmitter,
    Vm.Log[] memory logs
  ) internal pure returns (CctpTokenBurnMessageV2[] memory ret) { unchecked {
    Vm.Log[] memory encodedBurnLogs = logs.filter(
      address(messageTransmitter),
      keccak256("MessageSent(bytes)"),
      _isLoggedTokenBurnMessage
    );

    ret = new CctpTokenBurnMessageV2[](encodedBurnLogs.length);
    for (uint i; i < encodedBurnLogs.length; ++i)
      ret[i++] = _logDataToActualBytes(encodedBurnLogs[i].data)
        .decodeCctpTokenBurnMessageV2StructMem();
  }}

  function _logDataToActualBytes(bytes memory data) private pure returns (bytes memory) {
    return abi.decode(data, (bytes));
  }

  function _isLoggedTokenBurnMessage(bytes memory data) private pure returns (bool) {
    return CctpMessageV2Lib.isCctpTokenBurnMessageV2Mem(_logDataToActualBytes(data));
  }
}
