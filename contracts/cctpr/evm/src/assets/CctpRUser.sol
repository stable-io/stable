// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

pragma solidity ^0.8.28;

import {IPermit2} from "permit2/interfaces/IPermit2.sol";
import {ISignatureTransfer} from "permit2/interfaces/ISignatureTransfer.sol";
import {CCTP_DOMAIN_AVALANCHE} from "wormhole-sdk/constants/CctpDomains.sol";
import {ITokenMessenger}       from "wormhole-sdk/interfaces/cctp/ITokenMessenger.sol";
import {IERC20Permit}          from "wormhole-sdk/interfaces/token/IERC20Permit.sol";
import {SafeERC20}             from "wormhole-sdk/libraries/SafeERC20.sol";
import {toUniversalAddress}    from "wormhole-sdk/Utils.sol";

import {ITokenMessengerV2} from "cctp-xr/interfaces/ITokenMessengerV2.sol";
import {Route}             from "cctp-xr/assets/CctpRBase.sol";
import {CctpRQuote}       from "cctp-xr/assets/CctpRQuote.sol";

//see https://github.com/circlefin/evm-cctp-contracts/blob/63ab1f0ac06ce0793c0bbfbb8d09816bc211386d/src/v2/FinalityThresholds.sol#L27
uint32 constant TOKEN_MESSENGER_V2_MIN_FINALITY_THRESHOLD = 500;

string constant WITNESS_TYPE_STRING =
  "TransferWithRelayWitness parameters)"
  //if amount == baseAmount, then all fees are taken from baseAmount
  //otherwise, amount must equal baseAmount + gaslessFee + maxRelayFee
  //  (and baseAmount - fastFee will be transferred)
  "TokenPermissions(address token,uint256 amount)"
  "TransferWithRelayWitness("
    "uint64 baseAmount,"
    "uint8 destinationDomain,"
    "bytes32 mintRecipient,"
    "uint32 microGasDropoff,"
    "string corridor," //"CCTPv1", "CCTPv2", or "CCTPv2->Avalanche->CCTPv1"
    "uint64 maxFastFee," //must be 0 for v1 corridor
    "uint64 gaslessFee,"
    "uint64 maxRelayFee," //for off-chain quotes, this is the exact relay fee
    "string quoteSource" //"OffChain" or "OnChain"
  ")";

struct Permit2Data {
  address spender;
  uint256 amount;
  uint256 nonce;
  uint32  deadline;
  bytes   signature;
}

