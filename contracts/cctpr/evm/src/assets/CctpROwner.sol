// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

pragma solidity ^0.8.28;

import {BytesParsing} from "wormhole-sdk/libraries/BytesParsing.sol";

import {CctpRBase, Route} from "cctp-xr/assets/CctpRBase.sol";
import {eagerOr, tokenOrNativeTransfer} from "wormhole-sdk/Utils.sol";

uint8 constant MAX_ROUTE_VARIANT_PLUS_ONE = uint8(Route.AvaxHop) + 1;

abstract contract CctpROwner is CctpRBase {
  using BytesParsing for bytes;

  address internal _owner;
  address internal _pendingOwner;
  address internal _feeAdjuster;

  constructor(address owner, address feeAdjuster) {
    _owner = owner;
    _feeAdjuster = feeAdjuster;
  }

  function _proposeOwnershipTransfer(address newOwner) internal {
    _checkOwner();
    _pendingOwner = newOwner;
  }

  function _acceptOwnership() internal {
    _owner = _pendingOwner;
    _checkOwner();
    _pendingOwner = address(0);
  }

  function _cancelOwnershipTransfer() internal {
    _checkOwner();
    _pendingOwner = address(0);
  }

  function _updateFeeRecipient(address newFeeRecipient) internal {
    _checkOwner();
    _setFeeRecipient(newFeeRecipient);
  }

  function _updateFeeAdjuster(address newFeeAdjuster) internal {
    _checkOwner();
    _feeAdjuster = newFeeAdjuster;
  }

  function _updateOffchainQuoter(address newOffchainQuoter) internal {
    _checkOwner();
    _offChainQuoter = newOffchainQuoter;
  }

  function _updateFeeAdjustments(uint feeType, uint mappingIndex, uint256 newFeeAdjustments) internal {
    require(eagerOr(msg.sender == _feeAdjuster, msg.sender == _owner), "Not authorized");
    if (feeType == uint8(Route.V1))
      _v1Adjustments[mappingIndex] = newFeeAdjustments;
    else if (feeType == uint8(Route.V2Direct))
      _v2DirectAdjustments[mappingIndex] = newFeeAdjustments;
    else if (feeType == uint8(Route.AvaxHop))
      _avaxHopAdjustments[mappingIndex] = newFeeAdjustments;
    else if (feeType == MAX_ROUTE_VARIANT_PLUS_ONE)
      _gasDropoffAdjustments[mappingIndex] = newFeeAdjustments;
    else
      revert("Invalid fee type");
  }

  function _updateChainIdForDomain(
    uint domain,
    uint16 chainId
  ) internal {
    _checkOwner();
    _setChainIdForDomain(domain, chainId);
  }

  function _sweepTokens(
    address token,
    uint256 amount
  ) internal {
    _checkOwner();
    tokenOrNativeTransfer(token, msg.sender, amount);
  }

  function _checkOwner() private view {
    require(msg.sender == _owner, "Not authorized");
  }
}
