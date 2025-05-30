// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

pragma solidity ^0.8.28;

uint8 constant TRANSFER_WITH_RELAY_WITH_PERMIT_ID = 0x01;
uint8 constant TRANSFER_WITH_RELAY_ID             = 0x02;
uint8 constant TRANSFER_WITH_RELAY_GASLESS_ID     = 0x03;

uint8 constant UPDATE_FEE_ADJUSTMENTS_ID = 0x11;

uint8 constant OWNER_SWEEP_TOKENS_ID               = 0x12;
uint8 constant OWNER_UPDATE_FEE_RECIPIENT_ID       = 0x13;
uint8 constant OWNER_UPDATE_FEE_ADJUSTER_ID        = 0x14;
uint8 constant OWNER_UPDATE_OFFCHAIN_QUOTER_ID     = 0x15;
uint8 constant OWNER_PROPOSE_OWNERSHIP_TRANSFER_ID = 0x16;
uint8 constant OWNER_ACCEPT_OWNERSHIP_TRANSFER_ID  = 0x17;
uint8 constant OWNER_CANCEL_OWNERSHIP_TRANSFER_ID  = 0x18;
uint8 constant OWNER_SET_CHAIN_ID_FOR_DOMAIN_ID    = 0x19;

uint8 constant QUERY_RELAY_IN_USDC_ID      = 0x81;
uint8 constant QUERY_RELAY_IN_GAS_TOKEN_ID = 0x82;
