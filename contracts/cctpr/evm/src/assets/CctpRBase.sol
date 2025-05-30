// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

pragma solidity ^0.8.28;

import {
  CHAIN_ID_ETHEREUM,
  CHAIN_ID_AVALANCHE,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_NOBLE,
  CHAIN_ID_SOLANA,
  CHAIN_ID_BASE,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SUI,
  CHAIN_ID_APTOS,
  CHAIN_ID_UNICHAIN,
  CHAIN_ID_LINEA,
  CHAIN_ID_SEPOLIA,
  CHAIN_ID_OPTIMISM_SEPOLIA,
  CHAIN_ID_ARBITRUM_SEPOLIA,
  CHAIN_ID_BASE_SEPOLIA,
  CHAIN_ID_POLYGON_SEPOLIA
} from "wormhole-sdk/constants/Chains.sol";
import {eagerOr} from "wormhole-sdk/Utils.sol";
import {BytesParsing}  from "wormhole-sdk/libraries/BytesParsing.sol";

uint constant ADJUSTMENTS_PER_SLOT = 10;
uint constant CHAIN_IDS_PER_SLOT = 12;

//use uint256 as array of chain ids i.e. uint16s
//naming is slightly inaccurate because NOBLE is skipped and Aptos is not supported
uint256 constant MAINNET_CCTP_DOMAIN_TO_CHAIN_ID = ((((((((((((((((((((((
  uint(CHAIN_ID_LINEA    )) << 16) +
  uint(CHAIN_ID_UNICHAIN )) << 16) +
  uint(CHAIN_ID_APTOS    )) << 16) +
  uint(CHAIN_ID_SUI      )) << 16) +
  uint(CHAIN_ID_POLYGON  )) << 16) +
  uint(CHAIN_ID_BASE     )) << 16) +
  uint(CHAIN_ID_SOLANA   )) << 16) +
  uint(CHAIN_ID_NOBLE    )) << 16) +
  uint(CHAIN_ID_ARBITRUM )) << 16) +
  uint(CHAIN_ID_OPTIMISM )) << 16) +
  uint(CHAIN_ID_AVALANCHE)) << 16) +
  uint(CHAIN_ID_ETHEREUM );

uint256 constant TESTNET_CCTP_DOMAIN_TO_CHAIN_ID = ((((((((((((((((((((((
  uint(CHAIN_ID_LINEA            )) << 16) +
  uint(CHAIN_ID_UNICHAIN         )) << 16) +
  uint(CHAIN_ID_APTOS            )) << 16) +
  uint(CHAIN_ID_SUI              )) << 16) +
  uint(CHAIN_ID_POLYGON_SEPOLIA  )) << 16) +
  uint(CHAIN_ID_BASE_SEPOLIA     )) << 16) +
  uint(CHAIN_ID_SOLANA           )) << 16) +
  uint(CHAIN_ID_NOBLE            )) << 16) +
  uint(CHAIN_ID_ARBITRUM_SEPOLIA )) << 16) +
  uint(CHAIN_ID_OPTIMISM_SEPOLIA )) << 16) +
  uint(CHAIN_ID_AVALANCHE        )) << 16) +
  uint(CHAIN_ID_SEPOLIA          );

function domainToChainId(uint domain, uint cctpDomainToChainId) pure returns (uint16) { unchecked {
  return uint16(cctpDomainToChainId >> (domain * 16));
}}

function getAdjustmentFromMapping(
  mapping (uint => uint256) storage domainMap,
  uint domain
) view returns (uint256, uint) { unchecked {
  uint mappingIndex = domain / ADJUSTMENTS_PER_SLOT;
  return (domainMap[mappingIndex], domain % ADJUSTMENTS_PER_SLOT);
}}

enum Route {
  V1,
  V2Direct,
  AvaxHop
}

