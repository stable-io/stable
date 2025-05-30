// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

pragma solidity ^0.8.28;

import {BytesParsing}      from "wormhole-sdk/libraries/BytesParsing.sol";
import {PermitParsing}     from "wormhole-sdk/libraries/PermitParsing.sol";
import {RawDispatcher}     from "wormhole-sdk/RawDispatcher.sol";
import {eagerAnd, eagerOr} from "wormhole-sdk/Utils.sol";

import {CctpRBase, Route}       from "cctp-xr/assets/CctpRBase.sol";
import {CctpROwner}             from "cctp-xr/assets/CctpROwner.sol";
import {CctpRUser, Permit2Data} from "cctp-xr/assets/CctpRUser.sol";
import {CctpRQuote}             from "cctp-xr/assets/CctpRQuote.sol";
import {
  TRANSFER_WITH_RELAY_WITH_PERMIT_ID,
  TRANSFER_WITH_RELAY_ID,
  TRANSFER_WITH_RELAY_GASLESS_ID,
  UPDATE_FEE_ADJUSTMENTS_ID,
  OWNER_SWEEP_TOKENS_ID,
  OWNER_UPDATE_FEE_RECIPIENT_ID,
  OWNER_UPDATE_FEE_ADJUSTER_ID,
  OWNER_UPDATE_OFFCHAIN_QUOTER_ID,
  OWNER_PROPOSE_OWNERSHIP_TRANSFER_ID,
  OWNER_ACCEPT_OWNERSHIP_TRANSFER_ID,
  OWNER_CANCEL_OWNERSHIP_TRANSFER_ID,
  OWNER_SET_CHAIN_ID_FOR_DOMAIN_ID,
  QUERY_RELAY_IN_USDC_ID,
  QUERY_RELAY_IN_GAS_TOKEN_ID
} from "cctp-xr/assets/CctpRIds.sol";

uint constant PERMIT2_SPENDER_SIZE   = 20;
uint constant PERMIT2_AMOUNT_SIZE    =  8;
uint constant PERMIT2_NONCE_SIZE     = 32;
uint constant PERMIT2_DEADLINE_SIZE  =  4;
uint constant PERMIT2_SIGNATURE_SIZE = 65;
uint constant GASLESS_AUTH_SIZE =
  PERMIT2_SPENDER_SIZE +
  PERMIT2_AMOUNT_SIZE +
  PERMIT2_NONCE_SIZE +
  PERMIT2_DEADLINE_SIZE +
  PERMIT2_SIGNATURE_SIZE;

uint8 constant QUOTE_OFF_CHAIN     = 0x00;
uint8 constant QUOTE_ON_CHAIN_USDC = 0x01;
uint8 constant QUOTE_ON_CHAIN_GAS  = 0x02;