abstract contract CctpRUser is CctpRQuote {
  //for v2 transfers, the cctpNonce is always 0
  //gasDropoffMicroGasToken always corresponds to the next leg of the trip, meaning that for
  //  v1 and v2Dirct transfers, it will straight-forwardly contain the amount that the user
  //  requested, but for the avax hop, it will be 0 (because the first leg of the trip does not
  //  have a gas dropoff), while the true value is stored in the cctp v2 hookdata and is emitted
  //  by the avax router contract in its event that triggers the second leg of the trip (which
  //  actually has to deliver the gas dropoff)
  event RelayRequest(uint64 cctpNonce, uint32 gasDropoffMicroGasToken);
  //allows tracking of charged relay fees from events and calldata:
  //when quoting off-chain, the relay fee can be deduced from the quote calldata
  //when quoting on-chain in usdc, there's the associated ERC20 transfer event to the fee recipient
  //when quoting on-chain in gas token, we use the RelayFeeGasTokenPayment event for tracking
  event RelayFeeGasTokenPayment(uint256 amount);

  IERC20Permit      private immutable _usdc;
  ITokenMessenger   private immutable _tokenMessengerV1;
  ITokenMessengerV2 private immutable _tokenMessengerV2;
  bytes32           private immutable _avaxRouter;
  IPermit2          private immutable _permit2;
  uint8             private immutable _sourceDomain;

  constructor(
    address usdc,
    address tokenMessengerV1,
    address tokenMessengerV2,
    address avaxRouter,
    address permit2
  ) {
    _usdc             = IERC20Permit(usdc);
    _tokenMessengerV1 = ITokenMessenger(tokenMessengerV1);
    _tokenMessengerV2 = ITokenMessengerV2(tokenMessengerV2);
    _avaxRouter       = toUniversalAddress(avaxRouter);
    _permit2          = IPermit2(permit2);
    _sourceDomain     = uint8(_tokenMessengerV1.localMessageTransmitter().localDomain());

    if (tokenMessengerV1 != address(0))
      _usdc.approve(tokenMessengerV1, type(uint256).max);
    if (tokenMessengerV2 != address(0))
      _usdc.approve(tokenMessengerV2, type(uint256).max);
  }

  function _redeemUserPermit(
    uint256 value,
    uint256 deadline,
    bytes32 r,
    bytes32 s,
    uint8 v
  ) internal {
    //allow failure to prevent front-running griefing attacks
    //  (i.e. getting permit from mempool and submitting it to the inputToken contract directly)
    try
      _usdc.permit(msg.sender, address(this), value, deadline, v, r, s) {}
    catch {}
  }

  function _redeemPermit2WithWitness(
    uint requiredAmount,
    Permit2Data memory permit2Data,
    uint baseAmount,
    uint8 destinationDomain,
    bytes32 mintRecipient,
    uint32 microGasDropoff,
    Route corridor,
    uint maxFastFee,
    uint gaslessFee,
    uint maxRelayFee,
    bool isOnChainQuote
  ) internal { unchecked {
    bytes32 witness = keccak256(abi.encode(
      baseAmount,
      destinationDomain,
      mintRecipient,
      microGasDropoff,
      corridor == Route.V1
        ? "CCTPv1"
        : corridor == Route.V2Direct
        ? "CCTPv2"
        : "CCTPv2->Avalanche->CCTPv1",
      maxFastFee,
      gaslessFee,
      maxRelayFee,
      isOnChainQuote ? "OnChain" : "OffChain"
    ));

    _permit2.permitWitnessTransferFrom(
      ISignatureTransfer.PermitTransferFrom(
        ISignatureTransfer.TokenPermissions(address(_usdc), permit2Data.amount),
        permit2Data.nonce,
        permit2Data.deadline
      ),
      ISignatureTransfer.SignatureTransferDetails(address(this), requiredAmount),
      permit2Data.spender,
      witness,
      WITNESS_TYPE_STRING,
      permit2Data.signature
    );
  }}

  function _verifyOffChainQuote(
    uint8 destinationDomain,
    Route route,
    uint32 gasDropoffMicroGasToken,
    uint32 expirationTime,
    bool chargeInUsdc,
    uint relayFee,
    bytes32 r,
    bytes32 s,
    uint8 v
  ) internal view {
    require(expirationTime > block.timestamp, "quote expired");
    address offChainQuoter = _offChainQuoter;
    require(offChainQuoter != address(0), "offChain quoting disabled");

    bytes32 hash = keccak256(abi.encodePacked(
      _sourceDomain,
      destinationDomain,
      route,
      gasDropoffMicroGasToken,
      expirationTime,
      chargeInUsdc,
      uint128(relayFee)
    ));

    require(ecrecover(hash, v, r, s) == offChainQuoter, "invalid quote signature");
  }

  function _requestRelay(
    uint transferUsdc,
    uint8 destinationDomain,
    bytes32 mintRecipient,
    uint32 gasDropoffMicroGasToken,
    Route route,
    uint maxFastFeeUsdc //only relevant for v2 transfers, 0 for v1
  ) internal {
    if (route == Route.V1) {
      uint64 cctpNonce = _tokenMessengerV1.depositForBurn(
        transferUsdc,
        destinationDomain,
        mintRecipient,
        address(_usdc)
      );

      emit RelayRequest(cctpNonce, gasDropoffMicroGasToken);
    }
    else if (route == Route.V2Direct) {
      _tokenMessengerV2.depositForBurn(
        transferUsdc,
        destinationDomain,
        mintRecipient,
        address(_usdc),
        bytes32(0), //destinationCaller -> anyone can redeem
        maxFastFeeUsdc,
        TOKEN_MESSENGER_V2_MIN_FINALITY_THRESHOLD
      );

      emit RelayRequest(0, gasDropoffMicroGasToken);
    }
    else { //route must equal Route.AvaxHop
      _tokenMessengerV2.depositForBurnWithHook(
        transferUsdc,
        CCTP_DOMAIN_AVALANCHE,
        _avaxRouter, //mint recipient
        address(_usdc),
        _avaxRouter, //destinationCaller
        maxFastFeeUsdc,
        TOKEN_MESSENGER_V2_MIN_FINALITY_THRESHOLD,
        abi.encodePacked(destinationDomain, mintRecipient, gasDropoffMicroGasToken)
      );

      emit RelayRequest(0, 0);
    }
  }

  function _acquireUsdcFromSender(uint amount) internal {
    SafeERC20.safeTransferFrom(_usdc, msg.sender, address(this), amount);
  }

  function _transferThisUsdcRelayFee(uint relayFeeUsdc) internal {
    if (relayFeeUsdc > 0)
      SafeERC20.safeTransfer(_usdc, _feeRecipient, relayFeeUsdc);
  }

  function _transferSenderUsdcRelayFee(uint relayFeeUsdc) internal {
    if (relayFeeUsdc > 0)
      SafeERC20.safeTransferFrom(_usdc, msg.sender, _feeRecipient, relayFeeUsdc);
  }

  function _transferGasToken(address to, uint value) internal {
    if (value > 0) {
      (bool success, ) = to.call{value: value}(new bytes(0));
      require(success, "gas token transfer failed");
    }
  }
}
