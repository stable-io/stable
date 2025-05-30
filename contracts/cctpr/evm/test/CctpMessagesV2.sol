// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.14; //for (bugfixed) support of `using ... global;` syntax for libraries

import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";
import {eagerAnd, eagerOr} from "wormhole-sdk/Utils.sol";

struct CctpHeaderV2 {
  //uint32 headerVersion;
  uint32 sourceDomain;
  uint32 destinationDomain;
  bytes32 nonce;
  bytes32 sender;
  bytes32 recipient;
  bytes32 destinationCaller;
  uint32 minFinalityThreshold;
  uint32 finalityThresholdExecuted;
}

struct CctpMessageV2 {
  CctpHeaderV2 header;
  bytes messageBody;
}

struct CctpTokenBurnBodyV2 {
  //uint32 bodyVersion;
  bytes32 burnToken;
  bytes32 mintRecipient;
  uint256 amount;
  bytes32 messageSender;
  uint256 maxFee;
  uint256 feeExecuted;
  uint256 expirationBlock;
  bytes   hookData;
}

struct CctpTokenBurnMessageV2 {
  CctpHeaderV2 header;
  CctpTokenBurnBodyV2 body;
}

library CctpMessageV2Lib {
  using BytesParsing for bytes;
  using {BytesParsing.checkBound, BytesParsing.checkLength} for uint;

  error InvalidCctpMessageHeaderVersion();
  error InvalidCctpMessageBodyVersion();

  uint32 constant HEADER_VERSION = 1;
  uint32 constant TOKEN_MESSENGER_BODY_VERSION = 1;

  // Header format offsets and sizes
  uint internal constant HEADER_VERSION_OFFSET = 0;
  uint internal constant HEADER_VERSION_SIZE = 4;

  uint internal constant HEADER_SOURCE_DOMAIN_OFFSET =
    HEADER_VERSION_OFFSET + HEADER_VERSION_SIZE;
  uint internal constant HEADER_SOURCE_DOMAIN_SIZE = 4;

  uint internal constant HEADER_DESTINATION_DOMAIN_OFFSET =
    HEADER_SOURCE_DOMAIN_OFFSET + HEADER_SOURCE_DOMAIN_SIZE;
  uint internal constant HEADER_DESTINATION_DOMAIN_SIZE = 4;

  uint internal constant HEADER_NONCE_OFFSET =
    HEADER_DESTINATION_DOMAIN_OFFSET + HEADER_DESTINATION_DOMAIN_SIZE;
  uint internal constant HEADER_NONCE_SIZE = 32;

  uint internal constant HEADER_SENDER_OFFSET =
    HEADER_NONCE_OFFSET + HEADER_NONCE_SIZE;
  uint internal constant HEADER_SENDER_SIZE = 32;

  uint internal constant HEADER_RECIPIENT_OFFSET =
    HEADER_SENDER_OFFSET + HEADER_SENDER_SIZE;
  uint internal constant HEADER_RECIPIENT_SIZE = 32;

  uint internal constant HEADER_DESTINATION_CALLER_OFFSET =
    HEADER_RECIPIENT_OFFSET + HEADER_RECIPIENT_SIZE;
  uint internal constant HEADER_DESTINATION_CALLER_SIZE = 32;

  uint internal constant HEADER_MIN_FINALITY_THRESHOLD_OFFSET =
    HEADER_DESTINATION_CALLER_OFFSET + HEADER_DESTINATION_CALLER_SIZE;
  uint internal constant HEADER_MIN_FINALITY_THRESHOLD_SIZE = 4;

  uint internal constant HEADER_FINALITY_THRESHOLD_EXECUTED_OFFSET =
    HEADER_MIN_FINALITY_THRESHOLD_OFFSET + HEADER_MIN_FINALITY_THRESHOLD_SIZE;
  uint internal constant HEADER_FINALITY_THRESHOLD_EXECUTED_SIZE = 4;

  uint internal constant HEADER_SIZE =
    HEADER_FINALITY_THRESHOLD_EXECUTED_OFFSET + HEADER_FINALITY_THRESHOLD_EXECUTED_SIZE;

  // TokenBurn format offsets and sizes
  uint internal constant TOKEN_BURN_BODY_OFFSET = HEADER_SIZE;

  uint internal constant TOKEN_BURN_BODY_VERSION_OFFSET = 0;
  uint internal constant TOKEN_BURN_BODY_VERSION_SIZE = 4;

  uint internal constant TOKEN_BURN_BODY_TOKEN_OFFSET =
    TOKEN_BURN_BODY_VERSION_OFFSET + TOKEN_BURN_BODY_VERSION_SIZE;
  uint internal constant TOKEN_BURN_BODY_TOKEN_SIZE = 32;

  uint internal constant TOKEN_BURN_BODY_MINT_RECIPIENT_OFFSET =
    TOKEN_BURN_BODY_TOKEN_OFFSET + TOKEN_BURN_BODY_TOKEN_SIZE;
  uint internal constant TOKEN_BURN_BODY_MINT_RECIPIENT_SIZE = 32;

  uint internal constant TOKEN_BURN_BODY_AMOUNT_OFFSET =
    TOKEN_BURN_BODY_MINT_RECIPIENT_OFFSET + TOKEN_BURN_BODY_MINT_RECIPIENT_SIZE;
  uint internal constant TOKEN_BURN_BODY_AMOUNT_SIZE = 32;

  uint internal constant TOKEN_BURN_BODY_MESSAGE_SENDER_OFFSET =
    TOKEN_BURN_BODY_AMOUNT_OFFSET + TOKEN_BURN_BODY_AMOUNT_SIZE;
  uint internal constant TOKEN_BURN_BODY_MESSAGE_SENDER_SIZE = 32;

  uint internal constant TOKEN_BURN_BODY_MAX_FEE_OFFSET =
    TOKEN_BURN_BODY_MESSAGE_SENDER_OFFSET + TOKEN_BURN_BODY_MESSAGE_SENDER_SIZE;
  uint internal constant TOKEN_BURN_BODY_MAX_FEE_SIZE = 32;

  uint internal constant TOKEN_BURN_BODY_FEE_EXECUTED_OFFSET =
    TOKEN_BURN_BODY_MAX_FEE_OFFSET + TOKEN_BURN_BODY_MAX_FEE_SIZE;
  uint internal constant TOKEN_BURN_BODY_FEE_EXECUTED_SIZE = 32;

  uint internal constant TOKEN_BURN_BODY_EXPIRATION_BLOCK_OFFSET =
    TOKEN_BURN_BODY_FEE_EXECUTED_OFFSET + TOKEN_BURN_BODY_FEE_EXECUTED_SIZE;
  uint internal constant TOKEN_BURN_BODY_EXPIRATION_BLOCK_SIZE = 32;

  uint internal constant TOKEN_BURN_BODY_HOOK_DATA_OFFSET =
    TOKEN_BURN_BODY_EXPIRATION_BLOCK_OFFSET + TOKEN_BURN_BODY_EXPIRATION_BLOCK_SIZE;


  // ------------ Message Type Checking Functions ------------

  function isCctpTokenBurnMessageCdV2(bytes calldata encodedMsg) internal pure returns (bool) {
    (uint headerVersion,) = encodedMsg.asUint32CdUnchecked(HEADER_VERSION_OFFSET);
    (uint bodyVersion,  ) = encodedMsg.asUint32CdUnchecked(
      TOKEN_BURN_BODY_OFFSET + TOKEN_BURN_BODY_VERSION_OFFSET
    );
    return _isCctpTokenBurnMessageV2(headerVersion, bodyVersion, encodedMsg.length);
  }

  function isCctpTokenBurnMessageV2Mem(bytes memory encodedMsg) internal pure returns (bool) {
    (uint headerVersion,) = encodedMsg.asUint32MemUnchecked(HEADER_VERSION_OFFSET);
    (uint bodyVersion,  ) = encodedMsg.asUint32MemUnchecked(
      TOKEN_BURN_BODY_OFFSET + TOKEN_BURN_BODY_VERSION_OFFSET
    );
    return _isCctpTokenBurnMessageV2(headerVersion, bodyVersion, encodedMsg.length);
  }

  function _isCctpTokenBurnMessageV2(
    uint headerVersion,
    uint bodyVersion,
    uint messageLength
  ) private pure returns (bool) {
    //avoid short-circuiting to save gas and code size
    return eagerAnd(
      eagerAnd(messageLength >= TOKEN_BURN_BODY_HOOK_DATA_OFFSET, headerVersion == HEADER_VERSION),
      bodyVersion == TOKEN_MESSENGER_BODY_VERSION
    );
  }

  // ------------ Convenience Decoding Functions ------------

  function decodeCctpMessageV2Cd(
    bytes calldata encodedMsg
  ) internal pure returns (
    uint32  sourceDomain,
    uint32  destinationDomain,
    bytes32 nonce,
    bytes32 sender,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32  minFinalityThreshold,
    uint32  finalityThresholdExecuted,
    bytes calldata messageBody
  ) {
    uint bodyOffset; //optimization because we have it on the stack already
                     //should always equal TOKEN_BURN_BODY_OFFSET
    ( sourceDomain,
      destinationDomain,
      nonce,
      sender,
      recipient,
      destinationCaller,
      minFinalityThreshold,
      finalityThresholdExecuted,
      bodyOffset
    ) = decodeCctpHeaderV2CdUnchecked(encodedMsg);
    //check to avoid underflow in following subtraction
    //we avoid using the built-in encodedMsg[bodyOffset:] so we only get BytesParsing errors
    bodyOffset.checkBound(encodedMsg.length);
    (messageBody, ) = encodedMsg.sliceCdUnchecked(bodyOffset, encodedMsg.length - bodyOffset);
  }

  function decodeCctpMessageV2StructCd(
    bytes calldata encodedMsg
  ) internal pure returns (CctpMessageV2 memory message) {
    ( message.header.sourceDomain,
      message.header.destinationDomain,
      message.header.nonce,
      message.header.sender,
      message.header.recipient,
      message.header.destinationCaller,
      message.header.minFinalityThreshold,
      message.header.finalityThresholdExecuted,
      message.messageBody
    ) = decodeCctpMessageV2Cd(encodedMsg);
  }

  function decodeCctpMessageV2Mem(
    bytes memory encodedMsg
  ) internal pure returns (
    uint32  sourceDomain,
    uint32  destinationDomain,
    bytes32 nonce,
    bytes32 sender,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32  minFinalityThreshold,
    uint32  finalityThresholdExecuted,
    bytes memory messageBody
  ) {
    ( sourceDomain,
      destinationDomain,
      nonce,
      sender,
      recipient,
      destinationCaller,
      minFinalityThreshold,
      finalityThresholdExecuted,
      messageBody,
    ) = decodeCctpMessageV2MemUnchecked(encodedMsg, 0, encodedMsg.length);
  }

  function decodeCctpMessageV2StructMem(
    bytes memory encodedMsg
  ) internal pure returns (CctpMessageV2 memory message) {
    ( message.header.sourceDomain,
      message.header.destinationDomain,
      message.header.nonce,
      message.header.sender,
      message.header.recipient,
      message.header.destinationCaller,
      message.header.minFinalityThreshold,
      message.header.finalityThresholdExecuted,
      message.messageBody,
    ) = decodeCctpMessageV2MemUnchecked(encodedMsg, 0, encodedMsg.length);
  }

  function decodeCctpTokenBurnMessageV2StructCd(
    bytes calldata encodedMsg
  ) internal pure returns (CctpTokenBurnMessageV2 memory message) {
    uint offset;
    (message.header, offset) = decodeCctpHeaderV2StructCdUnchecked(encodedMsg);
    message.body = decodeCctpTokenBurnBodyV2StructCd(encodedMsg, offset);
  }

  function decodeCctpTokenBurnMessageV2StructMem(
    bytes memory encodedMsg
  ) internal pure returns (CctpTokenBurnMessageV2 memory message) {
    uint offset;
    (message.header, offset) = decodeCctpHeaderV2StructMemUnchecked(encodedMsg, 0);
    (message.body, ) = decodeCctpTokenBurnBodyV2StructMem(encodedMsg, offset, encodedMsg.length);
  }

  // ------------ Advanced Decoding Functions ------------

  function checkHeaderVersion(uint32 version) internal pure {
    if (version != HEADER_VERSION)
      revert InvalidCctpMessageHeaderVersion();
  }

  function checkTokenMessengerBodyVersion(uint32 version) internal pure {
    if (version != TOKEN_MESSENGER_BODY_VERSION)
      revert InvalidCctpMessageBodyVersion();
  }

  function decodeCctpHeaderV2CdUnchecked(
    bytes calldata encoded
  ) internal pure returns (
    uint32  sourceDomain,
    uint32  destinationDomain,
    bytes32 nonce,
    bytes32 sender,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32  minFinalityThreshold,
    uint32  finalityThresholdExecuted,
    uint    bodyOffset
  ) {
    uint offset = 0;
    uint32 version;
    (version,                   offset) = encoded.asUint32CdUnchecked(offset);
    checkHeaderVersion(version);
    (sourceDomain,              offset) = encoded.asUint32CdUnchecked(offset);
    (destinationDomain,         offset) = encoded.asUint32CdUnchecked(offset);
    (nonce,                     offset) = encoded.asBytes32CdUnchecked(offset);
    (sender,                    offset) = encoded.asBytes32CdUnchecked(offset);
    (recipient,                 offset) = encoded.asBytes32CdUnchecked(offset);
    (destinationCaller,         offset) = encoded.asBytes32CdUnchecked(offset);
    (minFinalityThreshold,      offset) = encoded.asUint32CdUnchecked(offset);
    (finalityThresholdExecuted, offset) = encoded.asUint32CdUnchecked(offset);
    bodyOffset = offset;
  }

  function decodeCctpHeaderV2StructCdUnchecked(
    bytes calldata encodedMsg
  ) internal pure returns (CctpHeaderV2 memory header, uint bodyOffset) {
    ( header.sourceDomain,
      header.destinationDomain,
      header.nonce,
      header.sender,
      header.recipient,
      header.destinationCaller,
      header.minFinalityThreshold,
      header.finalityThresholdExecuted,
      bodyOffset
    ) = decodeCctpHeaderV2CdUnchecked(encodedMsg);
  }

  function decodeCctpHeaderV2MemUnchecked(
    bytes memory encoded,
    uint offset
  ) internal pure returns (
    uint32  sourceDomain,
    uint32  destinationDomain,
    bytes32 nonce,
    bytes32 sender,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32  minFinalityThreshold,
    uint32  finalityThresholdExecuted,
    uint    bodyOffset
  ) {
    uint32 version;
    (version,                   offset) = encoded.asUint32MemUnchecked(offset);
    checkHeaderVersion(version);
    (sourceDomain,              offset) = encoded.asUint32MemUnchecked(offset);
    (destinationDomain,         offset) = encoded.asUint32MemUnchecked(offset);
    (nonce,                     offset) = encoded.asBytes32MemUnchecked(offset);
    (sender,                    offset) = encoded.asBytes32MemUnchecked(offset);
    (recipient,                 offset) = encoded.asBytes32MemUnchecked(offset);
    (destinationCaller,         offset) = encoded.asBytes32MemUnchecked(offset);
    (minFinalityThreshold,      offset) = encoded.asUint32MemUnchecked(offset);
    (finalityThresholdExecuted, offset) = encoded.asUint32MemUnchecked(offset);
    bodyOffset = offset;
  }

  function decodeCctpHeaderV2StructMemUnchecked(
    bytes memory encoded,
    uint offset
  ) internal pure returns (CctpHeaderV2 memory header, uint bodyOffset) {
    ( header.sourceDomain,
      header.destinationDomain,
      header.nonce,
      header.sender,
      header.recipient,
      header.destinationCaller,
      header.minFinalityThreshold,
      header.finalityThresholdExecuted,
      bodyOffset
    ) = decodeCctpHeaderV2MemUnchecked(encoded, offset);
  }

  function decodeCctpMessageV2MemUnchecked(
    bytes memory encoded,
    uint offset,
    uint messageLength
  ) internal pure returns (
    uint32  sourceDomain,
    uint32  destinationDomain,
    bytes32 nonce,
    bytes32 sender,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32  minFinalityThreshold,
    uint32  finalityThresholdExecuted,
    bytes memory messageBody,
    uint newOffset
  ) { unchecked {
    ( sourceDomain,
      destinationDomain,
      nonce,
      sender,
      recipient,
      destinationCaller,
      minFinalityThreshold,
      finalityThresholdExecuted,
      offset
    ) = decodeCctpHeaderV2MemUnchecked(encoded, offset);
    offset.checkBound(messageLength);
    (messageBody, offset) = encoded.sliceMemUnchecked(offset, messageLength - offset);
    newOffset = offset;
  }}

  function decodeCctpMessageV2StructMemUnchecked(
    bytes memory encoded,
    uint offset,
    uint messageLength
  ) internal pure returns (CctpMessageV2 memory message, uint newOffset) {
    ( message.header.sourceDomain,
      message.header.destinationDomain,
      message.header.nonce,
      message.header.sender,
      message.header.recipient,
      message.header.destinationCaller,
      message.header.minFinalityThreshold,
      message.header.finalityThresholdExecuted,
      message.messageBody,
      newOffset
    ) = decodeCctpMessageV2MemUnchecked(encoded, offset, messageLength);
  }

  function decodeCctpTokenBurnBodyV2Cd(
    bytes calldata encoded,
    uint bodyOffset
  ) internal pure returns (
    bytes32 burnToken,
    bytes32 mintRecipient,
    uint256 amount,
    bytes32 messageSender,
    uint256 maxFee,
    uint256 feeExecuted,
    uint256 expirationBlock,
    bytes calldata hookData
  ) { unchecked {
    uint offset = bodyOffset;
    uint32 version;
    (version,         offset) = encoded.asUint32CdUnchecked(offset);
    checkTokenMessengerBodyVersion(version);
    (burnToken,       offset) = encoded.asBytes32CdUnchecked(offset);
    (mintRecipient,   offset) = encoded.asBytes32CdUnchecked(offset);
    (amount,          offset) = encoded.asUint256CdUnchecked(offset);
    (messageSender,   offset) = encoded.asBytes32CdUnchecked(offset);
    (maxFee,          offset) = encoded.asUint256CdUnchecked(offset);
    (feeExecuted,     offset) = encoded.asUint256CdUnchecked(offset);
    (expirationBlock, offset) = encoded.asUint256CdUnchecked(offset);
    offset.checkBound(encoded.length);
    (hookData,              ) = encoded.sliceCdUnchecked(offset, encoded.length - offset);
  }}

  function decodeCctpTokenBurnBodyV2StructCd(
    bytes calldata encodedMsg,
    uint bodyOffset
  ) internal pure returns (CctpTokenBurnBodyV2 memory body) {
    ( body.burnToken,
      body.mintRecipient,
      body.amount,
      body.messageSender,
      body.maxFee,
      body.feeExecuted,
      body.expirationBlock,
      body.hookData
    ) = decodeCctpTokenBurnBodyV2Cd(encodedMsg, bodyOffset);
  }

  function decodeCctpTokenBurnBodyV2Mem(
    bytes memory encodedMsg,
    uint bodyOffset,
    uint messageLength
  ) internal pure returns (
    bytes32 burnToken,
    bytes32 mintRecipient,
    uint256 amount,
    bytes32 messageSender,
    uint256 maxFee,
    uint256 feeExecuted,
    uint256 expirationBlock,
    bytes memory hookData,
    uint newOffset
  ) { unchecked {
    uint offset = bodyOffset;
    uint32 version;
    (version,         offset) = encodedMsg.asUint32MemUnchecked(offset);
    checkTokenMessengerBodyVersion(version);
    (burnToken,       offset) = encodedMsg.asBytes32MemUnchecked(offset);
    (mintRecipient,   offset) = encodedMsg.asBytes32MemUnchecked(offset);
    (amount,          offset) = encodedMsg.asUint256MemUnchecked(offset);
    (messageSender,   offset) = encodedMsg.asBytes32MemUnchecked(offset);
    (maxFee,          offset) = encodedMsg.asUint256MemUnchecked(offset);
    (feeExecuted,     offset) = encodedMsg.asUint256MemUnchecked(offset);
    (expirationBlock, offset) = encodedMsg.asUint256MemUnchecked(offset);
    offset.checkBound(messageLength);
    (hookData,        offset) = encodedMsg.sliceMemUnchecked(offset, messageLength - offset);
    newOffset = offset;
  }}

  function decodeCctpTokenBurnBodyV2StructMem(
    bytes memory encodedMsg,
    uint offset,
    uint messageLength
  ) internal pure returns (CctpTokenBurnBodyV2 memory body, uint newOffset) {
    ( body.burnToken,
      body.mintRecipient,
      body.amount,
      body.messageSender,
      body.maxFee,
      body.feeExecuted,
      body.expirationBlock,
      body.hookData,
      newOffset
    ) = decodeCctpTokenBurnBodyV2Mem(encodedMsg, offset, messageLength);
  }

  function decodeCctpTokenBurnMessageV2StructMemUnchecked(
    bytes memory encoded,
    uint offset,
    uint messageLength
  ) internal pure returns (CctpTokenBurnMessageV2 memory message, uint newOffset) {
    (message.header, offset) = decodeCctpHeaderV2StructMemUnchecked(encoded, offset);
    (message.body,   offset) =
      decodeCctpTokenBurnBodyV2StructMem(encoded, offset, messageLength);
    newOffset = offset;
  }

  // ------------ Encoding ------------

  function encodeCctpMessageV2(
    uint32  sourceDomain,
    uint32  destinationDomain,
    bytes32 nonce,
    bytes32 sender,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32  minFinalityThreshold,
    uint32  finalityThresholdExecuted,
    bytes memory messageBody
  ) internal pure returns (bytes memory) {
    return abi.encodePacked(
      encodeCctpHeaderV2(
        sourceDomain,
        destinationDomain,
        nonce,
        sender,
        recipient,
        destinationCaller,
        minFinalityThreshold,
        finalityThresholdExecuted
      ),
      messageBody
    );
  }

  function encode(CctpMessageV2 memory message) internal pure returns (bytes memory) {
    return encodeCctpMessageV2(
      message.header.sourceDomain,
      message.header.destinationDomain,
      message.header.nonce,
      message.header.sender,
      message.header.recipient,
      message.header.destinationCaller,
      message.header.minFinalityThreshold,
      message.header.finalityThresholdExecuted,
      message.messageBody
    );
  }

  function encode(CctpTokenBurnMessageV2 memory burnMsg) internal pure returns (bytes memory) {
    return abi.encodePacked(encode(burnMsg.header), encode(burnMsg.body));
  }

  function encodeCctpHeaderV2(
    uint32  sourceDomain,
    uint32  destinationDomain,
    bytes32 nonce,
    bytes32 sender,
    bytes32 recipient,
    bytes32 destinationCaller,
    uint32  minFinalityThreshold,
    uint32  finalityThresholdExecuted
  ) internal pure returns (bytes memory) {
    return abi.encodePacked(
      HEADER_VERSION,
      sourceDomain,
      destinationDomain,
      nonce,
      sender,
      recipient,
      destinationCaller,
      minFinalityThreshold,
      finalityThresholdExecuted
    );
  }

  function encode(CctpHeaderV2 memory header) internal pure returns (bytes memory) {
    return encodeCctpHeaderV2(
      header.sourceDomain,
      header.destinationDomain,
      header.nonce,
      header.sender,
      header.recipient,
      header.destinationCaller,
      header.minFinalityThreshold,
      header.finalityThresholdExecuted
    );
  }

  function encodeCctpTokenBurnBodyV2(
    bytes32 burnToken,
    bytes32 mintRecipient,
    uint256 amount,
    bytes32 messageSender,
    uint256 maxFee,
    uint256 feeExecuted,
    uint256 expirationBlock,
    bytes memory hookData
  ) internal pure returns (bytes memory) {
    return abi.encodePacked(
      TOKEN_MESSENGER_BODY_VERSION,
      burnToken,
      mintRecipient,
      amount,
      messageSender,
      maxFee,
      feeExecuted,
      expirationBlock,
      hookData
    );
  }

  function encode(CctpTokenBurnBodyV2 memory burnBody) internal pure returns (bytes memory) {
    return encodeCctpTokenBurnBodyV2(
      burnBody.burnToken,
      burnBody.mintRecipient,
      burnBody.amount,
      burnBody.messageSender,
      burnBody.maxFee,
      burnBody.feeExecuted,
      burnBody.expirationBlock,
      burnBody.hookData
    );
  }
}

using CctpMessageV2Lib for CctpMessageV2 global;
using CctpMessageV2Lib for CctpTokenBurnMessageV2 global;
using CctpMessageV2Lib for CctpHeaderV2 global;
using CctpMessageV2Lib for CctpTokenBurnBodyV2 global;