abstract contract CctpRBase {
  using BytesParsing for bytes;

  int  private  constant FEE_ADJUSTMENT_TO_MICRO_USD = 1e4;
  uint internal constant FEE_ADJUSTMENT_RELATIVE_DENOMINATOR = 1e2;

  uint256 internal immutable _cctpDomainToChainId;

  // struct FeeAdjustment {
  //   int16 absoluteUsd; // 2 decimals - positive for base fee, negative for discount
  //   uint8 relativePercent; // 100 = 100% = at cost (no risk adjustment, no discount)
  // }
  // absoluteUsd is applied _after_ relativePercent, this allows for charging a flat fee
  // gas dropoff is always unaffacted by fee adjustments

  // FeeAdjustment structs are packed in groups of 10 per slot
  // Since we have 3 bytes per domain, only 10 of them fit in a 32 byte slot
  // i.e. the discounts of Ethereum are stored in the 3 least significant bytes of the 0th slot

  // Each slot is mapped by the domain id divided by 10
  // We are using mappings since they are more gas efficient than arrays
  mapping (uint => uint256) internal _extraCctpDomainToChainId;
  mapping (uint => uint256) internal _v1Adjustments;
  mapping (uint => uint256) internal _v2DirectAdjustments;
  mapping (uint => uint256) internal _avaxHopAdjustments;
  mapping (uint => uint256) internal _gasDropoffAdjustments;

  address internal _feeRecipient;
  address internal _offChainQuoter;

  constructor(
    bool isMainnet,
    address feeRecipient,
    address offChainQuoter,
    bytes memory chainData
  ) {
    _cctpDomainToChainId = isMainnet
      ? MAINNET_CCTP_DOMAIN_TO_CHAIN_ID
      : TESTNET_CCTP_DOMAIN_TO_CHAIN_ID;
    _setFeeRecipient(feeRecipient);
    _offChainQuoter = offChainQuoter;
    uint offset = 0;
    uint8 chainSlots;
    (chainSlots, offset) = chainData.asUint8MemUnchecked(offset);
    for (uint i = 1; i <= chainSlots; i++) {
      (_extraCctpDomainToChainId[i], offset) = chainData.asUint256MemUnchecked(offset);
    }
    uint8 adjustmentSlots;
    (adjustmentSlots, offset) = chainData.asUint8MemUnchecked(offset);
    for (uint i = 0; i < adjustmentSlots; i++) {
      (        _v1Adjustments[i], offset) = chainData.asUint256MemUnchecked(offset);
      (  _v2DirectAdjustments[i], offset) = chainData.asUint256MemUnchecked(offset);
      (   _avaxHopAdjustments[i], offset) = chainData.asUint256MemUnchecked(offset);
      (_gasDropoffAdjustments[i], offset) = chainData.asUint256MemUnchecked(offset);
    }
    require(offset == chainData.length, "Invalid chain data length");
  }

  function _setFeeRecipient(address newFeeRecipient) internal {
    require(newFeeRecipient != address(0), "Invalid fee recipient");
    _feeRecipient = newFeeRecipient;
  }

  function _setChainIdForDomain(
    uint domain,
    uint16 chainId
  ) internal { unchecked {
    if (domain < CHAIN_IDS_PER_SLOT)
      revert("Chain ID was added at deployment");
    (uint mappingIndex, uint subIndex) = _getChainIndexesForDomain(domain);
    uint chainIds = _extraCctpDomainToChainId[mappingIndex];
    uint shift = subIndex * 16;
    uint mask = uint(type(uint16).max) << shift;
    uint newChainIds = (chainIds & ~mask) | (uint256(chainId) << shift);
    _extraCctpDomainToChainId[mappingIndex] = newChainIds;
  }}

  function _getTargetChainIdAndExecutionAdjustment(
    uint8 destDomain,
    Route route
  ) internal view returns (
    uint16 targetChainId,
    int    adjustmentAbsoluteUsdc,
    uint   adjustmentRelativePercent
  ) {
    if (destDomain < CHAIN_IDS_PER_SLOT) {
      targetChainId = domainToChainId(destDomain, _cctpDomainToChainId);
    }
    else {
      (uint mappingIndex, uint subIndex) = _getChainIndexesForDomain(destDomain);
      targetChainId = domainToChainId(subIndex, _extraCctpDomainToChainId[mappingIndex]);
    }
    (uint feeAdjustments, uint extractIndex) = getAdjustmentFromMapping(
      route == Route.V1 ? _v1Adjustments :
      route == Route.V2Direct ? _v2DirectAdjustments :
      _avaxHopAdjustments,
      destDomain
    );
    (adjustmentAbsoluteUsdc, adjustmentRelativePercent) =
      _extractFeeAdjustment(feeAdjustments, extractIndex);
  }

  function _getGasDropoffAdjustment(uint8 destDomain) internal view returns (
    int  gasDropoffAbsoluteUsdc,
    uint gasDropoffRelativePercent
  ) {
    (uint adjustments, uint index) = getAdjustmentFromMapping(_gasDropoffAdjustments, destDomain);
    return _extractFeeAdjustment(adjustments, index);
  }

  function _getChainIndexesForDomain(
    uint domain
  ) internal pure returns (uint mappingIndex, uint subIndex) { unchecked {
    return (domain / CHAIN_IDS_PER_SLOT, domain % CHAIN_IDS_PER_SLOT);
  }}

  function _extractFeeAdjustment(uint256 feeAdjustments, uint indexDomain) internal pure returns (
    int  adjustmentAbsoluteUsdc,
    uint adjustmentRelativePercent
  ) { unchecked {
    uint adjustment = feeAdjustments >> (indexDomain * 24);
    adjustmentAbsoluteUsdc = int(int16(uint16(adjustment >> 8))) * FEE_ADJUSTMENT_TO_MICRO_USD;
    adjustmentRelativePercent = uint8(adjustment);
  }}
}
