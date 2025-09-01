// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { avaxRouterContractAddress } from "@stable-io/cctp-sdk-cctpr-definitions";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";

const testnetBytes = new EvmAddress(avaxRouterContractAddress.Testnet).toUint8Array();
const mainnetBytes = new EvmAddress(avaxRouterContractAddress.Mainnet).toUint8Array();

function padTo32(bytes: Uint8Array): Uint8Array {
	if (bytes.length > 32) 
    throw new Error("Input longer than 32 bytes");
	const out = new Uint8Array(32);
	out.set(bytes, 32 - bytes.length);
	return out;
}

function toHexBytes(bytes: Uint8Array): string {
	return "[" + Array.from(bytes)
		.map((b) => "0x" + b.toString(16).padStart(2, "0"))
		.join(", ") + "]";
}

const testnetBytes32 = padTo32(testnetBytes);
const mainnetBytes32 = padTo32(mainnetBytes);

console.log("These arrays are for hardcoding the avax router address into the CCTPR solana program")
console.log("Testnet:\n", toHexBytes(testnetBytes32));
console.log("Mainnet:\n", toHexBytes(mainnetBytes32));