// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.28;

import "forge-std/Test.sol";

import {IERC20}           from "wormhole-sdk/interfaces/token/IERC20.sol";
import {Proxy}            from "wormhole-sdk/proxy/Proxy.sol";
import {WormholeForkTest} from "wormhole-sdk/testing/WormholeForkTest.sol";
import {reRevert}         from "wormhole-sdk/Utils.sol";

import {
  CHAIN_ID_SEPOLIA,
  CHAIN_ID_AVALANCHE,
  CHAIN_ID_BASE_SEPOLIA,
  CHAIN_ID_SOLANA,
  CHAIN_ID_SUI,
  CHAIN_ID_UNICHAIN
} from "wormhole-sdk/constants/Chains.sol";
import {
  CCTP_DOMAIN_ETHEREUM,
  CCTP_DOMAIN_AVALANCHE,
  CCTP_DOMAIN_BASE,
  CCTP_DOMAIN_SOLANA,
  CCTP_DOMAIN_SUI,
  CCTP_DOMAIN_UNICHAIN
} from "wormhole-sdk/constants/CctpDomains.sol";

import "price-oracle/assets/PriceOracleIds.sol";
import "price-oracle/assets/types/ParamLibs.sol";
import "price-oracle/assets/types/EvmFeeParams.sol";
import "price-oracle/assets/types/SolanaFeeParams.sol";
import "price-oracle/assets/types/SuiFeeParams.sol";
import "price-oracle/PriceOracle.sol";

import "cctp-xr/assets/CctpRIds.sol";
import {Route, ADJUSTMENTS_PER_SLOT, CHAIN_IDS_PER_SLOT} from "cctp-xr/assets/CctpRBase.sol";
import {CctpR} from "cctp-xr/CctpR.sol";
import {AvaxRouter} from "cctp-xr/AvaxRouter.sol";
import {CctpGasDropoff} from "cctp-xr/CctpGasDropoff.sol";
import {IMessageTransmitterV2} from "./CctpOverrideV2.sol";

