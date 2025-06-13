import { ApiProperty } from "@nestjs/swagger";
import type {
  Domain,
  Usdc,
  EvmGasToken,
} from "@stable-io/cctp-sdk-definitions";
import { domainsOf, evmGasToken, usdc } from "@stable-io/cctp-sdk-definitions";
import type { Corridor } from "@stable-io/cctp-sdk-cctpr-evm";
import { corridors } from "@stable-io/cctp-sdk-cctpr-evm";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import {
  IsBoolean,
  IsOptional,
  IsIn,
  ValidateIf,
  Validate,
} from "class-validator";
import { ADDRESS_PATTERNS, AMOUNT_PATTERNS } from "../../common/utils";
import {
  IsNotSameAsConstraint,
  IsUsdcAmount,
  IsEvmGasTokenAmount,
  IsEvmAddress,
} from "../../common/validators";

const domains = domainsOf("Evm");

export class QuoteRequestDto<TargetDomain extends Domain = Domain> {
  /**
   * The source blockchain for the transfer
   * @example "Ethereum"
   */
  @ApiProperty({ enum: domains })
  @IsIn(domains)
  sourceDomain!: Domain;

  /**
   * The target blockchain for the transfer
   * @example "Arbitrum"
   */
  @ApiProperty({ enum: domains })
  @IsIn(domains)
  @Validate(IsNotSameAsConstraint, ["sourceDomain"])
  targetDomain!: TargetDomain;

  /**
   * Transfer amount in whole USDC units
   * Supports up to 6 decimal places (e.g., "1.5" represents 1.5 USDC)
   * @example "1.5"
   */
  @ApiProperty({
    type: String,
    format: "amount",
    pattern: AMOUNT_PATTERNS.USDC,
  })
  @IsUsdcAmount({ min: usdc(0.000001) })
  amount!: Usdc;

  /**
   * Sender's Ethereum address
   * @example "0x742d35Cc6634C0532925a3b8D404d4bC2f28e9FF"
   */
  @ApiProperty({
    type: String,
    format: "address",
    pattern: ADDRESS_PATTERNS.EVM,
  })
  @IsEvmAddress()
  sender!: EvmAddress;

  /**
   * Recipient's Ethereum address on the target chain
   * @example "0x1234567890123456789012345678901234567890"
   */
  @ApiProperty({
    type: String,
    format: "address",
    pattern: ADDRESS_PATTERNS.EVM,
  })
  @IsEvmAddress()
  recipient!: EvmAddress;

  @ApiProperty({ enum: corridors })
  @IsIn(corridors)
  corridor!: Corridor;

  /**
   * Amount of native gas token desired on target chain for gas dropoff
   * Specified in native token units (e.g., ETH, MATIC, AVAX)
   * Supports up to 18 decimal places, use "0" if no gas dropoff is desired
   * @example "0.01"
   */
  @ApiProperty({
    type: String,
    format: "amount",
    pattern: AMOUNT_PATTERNS.EVM_GAS_TOKEN,
  })
  @ValidateIf(({ targetDomain }: { targetDomain?: any }) =>
    domains.includes(targetDomain),
  )
  @IsEvmGasTokenAmount({ min: evmGasToken(0) })
  gasDropoff!: EvmGasToken;

  /**
   * Whether a permit2 permit is required for this transaction
   * (checked and constructed on client side)
   * @example true
   */
  @IsBoolean()
  @IsOptional()
  permit2PermitRequired?: boolean;
}
