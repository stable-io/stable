// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.28;

import "./CctpRTestBase.t.sol";

import {ISignatureTransfer} from "permit2/interfaces/ISignatureTransfer.sol";
import {IERC20Permit}         from "wormhole-sdk/interfaces/token/IERC20Permit.sol";
import {IMessageTransmitter}  from "wormhole-sdk/interfaces/cctp/IMessageTransmitter.sol";
import {ITokenMessenger}      from "wormhole-sdk/interfaces/cctp/ITokenMessenger.sol";
import {LogUtils}             from "wormhole-sdk/testing/LogUtils.sol";
import {IUSDC, UsdcDealer}    from "wormhole-sdk/testing/UsdcDealer.sol";
import {CctpOverride}         from "wormhole-sdk/testing/CctpOverride.sol";
import {
  CctpMessageLib,
  CctpTokenBurnMessage}       from "wormhole-sdk/libraries/CctpMessages.sol";
import {BytesParsing}         from "wormhole-sdk/libraries/BytesParsing.sol";
import {PermitParsing}        from "wormhole-sdk/libraries/PermitParsing.sol";
import {toUniversalAddress}   from "wormhole-sdk/Utils.sol";

import "cctp-xr/assets/CctpRIds.sol";
import {WITNESS_TYPE_STRING} from "cctp-xr/assets/CctpRUser.sol";
import {
  QUOTE_OFF_CHAIN,
  QUOTE_ON_CHAIN_USDC,
  QUOTE_ON_CHAIN_GAS
} from "cctp-xr/CctpR.sol";
import {CctpGasDropoff} from "cctp-xr/CctpGasDropoff.sol";
import {AvaxRouter} from "cctp-xr/AvaxRouter.sol";
import "./CctpMessagesV2.sol";
import "./CctpOverrideV2.sol";

