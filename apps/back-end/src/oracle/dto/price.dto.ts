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