//testing transfers from ethereum to base
contract CctpRTestBase is WormholeForkTest {
  bool   constant IS_MAINNET = false;
  uint16 constant ETHEREUM   = CHAIN_ID_SEPOLIA;
  uint16 constant AVALANCHE  = CHAIN_ID_AVALANCHE;
  uint16 constant BASE       = CHAIN_ID_BASE_SEPOLIA;
  uint16 constant SOLANA     = CHAIN_ID_SOLANA;
  uint16 constant SUI        = CHAIN_ID_SUI;
  uint16 constant UNICHAIN   = CHAIN_ID_UNICHAIN;
  // We setup a theoretical future EVM chain with a chain ID of 65000
  uint8  constant CCTP_DOMAIN_FUTURE_EVM = uint8(CHAIN_IDS_PER_SLOT);
  uint16 constant FUTURE_EVM = 65000;

  //see https://developers.circle.com/stablecoins/evm-smart-contracts
  address constant ETHEREUM_TOKEN_MESSENGER_V2      = 0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA;
  address constant ETHEREUM_MESSAGE_TRANSMITTER_V2  = 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275;
  address constant AVALANCHE_MESSAGE_TRANSMITTER_V2 = 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275;
  address constant BASE_MESSAGE_TRANSMITTER_V2      = 0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275;

  address constant PERMIT2_ADDRESS = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

  uint constant ETHEREUM_GAS_TOKEN_PRICE = 2_500; //usd

  uint constant AVALANCHE_GAS_TOKEN_PRICE = 24; //usd
  uint constant AVALANCHE_PRICE_PER_BYTE  =  0;
  uint constant AVALANCHE_GAS_PRICE       =  3 gwei;

  uint constant BASE_GAS_TOKEN_PRICE = ETHEREUM_GAS_TOKEN_PRICE;
  uint constant BASE_PRICE_PER_BYTE  = 1 gwei; //ass-pull number - how are L1 fees actually charged?
  uint constant BASE_GAS_PRICE       = 1 gwei / 1_000;

  uint constant SOLANA_GAS_TOKEN_PRICE   =     100; //usd
  uint constant SOLANA_COMPUTATION_COST  = 500_000; //microlamports/cu
  uint constant SOLANA_ACCOUNT_SIZE_COST =   6_960; //lamports/byte
  uint constant SOLANA_SIGNATURE_COST    =  10_000; //lamports

  uint constant SUI_GAS_TOKEN_PRICE   =     3; //usd
  uint constant SUI_COMPUTATION_PRICE =   750; //mist/cu
  uint constant SUI_STORAGE_PRICE     = 7_600; //mist/byte
  uint constant SUI_REBATE_PERCENTAGE =    99; //percentage

  int16 constant ONE_USD_DISCOUNT_FEE_ADJUSTMENT = -100; //1 usd discount
  int16 constant ONE_USD_OVERHEAD_FEE_ADJUSTMENT =  100; //1 usd base fee
  int16 constant AT_COST_ABSOLUTE_FEE_ADJUSTMENT =    0;
  uint8 constant AT_COST_RELATIVE_FEE_ADJUSTMENT =  100;
  uint8 constant DISCOUNT_BY_HALF_FEE_ADJUSTMENT =   50; //50% discount
  uint8 constant ADD_FIVE_PERCENT_FEE_ADJUSTMENT =  105; //5% overhead
  uint8 constant FULLY_DISCOUNTED_FEE_ADJUSTMENT =    0; //100% discount

  uint256 immutable MAX_FEE_ADJUSTMENTS; //set all fee adjustments to be maximally expensive

  address priceOracle;
  address cctpR;
  address avaxRouter;
  address cctpGasDropoff;

  address owner;
  address feeAdjuster;
  address feeRecipient;
  address offChainQuoter;
  uint256 offChainQuoterSecret;

  uint256[] v1Adjustments;
  uint256[] v2DirectAdjustments;
  uint256[] avaxHopAdjustments;
  uint256[] gasDropoffAdjustments;

  constructor() WormholeForkTest() {
    owner        = makeAddr("owner");
    feeAdjuster  = makeAddr("feeAdjuster");
    feeRecipient = makeAddr("feeRecipient");
    (offChainQuoter, offChainQuoterSecret) = makeAddrAndKey("offChainQuoter");
    uint256 feeAdjustment = (uint(uint16(type(int16).max)) << 8) + type(uint8).max;
    for (uint i = 0; i < ADJUSTMENTS_PER_SLOT; ++i)
      MAX_FEE_ADJUSTMENTS |= feeAdjustment << (i * 24);
  }

  function cctpMessageTransmitterV2() internal view returns (IMessageTransmitterV2) {
    if (chainId() == ETHEREUM)
      return IMessageTransmitterV2(ETHEREUM_MESSAGE_TRANSMITTER_V2);
    else if (chainId() == AVALANCHE)
      return IMessageTransmitterV2(AVALANCHE_MESSAGE_TRANSMITTER_V2);
    else
      return IMessageTransmitterV2(BASE_MESSAGE_TRANSMITTER_V2);
  }

  function setUp() public virtual override {
    isMainnet = IS_MAINNET;

    //deploy cctpGasDropoff on base
    setUpFork(BASE);
    selectFork(BASE);
    cctpGasDropoff = address(new CctpGasDropoff(
      address(cctpMessageTransmitter()),
      BASE_MESSAGE_TRANSMITTER_V2
    ));

    //deploy avaxRouter on avalanche
    setUpFork(AVALANCHE);
    selectFork(AVALANCHE);
    avaxRouter = address(new AvaxRouter(
      AVALANCHE_MESSAGE_TRANSMITTER_V2,
      address(cctpTokenMessenger()),
      address(usdc())
    ));

    //deploy cctpR on ethereum
    setUpFork(ETHEREUM);
    selectFork(ETHEREUM);
    EvmFeeParams avaxFeeParams = EvmFeeParams.wrap(0)
      .gasTokenPrice ( GasTokenPriceLib.to(AVALANCHE_GAS_TOKEN_PRICE * 1e18))
      .pricePerTxByte(PricePerTxByteLib.to(AVALANCHE_PRICE_PER_BYTE        ))
      .gasPrice      (      GasPriceLib.to(AVALANCHE_GAS_PRICE             ));

    EvmFeeParams baseFeeParams = EvmFeeParams.wrap(0)
      .gasTokenPrice ( GasTokenPriceLib.to(ETHEREUM_GAS_TOKEN_PRICE * 1e18))
      .pricePerTxByte(PricePerTxByteLib.to(BASE_PRICE_PER_BYTE            ))
      .gasPrice      (      GasPriceLib.to(BASE_GAS_PRICE                 ));

    SolanaFeeParams solanaFeeParams = SolanaFeeParams.wrap(0)
      .gasTokenPrice      (         GasTokenPriceLib.to(SOLANA_GAS_TOKEN_PRICE   * 1e18))
      .computationPrice   (SolanaComputationPriceLib.to(SOLANA_COMPUTATION_COST  * 1e3 ))
      .pricePerAccountByte(   PricePerAccountByteLib.to(SOLANA_ACCOUNT_SIZE_COST * 1e9 ))
      .signaturePrice     (        SignaturePriceLib.to(SOLANA_SIGNATURE_COST    * 1e9 ));

    SuiFeeParams suiFeeParams = SuiFeeParams.wrap(0)
      .gasTokenPrice   (      GasTokenPriceLib.to(SUI_GAS_TOKEN_PRICE   * 1e18))
      .computationPrice(SuiComputationPriceLib.to(SUI_COMPUTATION_PRICE * 1e9 ))
      .storagePrice    (       StoragePriceLib.to(SUI_STORAGE_PRICE     * 1e9 ))
      .storageRebate   (      StorageRebateLib.to(SUI_REBATE_PERCENTAGE       ));

    EvmFeeParams unichainFeeParams = baseFeeParams;
    EvmFeeParams futureEVMChainFeeParams = baseFeeParams;

    address priceOracleImplementation = address(new PriceOracle(coreBridge()));

    priceOracle = address(new Proxy(
      priceOracleImplementation,
      abi.encodePacked(
        makeAddr("oracleOwner"),
        uint8(1),
        makeAddr("oracleAdmin"),
        makeAddr("oracleAssistant"),
        ETHEREUM,
        EvmFeeParams.wrap(0).gasTokenPrice(GasTokenPriceLib.to(ETHEREUM_GAS_TOKEN_PRICE * 1e18)),
        AVALANCHE,
        avaxFeeParams,
        BASE,
        baseFeeParams,
        SOLANA,
        solanaFeeParams,
        SUI,
        suiFeeParams,
        UNICHAIN,
        unichainFeeParams,
        FUTURE_EVM,
        futureEVMChainFeeParams
      )
    ));

    v1Adjustments = [MAX_FEE_ADJUSTMENTS, MAX_FEE_ADJUSTMENTS];
    _setFeeAdjustment(
      v1Adjustments,
      CCTP_DOMAIN_BASE,
      ONE_USD_OVERHEAD_FEE_ADJUSTMENT,
      DISCOUNT_BY_HALF_FEE_ADJUSTMENT
    );

    _setFeeAdjustment(
      v1Adjustments,
      CCTP_DOMAIN_SOLANA,
      ONE_USD_OVERHEAD_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );

    _setFeeAdjustment(
      v1Adjustments,
      CCTP_DOMAIN_SUI,
      AT_COST_ABSOLUTE_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );

    _setFeeAdjustment(
      v1Adjustments,
      CCTP_DOMAIN_UNICHAIN,
      ONE_USD_OVERHEAD_FEE_ADJUSTMENT,
      DISCOUNT_BY_HALF_FEE_ADJUSTMENT
    );

    v2DirectAdjustments = [MAX_FEE_ADJUSTMENTS, MAX_FEE_ADJUSTMENTS];
    _setFeeAdjustment(
      v2DirectAdjustments,
      CCTP_DOMAIN_BASE,
      AT_COST_ABSOLUTE_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );

    _setFeeAdjustment(
      v2DirectAdjustments,
      CCTP_DOMAIN_UNICHAIN,
      AT_COST_ABSOLUTE_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );

    avaxHopAdjustments = [MAX_FEE_ADJUSTMENTS, MAX_FEE_ADJUSTMENTS];
    _setFeeAdjustment(
      avaxHopAdjustments,
      CCTP_DOMAIN_BASE,
      AT_COST_ABSOLUTE_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );

    _setFeeAdjustment(
      avaxHopAdjustments,
      CCTP_DOMAIN_UNICHAIN,
      AT_COST_ABSOLUTE_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );

    gasDropoffAdjustments = [MAX_FEE_ADJUSTMENTS, MAX_FEE_ADJUSTMENTS];
    _setFeeAdjustment(
      gasDropoffAdjustments,
      CCTP_DOMAIN_BASE,
      ONE_USD_OVERHEAD_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );

    _setFeeAdjustment(
      gasDropoffAdjustments,
      CCTP_DOMAIN_SOLANA,
      AT_COST_ABSOLUTE_FEE_ADJUSTMENT,
      ADD_FIVE_PERCENT_FEE_ADJUSTMENT
    );

    _setFeeAdjustment(
      gasDropoffAdjustments,
      CCTP_DOMAIN_SUI,
      ONE_USD_OVERHEAD_FEE_ADJUSTMENT,
      ADD_FIVE_PERCENT_FEE_ADJUSTMENT
    );

    _setFeeAdjustment(
      gasDropoffAdjustments,
      CCTP_DOMAIN_UNICHAIN,
      ONE_USD_OVERHEAD_FEE_ADJUSTMENT,
      AT_COST_RELATIVE_FEE_ADJUSTMENT
    );

    bytes memory adjustmentData = "";
    uint8 chainIdSlots = 0;
    adjustmentData = abi.encodePacked(adjustmentData, chainIdSlots);
    uint8 adjustmentSlots = 2;
    adjustmentData = abi.encodePacked(adjustmentData, adjustmentSlots);
    for (uint mappingIndex = 0; mappingIndex < adjustmentSlots; ++mappingIndex) {
      adjustmentData = abi.encodePacked(
        adjustmentData,
        v1Adjustments[mappingIndex],
        v2DirectAdjustments[mappingIndex],
        avaxHopAdjustments[mappingIndex],
        gasDropoffAdjustments[mappingIndex]
      );
    }

    cctpR = address(new CctpR(
      IS_MAINNET,
      owner,
      feeAdjuster,
      feeRecipient,
      offChainQuoter,
      address(usdc()),
      address(cctpTokenMessenger()),
      ETHEREUM_TOKEN_MESSENGER_V2,
      avaxRouter,
      priceOracle,
      PERMIT2_ADDRESS,
      adjustmentData
    ));
  }

  function _setFeeAdjustmentInSlot(
    uint256 feeAdjustmentSlot,
    uint cctpDomain,
    int16 absolute,
    uint8 relative
  ) internal pure returns (uint256) { unchecked {
    uint shift = (cctpDomain % ADJUSTMENTS_PER_SLOT) * 24;
    uint mask = ~(uint(type(uint24).max) << shift);
    return (feeAdjustmentSlot & mask) | (((uint(uint16(absolute)) << 8) + relative) << shift);
  }}

  function _setFeeAdjustment(
    uint256[] storage feeAdjustments,
    uint cctpDomain,
    int16 absolute,
    uint8 relative
  ) internal { unchecked {
    uint index = cctpDomain / ADJUSTMENTS_PER_SLOT;
    uint256 feeAdjustment = feeAdjustments[index];
    feeAdjustments[index] = _setFeeAdjustmentInSlot(feeAdjustment, cctpDomain, absolute, relative);
  }}

  function _cctpRExec(bytes memory data, uint value) internal {
    bytes memory execCall = abi.encodePacked(CctpR(cctpR).exec768.selector, data);
    (bool success, bytes memory result) = address(cctpR).call{value: value}(execCall);
    if (!success)
      reRevert(result);
  }

  function _quoteRelay(
    uint32 destinationDomain,
    Route route,
    uint32 gasDropoffMicroGasToken,
    bool inUsdc
  ) internal view returns (uint) {
    return abi.decode(
      _cctpRGet(abi.encodePacked(
        inUsdc ? QUERY_RELAY_IN_USDC_ID : QUERY_RELAY_IN_GAS_TOKEN_ID,
        uint8(destinationDomain),
        route,
        gasDropoffMicroGasToken
      )),
      (uint256)
    );
  }

  function _cctpRGet(bytes memory data) private view returns (bytes memory) {
    bytes memory getCall = abi.encodePacked(CctpR(cctpR).get1959.selector, data);
    (bool success, bytes memory result) = address(cctpR).staticcall(getCall);
    if (!success)
      reRevert(result);

    return abi.decode(result, (bytes));
  }
}