contract RequestRelay is CctpRTestBase {
  using CctpOverride for IMessageTransmitter;
  using CctpOverrideV2 for IMessageTransmitterV2;
  using UsdcDealer for IUSDC;
  using CctpMessageLib for CctpTokenBurnMessage;
  using CctpMessageV2Lib for CctpTokenBurnMessageV2;
  using LogUtils for Vm.Log[];
  using PermitParsing for bytes;
  using BytesParsing for bytes;

  uint constant MEGA = 1e6;
  string constant PERMIT2_TRANSFER_TYPEHASH_STUB = "PermitWitnessTransferFrom("
    "TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,";
  bytes32 constant PERMIT2_TOKEN_PERMISSIONS_TYPEHASH =
    keccak256("TokenPermissions(address token,uint256 amount)");


  enum QuoteType {
    OffChainUsdc,
    OffChainGas,
    OnChainUsdcTakeFromInput,
    OnChainUsdcTakeFromAllowance,
    OnChainGas
  }

  address immutable user;
  uint256 immutable userSecret;

  constructor() CctpRTestBase() {
    (user, userSecret) = makeAddrAndKey("user");
  }

  function setUp() public override {
    super.setUp();
    selectFork(BASE);
    cctpMessageTransmitterV2().setUpOverride();
    selectFork(AVALANCHE);
    cctpMessageTransmitterV2().setUpOverride();
    selectFork(ETHEREUM);
  }

  function testTransferAvaxHop() public {
    uint userUsdc = 100 * MEGA;
    uint32 gasDropoffMicroGasToken = 1000;
    uint maxFastFee = userUsdc/2;

    uint quote = _quoteRelay(
      CCTP_DOMAIN_BASE,
      Route.AvaxHop,
      gasDropoffMicroGasToken,
      false
    );

    bytes memory call = abi.encodePacked(
      TRANSFER_WITH_RELAY_WITH_PERMIT_ID,
      _createPermit(userUsdc, address(cctpR)),
      uint64(userUsdc),
      uint8(CCTP_DOMAIN_BASE),
      toUniversalAddress(user),
      gasDropoffMicroGasToken,
      Route.AvaxHop,
      uint64(maxFastFee),
      QUOTE_ON_CHAIN_GAS
    );

    usdc().deal(user, userUsdc);
    hoax(user);
    vm.recordLogs();
    _cctpRExec(call, quote);

    Vm.Log[] memory logs = vm.getRecordedLogs();

    CctpTokenBurnMessageV2[] memory burnMessagesV2 =
      cctpMessageTransmitterV2().fetchBurnMessages(logs);
    assertEq(burnMessagesV2.length, 1, "burnMessages.length");
    CctpTokenBurnMessageV2 memory burnMessageV2 = burnMessagesV2[0];
    assertEq(burnMessageV2.header.destinationDomain, CCTP_DOMAIN_AVALANCHE, "destinationDomain");
    assertEq(burnMessageV2.header.nonce, bytes32(0), "nonce");
    assertEq(burnMessageV2.header.destinationCaller,
             toUniversalAddress(avaxRouter),
             "destinationCaller");
    assertEq(burnMessageV2.header.minFinalityThreshold, 500, "minFinalityThreshold");
    assertEq(burnMessageV2.header.finalityThresholdExecuted, 0, "finalityThresholdExecuted");
    assertEq(burnMessageV2.body.mintRecipient, toUniversalAddress(avaxRouter), "mintRecipient");
    assertEq(burnMessageV2.body.amount, userUsdc, "amount");
    assertEq(burnMessageV2.body.maxFee, maxFastFee, "maxFee");
    assertEq(burnMessageV2.body.feeExecuted, 0, "feeExecuted");
    assertEq(burnMessageV2.body.expirationBlock, 0, "expirationBlock");
    assertEq(burnMessageV2.body.messageSender, toUniversalAddress(cctpR), "messageSender");
    assertEq(
      burnMessageV2.body.hookData,
      abi.encodePacked(uint8(CCTP_DOMAIN_BASE), toUniversalAddress(user), gasDropoffMicroGasToken),
      "hookData"
    );

    selectFork(AVALANCHE);

    burnMessageV2.header.nonce = bytes32(uint256(1337));
    burnMessageV2.header.finalityThresholdExecuted = burnMessageV2.header.minFinalityThreshold;
    burnMessageV2.body.feeExecuted = burnMessageV2.body.maxFee/2;
    burnMessageV2.body.expirationBlock = uint32(block.number + 100);

    bytes memory attestationV2 = cctpMessageTransmitterV2().sign(burnMessageV2);

    uint64 expectedNonce = cctpMessageTransmitter().nextAvailableNonce();

    vm.recordLogs();
    AvaxRouter(avaxRouter).relay(burnMessageV2.encode(), attestationV2);

    logs = vm.getRecordedLogs();

    CctpTokenBurnMessage[] memory burnMessages = cctpMessageTransmitter().fetchBurnMessages(logs);
    assertEq(burnMessages.length, 1, "burnMessages.length");
    CctpTokenBurnMessage memory burnMessage = burnMessages[0];
    assertEq(burnMessage.header.destinationDomain, CCTP_DOMAIN_BASE, "destinationDomain");
    assertEq(burnMessage.header.destinationCaller, bytes32(0), "destinationCaller");
    assertEq(burnMessage.body.mintRecipient, toUniversalAddress(user), "mintRecipient");
    assertEq(burnMessage.body.amount, userUsdc - burnMessageV2.body.feeExecuted, "amount");

    Vm.Log[] memory avaxRouterLogs = logs.filter(address(avaxRouter));
    assertEq(avaxRouterLogs[0].topics.length, 1, "topics.length");
    assertEq(avaxRouterLogs[0].topics[0],
             keccak256("RelayRequest(uint32,bytes32,uint64,uint32)"),
             "avax RelayRequest topic");
    bytes memory expectedEventData = abi.encode(
      CCTP_DOMAIN_ETHEREUM,
      toUniversalAddress(cctpR),
      expectedNonce,
      gasDropoffMicroGasToken
    );
    assertEq(avaxRouterLogs[0].data, expectedEventData, "avax event data");

    selectFork(BASE);

    bytes memory attestation = cctpMessageTransmitter().sign(burnMessage);

    uint userUsdcBalanceBefore = usdc().balanceOf(user);
    uint userGasBalanceBefore = address(user).balance;
    CctpGasDropoff(cctpGasDropoff).relayWithGasDropoff{value: uint(gasDropoffMicroGasToken) * 1e12}(
      burnMessage.encode(),
      attestation
    );
    uint userGasReceived = address(user).balance - userGasBalanceBefore;
    assertEq(userGasReceived, uint(gasDropoffMicroGasToken) * 1e12, "userGasBalance");

    uint userUsdcReceived = usdc().balanceOf(user) - userUsdcBalanceBefore;
    assertEq(userUsdcReceived, burnMessage.body.amount, "userUsdcBalance");
  }

  function testTransferV2() public {
    //fee payment logic etc. is all the same as for v1, so we only test the v2 specific path here
    uint userUsdc = 100 * MEGA;
    uint32 gasDropoffMicroGasToken = 1000;
    uint maxFastFee = userUsdc/2;

    uint quote = _quoteRelay(
      CCTP_DOMAIN_BASE,
      Route.V2Direct,
      gasDropoffMicroGasToken,
      false
    );

    bytes memory call = abi.encodePacked(
      TRANSFER_WITH_RELAY_WITH_PERMIT_ID,
      _createPermit(userUsdc, address(cctpR)),
      uint64(userUsdc),
      uint8(CCTP_DOMAIN_BASE),
      toUniversalAddress(user),
      gasDropoffMicroGasToken,
      Route.V2Direct,
      uint64(maxFastFee),
      QUOTE_ON_CHAIN_GAS
    );

    usdc().deal(user, userUsdc);
    hoax(user);
    vm.recordLogs();
    _cctpRExec(call, quote);

    Vm.Log[] memory logs = vm.getRecordedLogs();

    CctpTokenBurnMessageV2[] memory burnMessages =
      cctpMessageTransmitterV2().fetchBurnMessages(logs);
    assertEq(burnMessages.length, 1, "burnMessages.length");
    CctpTokenBurnMessageV2 memory burnMessage = burnMessages[0];
    assertEq(burnMessage.header.destinationDomain, CCTP_DOMAIN_BASE, "destinationDomain");
    assertEq(burnMessage.header.destinationCaller, bytes32(0), "destinationCaller");
    assertEq(burnMessage.header.nonce, bytes32(0), "nonce");
    assertEq(burnMessage.header.minFinalityThreshold, 500, "minFinalityThreshold");
    assertEq(burnMessage.header.finalityThresholdExecuted, 0, "finalityThresholdExecuted");
    assertEq(burnMessage.body.mintRecipient, toUniversalAddress(user), "mintRecipient");
    assertEq(burnMessage.body.amount, userUsdc, "amount");
    assertEq(burnMessage.body.maxFee, maxFastFee, "maxFee");
    assertEq(burnMessage.body.feeExecuted, 0, "feeExecuted");
    assertEq(burnMessage.body.expirationBlock, 0, "expirationBlock");
    assertEq(burnMessage.body.messageSender, toUniversalAddress(cctpR), "messageSender");
    assertEq(burnMessage.body.hookData.length, 0, "hookData.length");

    selectFork(BASE);

    burnMessage.header.nonce = bytes32(uint256(1337));
    burnMessage.header.finalityThresholdExecuted = burnMessage.header.minFinalityThreshold;
    burnMessage.body.feeExecuted = burnMessage.body.maxFee/2;
    burnMessage.body.expirationBlock = uint32(block.number + 100);

    bytes memory attestation = cctpMessageTransmitterV2().sign(burnMessage);

    uint userUsdcBalanceBefore = usdc().balanceOf(user);
    uint userGasBalanceBefore = address(user).balance;
    CctpGasDropoff(cctpGasDropoff).relayWithGasDropoff{value: uint(gasDropoffMicroGasToken) * 1e12}(
      burnMessage.encode(),
      attestation
    );
    uint userGasReceived = address(user).balance - userGasBalanceBefore;
    assertEq(userGasReceived, uint(gasDropoffMicroGasToken) * 1e12, "userGasBalance");

    uint userUsdcReceived = usdc().balanceOf(user) - userUsdcBalanceBefore;
    uint expectedReceived = burnMessage.body.amount - burnMessage.body.feeExecuted;
    assertEq(userUsdcReceived, expectedReceived, "userUsdcBalance");
  }

  function testTransferV1() public {
    for (uint withGasDropoff = 0; withGasDropoff < 2; ++withGasDropoff)
      for (uint permitType = 0; permitType < 3; ++permitType)
        for (uint quoteTypeRaw = 0; quoteTypeRaw < 5; ++quoteTypeRaw)
          for (uint destinationDomain = 0; destinationDomain < 3; ++destinationDomain)
            for (uint withError = 0; withError < 2; ++withError) {
              QuoteType quoteType = QuoteType(quoteTypeRaw);
              if (permitType == 2 && (
                quoteType == QuoteType.OffChainGas ||
                quoteType == QuoteType.OnChainGas
              ))
                continue;
              _runTransferV1Test(
                uint8(
                  destinationDomain == 0
                  ? CCTP_DOMAIN_BASE
                  : destinationDomain == 1
                  ? CCTP_DOMAIN_SOLANA
                  : CCTP_DOMAIN_SUI
                ),
                withGasDropoff != 0,
                permitType,
                quoteType,
                withError != 0,
                false //set to true (or some condition) to enable debug logs
              );
            }
  }

  struct StackVars {
    bool onChainQuoteInUsdc;
    bool paymentInUsdc;
    uint userUsdc;
    uint32 gasDropoffMicroGasToken;
    bool takeFeeFromInput;
    uint64 expectedNonce;
    uint quote;
    uint maxFeeUsd;
    uint gaslessFee;
    uint approveAmount;
    uint value;
  }

  function _runTransferV1Test(
    uint8 destinationDomain,
    bool withGasDropoff,
    uint permitType,
    QuoteType quoteType,
    bool withError, //exceed max fee for on-chain quotes, or invalid timestamp for off-chain quotes
    bool logDebug
  ) preserveFork() private {
    StackVars memory vars;
    vars.onChainQuoteInUsdc =
      quoteType == QuoteType.OnChainUsdcTakeFromInput ||
      quoteType == QuoteType.OnChainUsdcTakeFromAllowance;

    vars.paymentInUsdc = quoteType == QuoteType.OffChainUsdc || vars.onChainQuoteInUsdc;
    vars.userUsdc = 100 * MEGA;
    vars.gaslessFee = permitType == 2 ? 420_000 : 0;
    vars.gasDropoffMicroGasToken = withGasDropoff ? uint32(1000) : 0;
    vars.takeFeeFromInput = quoteType == QuoteType.OnChainUsdcTakeFromInput;
    vars.expectedNonce = cctpMessageTransmitter().nextAvailableNonce();
    vars.quote = _quoteRelay(
      destinationDomain,
      Route.V1,
      vars.gasDropoffMicroGasToken,
      vars.paymentInUsdc
    );

    vars.maxFeeUsd = vars.onChainQuoteInUsdc
      ? vars.quote - (withError && permitType != 2 ? 1 : 0)
      : 0;

    vars.approveAmount = vars.userUsdc + vars.gaslessFee +
      (vars.paymentInUsdc && !vars.takeFeeFromInput ? vars.quote : 0);

    usdc().deal(user, vars.approveAmount);

    if (permitType == 0) {
      vm.prank(user);
      usdc().approve(address(cctpR), vars.approveAmount);
    }

    bytes memory transferSpecificParams;
    if (quoteType == QuoteType.OffChainUsdc || quoteType == QuoteType.OffChainGas) {
      uint32 expirationTime = uint32(block.timestamp + (withError && permitType != 2 ? 0 : 1));
      bytes memory offChainQuote = abi.encodePacked(
        uint8(CCTP_DOMAIN_ETHEREUM),
        uint8(destinationDomain),
        Route.V1,
        uint32(vars.gasDropoffMicroGasToken),
        expirationTime,
        vars.paymentInUsdc,
        uint128(vars.quote)
      );
      bytes32 hash = keccak256(offChainQuote);
      (uint8 v, bytes32 r, bytes32 s) = vm.sign(offChainQuoterSecret, hash);

      transferSpecificParams = abi.encodePacked(
        QUOTE_OFF_CHAIN,
        expirationTime,
        vars.paymentInUsdc,
        vars.paymentInUsdc
        ? abi.encodePacked(uint64(vars.quote))
        : abi.encodePacked(uint128(vars.quote)),
        r, s, v
      );
    }
    else if (vars.onChainQuoteInUsdc)
      transferSpecificParams = abi.encodePacked(
        QUOTE_ON_CHAIN_USDC,
        uint64(vars.maxFeeUsd),
        quoteType == QuoteType.OnChainUsdcTakeFromInput
      );
    else //quoteType == QuoteType.OnChainGas
      transferSpecificParams = abi.encodePacked(QUOTE_ON_CHAIN_GAS);


    if (permitType == 2) {
      bytes memory permit = _createPermit(type(uint256).max, PERMIT2_ADDRESS);
      (uint256 value, uint256 deadline, bytes32 r, bytes32 s, uint8 v) =
        PermitParsing.decodePermitMem(permit);
      IERC20Permit(address(usdc())).permit(user, PERMIT2_ADDRESS, value, deadline, v, r, s);
    }

    bytes memory call = abi.encodePacked(
      permitType == 0
      ? abi.encodePacked(TRANSFER_WITH_RELAY_ID)
      : permitType == 1
      ? abi.encodePacked(
        TRANSFER_WITH_RELAY_WITH_PERMIT_ID,
        _createPermit(vars.approveAmount, address(cctpR))
      )
      : abi.encodePacked(
        TRANSFER_WITH_RELAY_GASLESS_ID,
        _createPermit2(
          withError,
          vars.approveAmount,
          destinationDomain,
          Route.V1,
          vars.userUsdc,
          vars.gasDropoffMicroGasToken,
          0, //maxFastFee
          vars.gaslessFee,
          quoteType == QuoteType.OffChainUsdc ? vars.quote :vars.maxFeeUsd,
          quoteType
        ),
        uint64(vars.gaslessFee)
      ),
      abi.encodePacked(
        uint64(vars.userUsdc),
        uint8(destinationDomain),
        toUniversalAddress(user),
        vars.gasDropoffMicroGasToken,
        Route.V1,
        transferSpecificParams
      )
    );

    vars.value = vars.paymentInUsdc ? 0 : vars.quote - (withError ? 1 : 0);

    //enable logs for debugging:
    if (logDebug) {
      console.log("TestCase:");
      console.log("    domain:        %s",
        destinationDomain == CCTP_DOMAIN_BASE
        ? "Base"
        : destinationDomain == CCTP_DOMAIN_SOLANA
        ? "Solana"
        : "Sui"
      );
      console.log("    permitType:    %s", permitType);
      console.log("    QuoteType:     %s",
        quoteType == QuoteType.OffChainUsdc
        ? "off-chain usdc"
        : quoteType == QuoteType.OffChainGas
        ? "off-chain gas"
        : quoteType == QuoteType.OnChainUsdcTakeFromInput
        ? "on-chain usdc take from input"
        : quoteType == QuoteType.OnChainUsdcTakeFromAllowance
        ? "on-chain usdc take from allowance"
        : "on-chain gas"
      );
      console.log("    withError:     %s", withError ? "yes" : "no");
      console.log("    dropoffAmount: %s", vars.gasDropoffMicroGasToken);
      console.log("    userUsdc:      %s", vars.userUsdc);
      console.log("    quote:         %s", vars.quote);
      console.log("    approveAmount: %s", vars.approveAmount);
      console.log("    maxFeeUsd:     %s", vars.maxFeeUsd);
      console.log("    value:         %s", vars.value);
      // console.logBytes(call);
    }

    if (withError) {
      vm.expectRevert();
      if (permitType != 2)
        hoax(user);
      _cctpRExec(call, vars.value);
      return;
    }

    uint feeRecipientBalanceBefore =
      vars.paymentInUsdc ? usdc().balanceOf(feeRecipient) : feeRecipient.balance;

    if (permitType != 2)
      hoax(user);
    vm.recordLogs();
    _cctpRExec(call, vars.value);

    uint feeRecipientBalanceAfter =
      vars.paymentInUsdc ? usdc().balanceOf(feeRecipient) : feeRecipient.balance;

    uint receivedFee = feeRecipientBalanceAfter - feeRecipientBalanceBefore;
    assertEq(receivedFee, vars.quote + vars.gaslessFee, "feeRecipientBalance");

    Vm.Log[] memory logs = vm.getRecordedLogs();

    CctpTokenBurnMessage[] memory burnMessages = cctpMessageTransmitter().fetchBurnMessages(logs);
    assertEq(burnMessages.length, 1, "burnMessages.length");
    CctpTokenBurnMessage memory burnMessage = burnMessages[0];
    assertEq(burnMessage.header.destinationDomain, destinationDomain, "destinationDomain");
    assertEq(burnMessage.header.nonce, vars.expectedNonce, "nonce");
    assertEq(burnMessage.header.destinationCaller, bytes32(0), "destinationCaller");
    assertEq(burnMessage.body.mintRecipient, toUniversalAddress(user), "mintRecipient");
    assertEq(burnMessage.body.amount,
             vars.userUsdc - (vars.takeFeeFromInput ? vars.quote : 0),
             "amount");

    Vm.Log[] memory cctpRLogs = logs.filter(address(cctpR));
    assertEq(cctpRLogs.length, quoteType == QuoteType.OnChainGas ? 2 : 1, "cctpRLogs.length");
    uint relayRequestLogIndex = 0;
    if (quoteType == QuoteType.OnChainGas) {
      relayRequestLogIndex = 1;
      assertEq(cctpRLogs[0].topics.length, 1, "topics.length");
      assertEq(cctpRLogs[0].topics[0],
               keccak256("RelayFeeGasTokenPayment(uint256)"),
               "RelayFeeGasTokenPayment topic");
      assertEq(cctpRLogs[0].data, abi.encode(vars.quote), "event data");
    }
    assertEq(cctpRLogs[relayRequestLogIndex].topics.length, 1, "topics.length");
    assertEq(cctpRLogs[relayRequestLogIndex].topics[0],
            keccak256("RelayRequest(uint64,uint32)"),
            "RelayRequest topic");
    assertEq(cctpRLogs[relayRequestLogIndex].data,
             abi.encode(vars.expectedNonce, vars.gasDropoffMicroGasToken),
             "event data");

    if (destinationDomain == CCTP_DOMAIN_BASE) {
      selectFork(BASE);
      bytes memory attestation = cctpMessageTransmitter().sign(burnMessage);
      uint userUsdcBalanceBefore = usdc().balanceOf(user);
      if (withGasDropoff) {
        uint userGasBalanceBefore = address(user).balance;
        CctpGasDropoff(cctpGasDropoff)
          .relayWithGasDropoff{value: uint(vars.gasDropoffMicroGasToken) * 1e12}(
            burnMessage.encode(),
            attestation
          );
        uint userGasReceived = address(user).balance - userGasBalanceBefore;
        assertEq(userGasReceived, uint(vars.gasDropoffMicroGasToken) * 1e12, "userGasBalance");
      }
      else
        cctpMessageTransmitter().receiveMessage(burnMessage.encode(), attestation);

      uint userUsdcReceived = usdc().balanceOf(user) - userUsdcBalanceBefore;
      assertEq(userUsdcReceived, burnMessage.body.amount, "userUsdcBalance");
    }
  }

  function _createPermit(
    uint256 amount,
    address spender
  ) private view returns (bytes memory permit) {
    IERC20Permit usdcPermit = IERC20Permit(address(usdc()));
    uint256 deadline = block.timestamp + 1800;
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(
      userSecret,
      keccak256(abi.encodePacked(
        hex"1901",
        usdcPermit.DOMAIN_SEPARATOR(),
        keccak256(abi.encode(
          keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
          ),
          user,
          spender,
          amount,
          usdcPermit.nonces(user),
          deadline
        ))
      ))
    );
    permit = abi.encodePacked(amount, deadline, r, s, v);
  }

  function _createPermit2(
    bool withError,
    uint amount,
    uint destinationDomain,
    Route corridor,
    uint baseAmount,
    uint32 microGasDropoff,
    uint maxFastFee,
    uint gaslessFee,
    uint maxRelayFee,
    QuoteType quoteType
  ) private view returns (bytes memory permit2TFwW) {
    bytes32 typehash = keccak256(abi.encodePacked(
      PERMIT2_TRANSFER_TYPEHASH_STUB,
      WITNESS_TYPE_STRING
    ));

    bytes32 witness = keccak256(abi.encode(
      baseAmount,
      destinationDomain,
      toUniversalAddress(user),
      microGasDropoff,
      corridor == Route.V1
        ? "CCTPv1"
        : corridor == Route.V2Direct
        ? "CCTPv2"
        : "CCTPv2ToAvalancheThenCCTPv1",
      maxFastFee,
      gaslessFee,
      maxRelayFee,
      quoteType == QuoteType.OffChainUsdc ? "OffChain" : "OnChain"
    ));

    ISignatureTransfer.TokenPermissions memory tokenPermissions =
      ISignatureTransfer.TokenPermissions(address(usdc()), amount);

    uint nonce = uint(keccak256(
      abi.encodePacked(destinationDomain, uint(quoteType), maxFastFee, maxRelayFee)
    ));

    uint deadline = block.timestamp + 1800;
    bytes32 msgHash = keccak256(
      abi.encodePacked(
        hex"1901",
        IERC20Permit(PERMIT2_ADDRESS).DOMAIN_SEPARATOR(),
        keccak256(abi.encode(
          typehash,
          keccak256(abi.encode(PERMIT2_TOKEN_PERMISSIONS_TYPEHASH, tokenPermissions)),
          address(cctpR),
          nonce,
          deadline,
          witness
        ))
      )
    );

    (uint8 v, bytes32 r, bytes32 s) = vm.sign(userSecret, msgHash);
    if (withError)
      s = r;

    return abi.encodePacked(user, uint64(amount), nonce, uint32(deadline), r, s, v);
  }
}
