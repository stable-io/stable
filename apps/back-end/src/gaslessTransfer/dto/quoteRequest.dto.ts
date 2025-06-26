import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsIn, ValidateIf, Validate, IsBoolean } from "class-validator";
import type { Usdc, EvmGasToken } from "@stable-io/cctp-sdk-definitions";
import { domainsOf, evmGasToken, usdc } from "@stable-io/cctp-sdk-definitions";
import type { Corridor } from "@stable-io/cctp-sdk-cctpr-evm";
import { corridors } from "@stable-io/cctp-sdk-cctpr-evm";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import { Transform } from "class-transformer";
import type { Domain } from "../../common/types";
import { ADDRESS_PATTERNS, AMOUNT_PATTERNS } from "../../common/utils";
import {
  IsNotSameAsConstraint,
  IsUsdcAmount,
  IsEvmGasTokenAmount,
  IsEvmAddress,
  IsBooleanString,
} from "../../common/validators";

const domains = domainsOf("Evm").filter((domain) => domain !== "Codex");

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
  @Transform(({ value }: { value: Usdc }) => value.toUnit("USDC").toFixed(6), {
    toPlainOnly: true,
  })
  amount!: Usdc;

  /**
   * Sender's Ethereum address
   * @example "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   */
  @ApiProperty({
    type: String,
    format: "address",
    pattern: ADDRESS_PATTERNS.EVM,
  })
  @IsEvmAddress()
  @Transform(({ value }: { value: EvmAddress }) => value.toString(), {
    toPlainOnly: true,
  })
  sender!: EvmAddress;

  /**
   * Recipient's Ethereum address on the target chain
   * @example "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   */
  @ApiProperty({
    type: String,
    format: "address",
    pattern: ADDRESS_PATTERNS.EVM,
  })
  @IsEvmAddress()
  @Transform(({ value }: { value: EvmAddress }) => value.toString(), {
    toPlainOnly: true,
  })
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
  @Transform(
    ({ value }: { value: EvmGasToken }) => value.toUnit("human").toFixed(18),
    {
      toPlainOnly: true,
    },
  )
  gasDropoff!: EvmGasToken;

  /**
   * Whether a permit2 permit is required for this transaction
   * (checked and constructed on client side)
   * @example true
   */
  @IsOptional()
  @ValidateIf((_, value) => typeof value === "string")
  @IsBooleanString()
  permit2PermitRequired: boolean = false;

  /**
   * Max price in usdc the user is willing to pay for a relay
   * @example "1.5"
   */
  @ApiProperty({
    type: String,
    format: "amount",
    pattern: AMOUNT_PATTERNS.USDC,
  })
  @IsUsdcAmount({ min: usdc(0.000001) })
  @Transform(({ value }: { value: Usdc }) => value.toUnit("USDC").toFixed(6), {
    toPlainOnly: true,
  })
  maxRelayFee!: Usdc;

  /**
   * Max price in usdc the user is willing to pay for Circle's fast-transfer service
   * @example "1.5"
   */
  @ApiProperty({
    type: String,
    format: "amount",
    pattern: AMOUNT_PATTERNS.USDC,
  })
  @IsUsdcAmount({ min: usdc(0) })
  @Transform(({ value }: { value: Usdc }) => value.toUnit("USDC").toFixed(6), {
    toPlainOnly: true,
  })
  maxFastFee!: Usdc;

  /**
   * Whether the fees will be taken from the input or added
   * on top of it
   * @example "true"
   */
  @Transform(({ value }) => value === "true")
  @IsBoolean()
  takeFeesFromInput!: boolean;
}
