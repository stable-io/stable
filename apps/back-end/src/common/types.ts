import type { DomainsOf } from "@stable-io/cctp-sdk-definitions";

export interface ApiResponseDto<T> {
  readonly data: T;
}

export type Domain = DomainsOf<"Evm">;
