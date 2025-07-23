// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { deserialize } from "binary-layout";
import { encoding } from "@stable-io/utils";
import { routerHookDataLayout } from "@stable-io/cctp-sdk-cctpr-evm";
import { v2 } from "@stable-io/cctp-sdk-definitions";

const message = "000000010000000000000001673c5a5ab84f2ff04474f6d5c7d8768d3bffd4e6" +
  "7a483c5e88f93ba0f110897a0000000000000000000000008fe6b999dc680ccf" +
  "dd5bf7eb0974218be2542daa0000000000000000000000008fe6b999dc680ccf" +
  "dd5bf7eb0974218be2542daa000000000000000000000000dd7f26f2ba98ddab" +
  "89fdc041a3db096abd9ceff6000001f4000007d0000000010000000000000000" +
  "000000001c7d4b196cb0c7b01d743fbc6116a902379c72380000000000000000" +
  "00000000dd7f26f2ba98ddab89fdc041a3db096abd9ceff60000000000000000" +
  "0000000000000000000000000000000000000000000000640000000000000000" +
  "00000000d60c838bcf9585b549f78bcf4903c950782da13c0000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000000000000000000" +
  "0000000000000000000000000000000000000000000000000200000000000000" +
  "0000000000245ba3fe701c0d70bd42f3951d08f3a59914a62700000000";

const burnMsg = deserialize(
  v2.burnMessageLayout(routerHookDataLayout("Testnet")),
  encoding.hex.decode(message),
);

console.info("maxFee:", burnMsg.messageBody.maxFee.toString());
console.info("feeExecuted:", burnMsg.messageBody.feeExecuted.toString());
console.info("minFinalityThreshold:", burnMsg.minFinalityThreshold);
console.info("finalityThresholdExecuted:", burnMsg.finalityThresholdExecuted);
