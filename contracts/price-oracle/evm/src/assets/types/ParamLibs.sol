// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! NOTE !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// !!! All unit libs return prices via their `from` functions as fixed point uints !!!
// !!!   with 18 decimals in "human units" (i.e. eth, not wei, sol, not lamports). !!!
// !!! So if 1 eth = $1000, then GasTokenPrice.from() returns 1e21 [usd/gasToken]. !!!
// !!! Likewise, `to` functions expect prices in the same format.                  !!!
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

// Summary (since most of this file is boilerplate):
//
//      Type               │ External Repr │ Internal Repr │ Bytes
//─────────────────────────┼───────────────┼───────────────┼───────
//  GasTokenPrice          │ usd/gasToken  │ µusd/gasToken │   6
//     GasPrice            │ gasToken/gas  │   Mwei/gas    │   4
//  PricePerTxByte         │ gasToken/byte │   Mwei/byte   │   4
// SolanaComputationPrice  │    sol/cu     │ µlamports/cu  │   4
// PricePerAccountByte     │   sol/byte    │ lamports/byte │   4
//  SignaturePrice         │    sol/sig    │ lamports/sig  │   4
//    GasDropoff           │   gasToken    │   µgasToken   │   4
//     BaseFee             │      usd      │     µusd      │   4
// SuiComputationPrice     │    sui/cu     │    mist/cu    │   4
//   StoragePrice          │    sui/byte   │   mist/byte   │   4
//  StorageRebate          │  percentage   │    0 to 100   │   1

error LosingAllPrecision(uint256 , uint256 divisor);
error ExceedsMax(uint256 stored, uint256 max);

function checkedUnitDiv(uint val, uint divisor, uint max) pure returns (uint) { unchecked {
  if (val == 0)
    return 0;

  uint ret = val / divisor;
  if (ret == 0)
    revert LosingAllPrecision(val, divisor);

  if (ret > max)
    revert ExceedsMax(ret, max);

  return ret;
}}

//gasToken is a more general term for elements of the set {sol, eth, avax, ...}
type GasTokenPrice is uint48;
//external repr: usd/gasToken with 18 decimals (1 usd/eth => 1e18, usd NOT µusd!)
library GasTokenPriceLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 6;
  uint private constant UNIT = 1e12; //µusd/gasToken (1e6 * 1e12 = 1e18)

  function to(uint val) internal pure returns (GasTokenPrice) {
    uint tmp = checkedUnitDiv(val, UNIT, type(uint48).max);

    //skip unneccessary cleanup
    uint48 ret;
    assembly ("memory-safe") { ret := tmp }

    return GasTokenPrice.wrap(ret);
  }

  function from(GasTokenPrice val) internal pure returns (uint) { unchecked {
    return uint(GasTokenPrice.unwrap(val)) * UNIT;
  }
}}
using GasTokenPriceLib for GasTokenPrice global;

//cost of 1 consumed gas unit
type GasPrice is uint32;
//external repr: gasToken/gas with 18 decimals (eth/gas NOT Gwei/gas!)
library GasPriceLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 4;
  uint private constant UNIT = 1e6;

  function to(uint val) internal pure returns (GasPrice) { unchecked {
    uint tmp = checkedUnitDiv(val, UNIT, type(uint32).max);

    //skip unneccessary cleanup
    uint32 ret;
    assembly ("memory-safe") { ret := tmp }

    return GasPrice.wrap(ret);
  }}

  function from(GasPrice val) internal pure returns (uint) { unchecked {
    return uint(GasPrice.unwrap(val)) * UNIT;
  }
}}
using GasPriceLib for GasPrice global;

//per byte cost of calldata on L2s
type PricePerTxByte is uint32;
//external repr: gasToken/byte (of calldata) with 18 decimals (eth/byte NOT Gwei/gas!)
library PricePerTxByteLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 4;
  uint private constant UNIT = 1e6;

  function to(uint val) internal pure returns (PricePerTxByte) { unchecked {
    uint tmp = checkedUnitDiv(val, UNIT, type(uint32).max);

    //skip unneccessary cleanup
    uint32 ret;
    assembly ("memory-safe") { ret := tmp }

    return PricePerTxByte.wrap(ret);
  }}

  function from(PricePerTxByte val) internal pure returns (uint) { unchecked {
    return uint(PricePerTxByte.unwrap(val)) * UNIT;
  }
}}
using PricePerTxByteLib for PricePerTxByte global;

// The price of a computation unit on the Solana chain
type SolanaComputationPrice is uint32;
// External repr: sol/CU with 18 decimals (NOT lamports/CU!)
library SolanaComputationPriceLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 4;
  uint private constant UNIT = 1e3; // Stored in microlamports/CU (15 decimals per CU)

  function to(uint256 val) internal pure returns (SolanaComputationPrice) { unchecked {
    uint tmp = checkedUnitDiv(val, UNIT, type(uint32).max);

    //skip unneccessary cleanup
    uint32 ret;
    assembly ("memory-safe") { ret := tmp }

    return SolanaComputationPrice.wrap(ret);
  }}

  function from(SolanaComputationPrice val) internal pure returns (uint256) { unchecked {
    return uint256(SolanaComputationPrice.unwrap(val)) * UNIT;
  }
}}
using SolanaComputationPriceLib for SolanaComputationPrice global;

