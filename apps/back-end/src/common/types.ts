import type { Address, DomainsOf } from "@stable-io/cctp-sdk-definitions";
import type { Amount } from "@stable-io/amount";

export interface ApiResponseDto<T> {
  readonly data: T;
}

export type Domain = Exclude<DomainsOf<"Evm">, "Codex">;

// @todo: Probably most things will be serializable as strings, so do this the other way around
type SerializedAsString = Address | Amount<any>;

export type PlainDto<T> = {
  [K in keyof T]: T[K] extends SerializedAsString ? string : T[K];
};

export type Network = "Testnet" | "Mainnet";
