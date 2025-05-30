// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

pragma solidity ^0.8.28;

import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";
import {ICctpReceiver} from "cctp-xr/interfaces/ICctpReceiver.sol";

contract CctpGasDropoff {
  using BytesParsing for bytes;

  //see https://developers.circle.com/stablecoins/evm-smart-contracts
  ICctpReceiver private immutable _messageTransmitterV1;
  ICctpReceiver private immutable _messageTransmitterV2;

  //see https://github.com/circlefin/evm-cctp-contracts/blob/63ab1f0ac06ce0793c0bbfbb8d09816bc211386d/src/MessageTransmitter.sol#L75
  //and https://sepolia.etherscan.io/address/0x7865fAfC2db2093669d92c0F33AeEF291086BEFD#readContract#F15
  uint32 private constant CCTP_V1_HEADER_VERSION = 0;
  //see https://github.com/circlefin/evm-cctp-contracts/blob/63ab1f0ac06ce0793c0bbfbb8d09816bc211386d/src/messages/Message.sol#L52
  uint   private constant CCTP_V1_MESSAGE_BODY_OFFSET = 116;
  //see https://github.com/circlefin/evm-cctp-contracts/blob/63ab1f0ac06ce0793c0bbfbb8d09816bc211386d/src/messages/BurnMessage.sol#L39
  uint   private constant CCTP_V1_BURN_MESSAGE_MINT_RECIPIENT_OFFSET = 36;
  //mint recipient is bytes32 but it must be an EVM address
  uint   private constant CCTP_V1_TOTAL_RECIPIENT_ADDRESS_OFFSET =
    CCTP_V1_MESSAGE_BODY_OFFSET + CCTP_V1_BURN_MESSAGE_MINT_RECIPIENT_OFFSET + 12;

  //see https://github.com/circlefin/evm-cctp-contracts/blob/63ab1f0ac06ce0793c0bbfbb8d09816bc211386d/src/v2/BaseMessageTransmitter.sol#L51
  //and https://sepolia.etherscan.io/address/0xe737e5cebeeba77efe34d4aa090756590b1ce275#readProxyContract#F16
  uint32 private constant CCTP_V2_HEADER_VERSION = 1; //unused, only for documentation/consistency
  //see https://github.com/circlefin/evm-cctp-contracts/blob/63ab1f0ac06ce0793c0bbfbb8d09816bc211386d/src/messages/v2/MessageV2.sol#L61
  uint   private constant CCTP_V2_MESSAGE_BODY_OFFSET = 148;
  //see https://github.com/circlefin/evm-cctp-contracts/blob/63ab1f0ac06ce0793c0bbfbb8d09816bc211386d/src/messages/v2/BurnMessageV2.sol#L30
  uint   private constant CCTP_V2_BURN_MESSAGE_MINT_RECIPIENT_OFFSET = 36;
  //mint recipient is bytes32 but it must be an EVM address
  uint   private constant CCTP_V2_TOTAL_RECIPIENT_ADDRESS_OFFSET =
    CCTP_V2_MESSAGE_BODY_OFFSET + CCTP_V2_BURN_MESSAGE_MINT_RECIPIENT_OFFSET + 12;

  constructor(address messageTransmitterV1, address messageTransmitterV2) {
    _messageTransmitterV1 = ICctpReceiver(messageTransmitterV1);
    _messageTransmitterV2 = ICctpReceiver(messageTransmitterV2);
  }

  function relayWithGasDropoff(
    bytes calldata message,
    bytes calldata attestation
  ) external payable {
    //determine cctp version
    ICctpReceiver messageTransmitter;
    uint recipientMsgOffset;
    (uint32 version, ) = message.asUint32CdUnchecked(0);
    if (version == CCTP_V1_HEADER_VERSION) {
      messageTransmitter = _messageTransmitterV1;
      recipientMsgOffset = CCTP_V1_TOTAL_RECIPIENT_ADDRESS_OFFSET;
    }
    else {
      messageTransmitter = _messageTransmitterV2;
      recipientMsgOffset = CCTP_V2_TOTAL_RECIPIENT_ADDRESS_OFFSET;
    }

    //redeem the cctp transfer
    require(messageTransmitter.receiveMessage(message, attestation), "cctp redeem failed");

    //transfer gas dropoff to recipient
    (address recipient, ) = message.asAddressCdUnchecked(recipientMsgOffset);
    (bool success, ) = recipient.call{value: msg.value}(new bytes(0));
    require(success, "gas dropoff failed");
  }
}
