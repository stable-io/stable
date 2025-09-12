// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { createKeyPairSignerFromBytes } from "@solana/kit";
import type { SolanaPlatformSigner } from "../types/signer.js";
import type { KeyPairSigner } from "@solana/kit";
import path from "path";
import os from "os";
import fs from "fs";

export class SolanaKitSigner implements SolanaPlatformSigner {
  public readonly platform = "Solana" as const;

  public static async loadKeyPairSigner(filePath: string): Promise<KeyPairSigner> {
    const resolvedPath = path.resolve(
      filePath.startsWith("~") ? filePath.replace("~", os.homedir()) : filePath,
    );
    const loadedKeyBytes = Uint8Array.from(
      JSON.parse(fs.readFileSync(resolvedPath, "utf8")),
    );
    return createKeyPairSignerFromBytes(loadedKeyBytes);
  }

  constructor(private account: KeyPairSigner) {}

  public getKeyPairSigner(): KeyPairSigner {
    return this.account;
  }
}
