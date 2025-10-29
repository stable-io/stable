// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { EvmDomains, Network } from "@stable-io/cctp-sdk-definitions";
import { Type } from "class-transformer";
import {
  IsObject,
  IsOptional,
  IsUrl,
  ValidationError,
  ValidateNested,
  validateSync,
} from "class-validator";
import { NullToUndefined } from "../common/transforms";

export type RpcUrlConfig = {
  [N in Network]: {
    [D in keyof EvmDomains]?: string;
  };
};

class NetworkRpcConfig {
  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Ethereum?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Avalanche?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Optimism?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Arbitrum?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Base?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Polygon?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Unichain?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Linea?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Codex?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Sonic?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Worldchain?: string;

  @IsOptional()
  @NullToUndefined()
  @IsUrl()
  Solana?: string;
}

export class RpcConfigDto {
  @IsObject()
  @ValidateNested()
  @Type(() => NetworkRpcConfig)
  Mainnet!: NetworkRpcConfig;

  @IsObject()
  @ValidateNested()
  @Type(() => NetworkRpcConfig)
  Testnet!: NetworkRpcConfig;
}

export const validateRpcConfig = (
  config: unknown,
): {
  isValid: boolean;
  errors: string[];
} => {
  const errors = validateSync(config as RpcConfigDto);

  const flattenErrors = (validationErrors: ValidationError[]): string[] => {
    return validationErrors.flatMap((error) => {
      const constraints = Object.values(error.constraints ?? {});
      const childErrors =
        error.children && error.children.length > 0
          ? flattenErrors(error.children)
          : [];
      return [...constraints, ...childErrors];
    });
  };

  return {
    isValid: errors.length === 0,
    errors: flattenErrors(errors),
  };
};