//per byte cost of solana account data
type PricePerAccountByte is uint32;
//external repr: sol/byte (of account data) with 18 decimals (NOT lamports/byte!)
//At time of writing: 6_960 lamports/byte (alson likely won't change).
//So likely returned value: 6_960_000_000_000 = 0.00000696 sol/byte
library PricePerAccountByteLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 4;
  uint private constant UNIT = 1e9; //stored in lamports/byte

  function to(uint256 val) internal pure returns (PricePerAccountByte) { unchecked {
    uint tmp = checkedUnitDiv(val, UNIT, type(uint32).max);

    //skip unneccessary cleanup
    uint32 ret;
    assembly ("memory-safe") { ret := tmp }

    return PricePerAccountByte.wrap(ret);
  }}

  function from(PricePerAccountByte val) internal pure returns (uint256) { unchecked {
    return uint256(PricePerAccountByte.unwrap(val)) * UNIT;
  }
}}
using PricePerAccountByteLib for PricePerAccountByte global;

// Cost per signature in Solana
type SignaturePrice is uint32;
//external repr: sol/signature with 18 decimals (NOT lamports/byte!)
//At time of writing: 10000 lamports per signature
library SignaturePriceLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 4;
  uint private constant UNIT = 1e9; //stored in lamports/byte

  function to(uint256 val) internal pure returns (SignaturePrice) { unchecked {
    uint tmp = checkedUnitDiv(val, UNIT, type(uint32).max);

    //skip unneccessary cleanup
    uint32 ret;
    assembly ("memory-safe") { ret := tmp }

    return SignaturePrice.wrap(ret);
  }}

  function from(SignaturePrice val) internal pure returns (uint256) { unchecked {
    return uint256(SignaturePrice.unwrap(val)) * UNIT;
  }
}}
using SignaturePriceLib for SignaturePrice global;

//requested amount of additional gas dropoff for a delivery
type GasDropoff is uint32;
//external repr: gasToken with 18 decimals
library GasDropoffLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 4;
  uint private constant UNIT = 1e12; //specified in µgasToken

  function to(uint256 val) internal pure returns (GasDropoff) { unchecked {
    uint tmp = checkedUnitDiv(val, UNIT, type(uint32).max);

    //skip unneccessary cleanup
    uint32 ret;
    assembly ("memory-safe") { ret := tmp }

    return GasDropoff.wrap(ret);
  }}

  function from(GasDropoff val) internal pure returns (uint256) { unchecked {
    return uint256(GasDropoff.unwrap(val)) * UNIT;
  }
}}
using GasDropoffLib for GasDropoff global;

type BaseFee is uint32;
//external repr: usd with 18 decimals
library BaseFeeLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 4;
  uint private constant UNIT = 1e12; //specified in µusd

  function to(uint256 val) internal pure returns (BaseFee) { unchecked {
    uint tmp = checkedUnitDiv(val, UNIT, type(uint32).max);

    //skip unneccessary cleanup
    uint32 ret;
    assembly ("memory-safe") { ret := tmp }

    return BaseFee.wrap(ret);
  }}

  function from(BaseFee val) internal pure returns (uint256) { unchecked {
    return uint256(BaseFee.unwrap(val)) * UNIT;
  }
}}
using BaseFeeLib for BaseFee global;

// The price of a computation unit on the SUI chain
// Similarly to EVM, this is the price of a computation unit in MIST
// It varies depending on the current state of the network
type SuiComputationPrice is uint32;
// External repr: SUI with 18 decimals, not MIST/computationUnit
library SuiComputationPriceLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 4;
  uint private constant UNIT = 1e9; // Stored in MIST

  function to(uint256 val) internal pure returns (SuiComputationPrice) { unchecked {
    uint tmp = checkedUnitDiv(val, UNIT, type(uint32).max);

    //skip unneccessary cleanup
    uint32 ret;
    assembly ("memory-safe") { ret := tmp }

    return SuiComputationPrice.wrap(ret);
  }}

  function from(SuiComputationPrice val) internal pure returns (uint256) { unchecked {
    return uint256(SuiComputationPrice.unwrap(val)) * UNIT;
  }
}}
using SuiComputationPriceLib for SuiComputationPrice global;

// The price of a storage byte on the SUI chain
// This one is set by governance and thus is unlikely to change
type StoragePrice is uint32;
// External repr: SUI with 18 decimals, not MIST/bytes
library StoragePriceLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 4;
  uint private constant UNIT = 1e9; // Stored in MIST

  function to(uint256 val) internal pure returns (StoragePrice) { unchecked {
    uint tmp = checkedUnitDiv(val, UNIT, type(uint32).max);

    //skip unneccessary cleanup
    uint32 ret;
    assembly ("memory-safe") { ret := tmp }

    return StoragePrice.wrap(ret);
  }}

  function from(StoragePrice val) internal pure returns (uint256) { unchecked {
    return uint256(StoragePrice.unwrap(val)) * UNIT;
  }
}}
using StoragePriceLib for StoragePrice global;

// The percentage of storage rebate between 0 and 100
// This one is set by governance and thus is unlikely to change
type StorageRebate is uint8;
// External repr: A percentage, ideally an integer number between 0 and 100
library StorageRebateLib {
  //WARNING: any changes must be reflected in the typescript SDK!
  uint internal constant BYTE_SIZE = 1;
  uint internal constant MAX = 100;

  function to(uint256 val) internal pure returns (StorageRebate) { unchecked {
    if (val > MAX)
      revert ExceedsMax(val, MAX);

    //skip unneccessary cleanup
    uint8 ret;
    assembly ("memory-safe") { ret := val }

    return StorageRebate.wrap(ret);
  }}

  function from(StorageRebate val) internal pure returns (uint256) { unchecked {
    return uint256(StorageRebate.unwrap(val));
  }
}}
using StorageRebateLib for StorageRebate global;