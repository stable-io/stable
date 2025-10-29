// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { SerializedBigint } from "@stable-io/utils";

export type EvmPriceDto = {
  gasTokenPriceAtomicUsdc: SerializedBigint;
  gasPriceAtomic: SerializedBigint;
};

export type SolanaPriceDto = {
  gasTokenPriceAtomicUsdc: SerializedBigint;
  pricePerAccountByteAtomicLamports: SerializedBigint;
  signaturePriceAtomicLamports: SerializedBigint;
  computationPriceAtomicLamports: SerializedBigint;
};

export type SuiPriceDto = {
  gasTokenPriceAtomicUsdc: SerializedBigint;
  computationPriceAtomicMIST: SerializedBigint;
  storagePriceAtomicMIST: SerializedBigint;
  storageRebateScalar: SerializedBigint;
};

export type PriceDto = EvmPriceDto | SolanaPriceDto | SuiPriceDto;
