// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { CallData } from "@stable-io/cctp-sdk-evm";
import { parseTransferTxCalldata } from "@stable-io/cctp-sdk-cctpr-evm";
import { bigintReplacer } from "../utils.js";
import { encoding } from "@stable-io/utils";

const cctprExecCallData =
  "00000eb601000000000000000000000000000000000000000000000000000000000052c607ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff962da8962b952b5b88b814d2d85913d2435919943743c101f7e8a41d209e311c6fd68301e2f4a1fa448895df83a4c6d0fb8cde09f1fd31d7492370b9c865f43a1b000000000000271003000000000000000000000000245ba3fe701c0d70bd42f3951d08f3a59914a627000007d00100000000000000010100000000007bee7200";

const parsed = parseTransferTxCalldata("Testnet")(
  Buffer.from(cctprExecCallData, "hex") as unknown as CallData,
);

const permit =
  "permit" in parsed
    ? { ...parsed.permit, signature: `0x${encoding.hex.encode(parsed.permit.signature)}` }
    : undefined;

console.info(
  JSON.stringify(
    {
      ...parsed,
      permit,
    },
    bigintReplacer,
    2,
  ),
);
