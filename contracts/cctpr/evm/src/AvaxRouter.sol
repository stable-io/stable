// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

pragma solidity ^0.8.28;

import {IERC20}          from "wormhole-sdk/interfaces/token/IERC20.sol";
import {ITokenMessenger} from "wormhole-sdk/interfaces/cctp/ITokenMessenger.sol";
import {BytesParsing}    from "wormhole-sdk/libraries/BytesParsing.sol";

import {ICctpReceiver} from "cctp-xr/interfaces/ICctpReceiver.sol";

contract AvaxRouter {
  using BytesParsing for bytes;

  //relayer must check that sourceSender is a valid CctpR contract address on the source domain!
  event RelayRequest(
    uint32 sourceDomain,
    bytes32 sourceSender,
    uint64 cctpNonce,
    uint32 gasDropoffMicroGasToken
  );

  //see https://github.com/circlefin/evm-cctp-contracts/blob/63ab1f0ac06ce0793c0bbfbb8d09816bc211386d/src/messages/v2/MessageV2.sol#L52-L61
  uint private constant V2_MESSAGE_SOURCE_DOMAIN_OFFSET = 4;
  uint private constant V2_MESSAGE_BODY_OFFSET  = 148;

  //see https://github.com/circlefin/evm-cctp-contracts/blob/63ab1f0ac06ce0793c0bbfbb8d09816bc211386d/src/messages/v2/BurnMessageV2.sol#L27-L36
  uint private constant V2_BURN_MESSAGE_AMOUNT_OFFSET   = V2_MESSAGE_BODY_OFFSET +  68;
  uint private constant V2_BURN_MESSAGE_SENDER_OFFSET   = V2_MESSAGE_BODY_OFFSET + 100;
  uint private constant V2_BURN_MESSAGE_FEE_OFFSET      = V2_MESSAGE_BODY_OFFSET + 164;
  uint private constant V2_BURN_MESSAGE_HOOKDATA_OFFSET = V2_MESSAGE_BODY_OFFSET + 228;

  ICctpReceiver   private immutable _messageTransmitterV2;
  ITokenMessenger private immutable _tokenMessengerV1;
  address         private immutable _usdc;

  constructor(address messageTransmitterV2, address tokenMessengerV1, address usdc) {
    _messageTransmitterV2 = ICctpReceiver(messageTransmitterV2);
    _tokenMessengerV1 = ITokenMessenger(tokenMessengerV1);
    _usdc = usdc;
    IERC20(_usdc).approve(tokenMessengerV1, type(uint256).max);
  }

  function relay(bytes calldata message, bytes calldata signature) external { unchecked {
    //redeem the cctp v2 transfer
    require(_messageTransmitterV2.receiveMessage(message, signature), "cctp redeem failed");

    (uint32  sourceDomain, ) = message.asUint32CdUnchecked(V2_MESSAGE_SOURCE_DOMAIN_OFFSET);
    (uint256 amount,       ) = message.asUint256CdUnchecked(V2_BURN_MESSAGE_AMOUNT_OFFSET);
    (bytes32 sourceSender, ) = message.asBytes32CdUnchecked(V2_BURN_MESSAGE_SENDER_OFFSET);
    (uint256 fee,          ) = message.asUint256CdUnchecked(V2_BURN_MESSAGE_FEE_OFFSET);

    //read CctpR custom payload
    uint offset = V2_BURN_MESSAGE_HOOKDATA_OFFSET;
    uint8 destinationDomain; bytes32 recipient; uint32 gasDropoffMicroGasToken;
    (destinationDomain,       offset) = message.asUint8CdUnchecked(offset);
    (recipient,               offset) = message.asBytes32CdUnchecked(offset);
    (gasDropoffMicroGasToken,       ) = message.asUint32CdUnchecked(offset);

    //initiate v1 transfer (fast because we are on Avalanche) to the destination domain
    uint64 cctpNonce = _tokenMessengerV1.depositForBurn(
      amount - fee,
      destinationDomain,
      recipient,
      address(_usdc)
    );

    emit RelayRequest(sourceDomain, sourceSender, cctpNonce, gasDropoffMicroGasToken);
  }}
}
