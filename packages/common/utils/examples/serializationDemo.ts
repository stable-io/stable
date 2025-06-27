// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  bigintReplacer,
  bigintReviver,
  serializeBigints,
  deserializeBigints,
  stringifyWithBigints,
  parseWithBigints,
} from "../src/serialization.js";

console.info("=== BigInt Serialization Demo ===\n");

// Example data with BigInt values
const walletData = {
  address: "0x742d35Cc6634C0532925a3b8D6Ac6d4C2b5b2b4b",
  balance: 1500000000000000000n, // 1.5 ETH in wei
  nonce: 42n,
  transactions: [
    { amount: 100000000000000000n, blockNumber: 18500000n },
    { amount: 250000000000000000n, blockNumber: 18500001n },
  ],
  metadata: {
    chainId: 1n,
    gasPrice: 20000000000n, // 20 gwei
  },
};

console.info("Original wallet data:");
console.info(walletData);
console.info("\nTypes check:");
console.info("balance type:", typeof walletData.balance);
console.info("nonce type:", typeof walletData.nonce);
console.info("chainId type:", typeof walletData.metadata.chainId);

// Method 1: Object serialization/deserialization
console.info("\n=== Method 1: Object Serialization ===");
const serializedObj = serializeBigints(walletData);
console.info("Serialized object (JSON-safe):");
console.info(JSON.stringify(serializedObj, undefined, 2));

const deserializedObj = deserializeBigints<typeof walletData>(serializedObj);
console.info("\nDeserialized object:");
console.info(deserializedObj);
console.info("Values match:", deserializedObj.balance === walletData.balance);

// Method 2: String serialization/deserialization
console.info("\n=== Method 2: String Serialization ===");
const jsonString = stringifyWithBigints(walletData);
console.info("JSON string:");
console.info(jsonString);

const parsedFromString = parseWithBigints<typeof walletData>(jsonString);
console.info("\nParsed from string:");
console.info("balance type:", typeof parsedFromString.balance);
console.info("Values match:", parsedFromString.balance === walletData.balance);

// Method 3: Custom usage with JSON.stringify/parse
console.info("\n=== Method 3: Custom JSON Usage ===");
const customJson = JSON.stringify(walletData, bigintReplacer, 2);
console.info("Custom JSON with replacer:");
console.info(customJson);

const customParsed = JSON.parse(customJson, bigintReviver);
console.info("\nCustom parsed with reviver:");
console.info("chainId type:", typeof customParsed.metadata.chainId);
console.info("Values match:", customParsed.metadata.chainId === walletData.metadata.chainId);

console.info("\n=== Demo Complete ===");