contract CctpR is CctpRBase, CctpROwner, CctpRQuote, CctpRUser, RawDispatcher {
  using BytesParsing for bytes;
  using {BytesParsing.checkBound, BytesParsing.checkLength} for uint;

  constructor(
    bool isMainnet,
    address owner,
    address feeAdjuster,
    address feeRecipient,
    address offChainQuoter,
    address usdc,
    address tokenMessengerV1,
    address tokenMessengerV2,
    address avaxRouter,
    address priceOracle,
    address permit2,
    bytes memory chainData
  )
    CctpRBase(
      isMainnet,
      feeRecipient,
      offChainQuoter,
      chainData
    )
    CctpROwner(owner, feeAdjuster)
    CctpRQuote(priceOracle)
    CctpRUser(usdc, tokenMessengerV1, tokenMessengerV2, avaxRouter, permit2) {}

  function _exec(bytes calldata data) internal override returns (bytes memory) { unchecked {
    (uint8 id, uint offset) = data.asUint8CdUnchecked(0);
    if (id < UPDATE_FEE_ADJUSTMENTS_ID) {
      //some type of transfer with relay ID
      uint transferUsdc;
      uint8 destinationDomain;
      bytes32 mintRecipient;
      uint32 gasDropoffMicroGasToken;
      Route route;
      uint maxFastFeeUsdc;
      if (id < TRANSFER_WITH_RELAY_GASLESS_ID) {
        if (id == TRANSFER_WITH_RELAY_WITH_PERMIT_ID) {
          bytes calldata permit;
          (permit, offset) = data.sliceCdUnchecked(offset, PermitParsing.PERMIT_SIZE);
          (uint256 value, uint256 deadline, bytes32 r, bytes32 s, uint8 v) =
            PermitParsing.decodePermitCd(permit);
          _redeemUserPermit(value, deadline, r, s, v);
        }
        else if (id != TRANSFER_WITH_RELAY_ID)
          _invalidId();

        ( transferUsdc,
          destinationDomain,
          mintRecipient,
          gasDropoffMicroGasToken,
          route,
          maxFastFeeUsdc,
          offset
        ) = _userTransferWithRelay(data, offset);
      }
      else if (id == TRANSFER_WITH_RELAY_GASLESS_ID) {
        _checkZeroMsgValue();

        Permit2Data memory permit2Data; uint gaslessFeeUsdc;
        (permit2Data.spender,   offset) = data.asAddressCdUnchecked(offset);
        (permit2Data.amount,    offset) = data.asUint64CdUnchecked(offset);
        (permit2Data.nonce,     offset) = data.asUint256CdUnchecked(offset);
        (permit2Data.deadline,  offset) = data.asUint32CdUnchecked(offset);
        (permit2Data.signature, offset) = data.sliceCdUnchecked(offset, PERMIT2_SIGNATURE_SIZE);
        (gaslessFeeUsdc,        offset) = data.asUint64CdUnchecked(offset);
        ( transferUsdc,
          destinationDomain,
          mintRecipient,
          gasDropoffMicroGasToken,
          route,
          maxFastFeeUsdc,
          offset
        ) = _gaslessTransferWithRelay(permit2Data, gaslessFeeUsdc, data, offset);
      }
      else
        _invalidId();

      _requestRelay(
        transferUsdc,
        destinationDomain,
        mintRecipient,
        gasDropoffMicroGasToken,
        route,
        maxFastFeeUsdc //always taken from the transfer amount
      );
    }
    else {
      _checkZeroMsgValue();

      while (true) {
        if (id == UPDATE_FEE_ADJUSTMENTS_ID) {
          uint8 feeType;
          uint8 mappingIndex;
          uint256 feeAdjustments;
          (feeType,        offset) = data.asUint8CdUnchecked(offset);
          (mappingIndex,   offset) = data.asUint8CdUnchecked(offset);
          (feeAdjustments, offset) = data.asUint256CdUnchecked(offset);
          _updateFeeAdjustments(feeType, mappingIndex, feeAdjustments);
        }
        else if (id == OWNER_SWEEP_TOKENS_ID) {
          address token;
          uint256 amount;
          (token,  offset) = data.asAddressCdUnchecked(offset);
          (amount, offset) = data.asUint256CdUnchecked(offset);
          _sweepTokens(token, amount);
        }
        else if (
          eagerOr(id == OWNER_UPDATE_FEE_RECIPIENT_ID,
          eagerOr(id == OWNER_UPDATE_FEE_ADJUSTER_ID,
          eagerOr(id == OWNER_UPDATE_OFFCHAIN_QUOTER_ID,
                  id == OWNER_PROPOSE_OWNERSHIP_TRANSFER_ID)))
        ) {
          address addr;
          (addr, offset) = data.asAddressCdUnchecked(offset);
          if (id == OWNER_UPDATE_FEE_RECIPIENT_ID)
            _updateFeeRecipient(addr);
          else if (id == OWNER_UPDATE_FEE_ADJUSTER_ID)
            _updateFeeAdjuster(addr);
          else if (id == OWNER_UPDATE_OFFCHAIN_QUOTER_ID)
            _updateOffchainQuoter(addr);
          else
            _proposeOwnershipTransfer(addr);
        }
        else if (id == OWNER_ACCEPT_OWNERSHIP_TRANSFER_ID)
          _acceptOwnership();
        else if (id == OWNER_CANCEL_OWNERSHIP_TRANSFER_ID)
          _cancelOwnershipTransfer();
        else if (id == OWNER_SET_CHAIN_ID_FOR_DOMAIN_ID) {
          uint8 domain;
          uint16 chainId;
          (domain,  offset) = data.asUint8CdUnchecked(offset);
          (chainId, offset) = data.asUint16CdUnchecked(offset);
          _updateChainIdForDomain(domain, chainId);
        }
        else
          _invalidId();

        if (offset >= data.length)
          break;

        (id, offset) = data.asUint8CdUnchecked(offset);
      }
    }

    data.length.checkLength(offset);

    return new bytes(0);
  }}

  function _get(bytes calldata data) internal view override returns (bytes memory ret) { unchecked {
    uint offset = 0;
    while (offset < data.length) {
      uint8 query;
      (query, offset) = data.asUint8CdUnchecked(offset);
      bool isUsdQuery = query == QUERY_RELAY_IN_USDC_ID;
      require(eagerOr(isUsdQuery, query == QUERY_RELAY_IN_GAS_TOKEN_ID), "Invalid query");
      uint8 destinationDomain; //deliberately read as uint8
      uint8 routeRaw;
      uint32 gasDropoffMicroGasToken;
      (destinationDomain,       offset) = data.asUint8CdUnchecked(offset);
      (routeRaw,                offset) = data.asUint8CdUnchecked(offset);
      (gasDropoffMicroGasToken, offset) = data.asUint32CdUnchecked(offset);
      Route route = Route(routeRaw);

      function(uint8,Route,uint32) internal view returns (uint) quoteFunction = isUsdQuery
        ? _quoteInUsdc
        : _quoteInGasToken;

      ret = abi.encodePacked(ret, quoteFunction(
        destinationDomain,
        route,
        gasDropoffMicroGasToken
      ));
    }
    data.length.checkLength(offset);
    return ret;
  }}

  function _userTransferWithRelay(
    bytes calldata data,
    uint offset
  ) private returns (
    uint    transferUsdc,
    uint8   destinationDomain,
    bytes32 mintRecipient,
    uint32  gasDropoffMicroGasToken,
    Route   route,
    uint    maxFastFeeUsdc,
    uint    newOffset
  ) { unchecked {
    uint inputUsdc; uint quoteType;
    ( inputUsdc,
      destinationDomain,
      mintRecipient,
      gasDropoffMicroGasToken,
      route,
      maxFastFeeUsdc,
      quoteType,
      offset
    ) = _parseTransferCommonFields(data, offset);

    if (quoteType == QUOTE_OFF_CHAIN) {
      ( uint32 expirationTime,
        bool chargeInUsdc,
        uint relayFee,
        bytes32 r,
        bytes32 s,
        uint8 v,
        uint offset2
      ) = _parseOffChainQuote(data, offset);
      offset = offset2;

      _verifyOffChainQuote(
        destinationDomain,
        route,
        gasDropoffMicroGasToken,
        expirationTime,
        chargeInUsdc,
        relayFee,
        r, s, v
      );

      if (chargeInUsdc) {
        require(msg.value == 0, "msg.value > 0 but charging relayFee in usdc");
        _transferSenderUsdcRelayFee(relayFee);
      }
      else {
        require(msg.value == relayFee, "msg.value != signed relayFee");
        _transferGasToken(_feeRecipient, relayFee);
      }
      transferUsdc = inputUsdc; //offChain quotes always take relay fees from the allowance
    }
    else if (quoteType == QUOTE_ON_CHAIN_USDC) {
      uint maxRelayFeeUsdc; bool takeRelayFeeFromInput;
      (maxRelayFeeUsdc, takeRelayFeeFromInput, offset) = _parseOnChainUsdcQuote(data, offset);

      uint relayFeeUsdc = _quoteInUsdc(destinationDomain, route, gasDropoffMicroGasToken);
      require(
        eagerAnd(
          relayFeeUsdc <= maxRelayFeeUsdc,
          eagerOr(!takeRelayFeeFromInput, relayFeeUsdc < inputUsdc)
        ),
        "usd relay fee exceeds input amount"
      );
      _transferSenderUsdcRelayFee(relayFeeUsdc);
      transferUsdc = takeRelayFeeFromInput ? inputUsdc - relayFeeUsdc : inputUsdc;
    }
    else if (quoteType == QUOTE_ON_CHAIN_GAS) {
      uint relayFeeGasToken = _quoteInGasToken(destinationDomain, route, gasDropoffMicroGasToken);
      require(relayFeeGasToken <= msg.value, "Gas token relay fee exceeds msg.value");
      _transferGasToken(_feeRecipient, relayFeeGasToken);
      emit RelayFeeGasTokenPayment(relayFeeGasToken);
      _transferGasToken(msg.sender, msg.value - relayFeeGasToken);
      transferUsdc = inputUsdc;
    }
    else
      revert("Invalid quote type");

    _acquireUsdcFromSender(transferUsdc);

    newOffset = offset;
  }}

  function _gaslessTransferWithRelay(
    Permit2Data memory permit2Data,
    uint gaslessFeeUsdc,
    bytes calldata data,
    uint offset
  ) private returns (
    uint    transferUsdc,
    uint8   destinationDomain,
    bytes32 mintRecipient,
    uint32  gasDropoffMicroGasToken,
    Route   route,
    uint    maxFastFeeUsdc,
    uint    newOffset
) { unchecked {
    uint inputUsdc; uint quoteType;
    ( inputUsdc,
      destinationDomain,
      mintRecipient,
      gasDropoffMicroGasToken,
      route,
      maxFastFeeUsdc,
      quoteType,
      offset
    ) = _parseTransferCommonFields(data, offset);

    transferUsdc = inputUsdc;
    uint requiredAmount = inputUsdc + gaslessFeeUsdc;
    uint relayFeeUsdc;
    uint maxRelayFeeUsdc;
    bool isOnChainQuote;
    if (quoteType == QUOTE_OFF_CHAIN) {
      uint32 expirationTime; bool chargeInUsdc; bytes32 r; bytes32 s; uint8 v;
      (expirationTime, chargeInUsdc, relayFeeUsdc, r, s, v, offset) =
        _parseOffChainQuote(data, offset);

      require(chargeInUsdc, "Gasless but !chargeInUsdc");

      _verifyOffChainQuote(
        destinationDomain,
        route,
        gasDropoffMicroGasToken,
        expirationTime,
        chargeInUsdc,
        relayFeeUsdc,
        r, s, v
      );

      requiredAmount += relayFeeUsdc;
      require(permit2Data.amount == requiredAmount, "Invalid amount");
      maxRelayFeeUsdc = relayFeeUsdc;
      isOnChainQuote = false;
    }
    else {
      require(quoteType == QUOTE_ON_CHAIN_USDC, "Invalid quote type");
      bool takeRelayFeeFromInput;
      (maxRelayFeeUsdc, takeRelayFeeFromInput, offset) = _parseOnChainUsdcQuote(data, offset);

      relayFeeUsdc = _quoteInUsdc(destinationDomain, route, gasDropoffMicroGasToken);
      require(relayFeeUsdc <= maxRelayFeeUsdc, "Relay fee > max");
      if (takeRelayFeeFromInput) {
        require(relayFeeUsdc < inputUsdc, "Insufficient input");
        transferUsdc -= relayFeeUsdc;
      }
      else
        requiredAmount += relayFeeUsdc;

      isOnChainQuote = true;
    }

    _redeemPermit2WithWitness(
      requiredAmount,
      permit2Data,
      inputUsdc,
      destinationDomain,
      mintRecipient,
      gasDropoffMicroGasToken,
      route,
      maxFastFeeUsdc,
      gaslessFeeUsdc,
      maxRelayFeeUsdc,
      isOnChainQuote
    );

    _transferThisUsdcRelayFee(gaslessFeeUsdc + relayFeeUsdc);

    newOffset = offset;
  }}

  function _checkZeroMsgValue() private view {
    require(msg.value == 0, "nonzero msg.value");
  }

  function _invalidId() private pure {
    revert("Invalid id");
  }

  function _parseTransferCommonFields(bytes calldata data, uint offset) private pure returns (
    uint    inputUsdc,
    uint8   destinationDomain, //deliberately read as uint8
    bytes32 mintRecipient,
    uint32  gasDropoffMicroGasToken,
    Route   route,
    uint    maxFastFeeUsdc,
    uint    quoteType,
    uint    newOffset
  ) {
    (inputUsdc,               offset) = data.asUint64CdUnchecked(offset);
    (destinationDomain,       offset) = data.asUint8CdUnchecked(offset);
    (mintRecipient,           offset) = data.asBytes32CdUnchecked(offset);
    (gasDropoffMicroGasToken, offset) = data.asUint32CdUnchecked(offset);
    (route, maxFastFeeUsdc,   offset) = _parseRoute(data, offset);
    (quoteType,               offset) = data.asUint8CdUnchecked(offset);
    newOffset = offset;
  }

  function _parseRoute(bytes calldata data, uint offset) private pure returns (
    Route route,
    uint  maxFastFeeUsdc,
    uint  newOffset
  ) {
    uint8 routeRaw;
    (routeRaw, offset) = data.asUint8CdUnchecked(offset);
    route = Route(routeRaw);
    if (route != Route.V1)
      (maxFastFeeUsdc, offset) = data.asUint64CdUnchecked(offset);
    newOffset = offset;
  }

  function _parseOffChainQuote(bytes calldata data, uint offset) private pure returns (
    uint32  expirationTime,
    bool    chargeInUsdc,
    uint    relayFee,
    bytes32 r,
    bytes32 s,
    uint8   v,
    uint    newOffset
  ) {
    (expirationTime, offset) = data.asUint32CdUnchecked(offset);
    (chargeInUsdc,   offset) = data.asBoolCdUnchecked(offset);
    (relayFee,       offset) = chargeInUsdc
      ? data.asUint64CdUnchecked(offset)
      : data.asUint128CdUnchecked(offset);
    (r,              offset) = data.asBytes32CdUnchecked(offset);
    (s,              offset) = data.asBytes32CdUnchecked(offset);
    (v,              offset) = data.asUint8CdUnchecked(offset);
    newOffset = offset;
  }

  function _parseOnChainUsdcQuote(bytes calldata data, uint offset) private pure returns (
    uint maxRelayFeeUsdc,
    bool takeRelayFeeFromInput,
    uint newOffset
  ) {
    (maxRelayFeeUsdc,       offset) = data.asUint64CdUnchecked(offset);
    (takeRelayFeeFromInput, offset) = data.asBoolCdUnchecked(offset);
    newOffset = offset;
  }
}
