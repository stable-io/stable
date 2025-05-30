// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.25;

// ----------- Dispatcher Ids -----------

uint8 constant DISPATCHER_PROTOCOL_VERSION0 = 0;

// Execute commands

uint8 constant PRICES_ID = 0x00;
uint8 constant UPDATE_ASSISTANT_ID = 0x01;

// Query commands

uint8 constant PRICES_QUERIES_ID = 0x80;
uint8 constant ASSISTANT_ID = 0x81;

// ----------- Prices Ids ---------------

// Execute commands

uint8 constant EVM_FEE_PARAMS_ID = 0x00;
uint8 constant EVM_GAS_PRICE_ID = 0x01;
uint8 constant EVM_PRICE_PER_TX_BYTE_ID = 0x02;
uint8 constant GAS_TOKEN_PRICE_ID = 0x03;
uint8 constant SOLANA_COMPUTATION_PRICE_ID = 0x04;
uint8 constant SOLANA_PRICE_PER_ACCOUNT_BYTE_ID = 0x05;
uint8 constant SOLANA_SIGNATURE_PRICE_ID = 0x06;
uint8 constant SUI_COMPUTATION_PRICE_ID = 0x07;
uint8 constant SUI_STORAGE_PRICE_ID = 0x08;
uint8 constant SUI_STORAGE_REBATE_ID = 0x09;

// Query commands

uint8 constant EVM_TX_QUOTE_ID = 0x80;
uint8 constant SOLANA_TX_QUOTE_ID = 0x81;
uint8 constant SUI_TX_QUOTE_ID = 0x82;

uint8 constant QUERY_FEE_PARAMS_ID = 0x90;
uint8 constant CHAIN_ID_ID = 0x91;
