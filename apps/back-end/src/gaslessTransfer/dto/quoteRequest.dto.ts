import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsIn, ValidateIf, Validate } from "class-validator";
import { Percentage } from "@stable-io/cctp-sdk-definitions";
import type {
  Usdc,
  EvmGasToken,
  Network,
} from "@stable-io/cctp-sdk-definitions";
import type {
  Corridor,
  SupportedDomain,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import { corridors } from "@stable-io/cctp-sdk-cctpr-definitions";
import { Transform } from "class-transformer";
import { AMOUNT_PATTERNS } from "../../common/utils";
import {
  networks,
  supportedDomains,
  type Domain,
  type SupportedAddress,
  type SupportedAmount,
} from "../../common/types";
import {
  IsNotSameAsConstraint,
  IsUsdcAmount,
  IsPlatformAddress,
  IsBooleanString,
  IsPercentage,
  IsPlatformAmount,
} from "../../common/validators";

export type QuoteSupportedDomain<N extends Network> = Exclude<
  SupportedDomain<N>,
  "Codex" | "Sei" | "BNB" | "XDC" | "HyperEVM" | "Ink" | "Plume"
>;

export class QuoteRequestDto<
  SourceDomain extends Domain = Domain,
  TargetDomain extends Domain = Domain,
> {
  /**
   * The source blockchain for the transfer
   * @example "Ethereum"
   */
  @ApiProperty({ enum: supportedDomains })
  @IsIn(supportedDomains)
  sourceDomain!: SourceDomain;

  /**
   * The blockchain network for the source domain
   * @example "Mainnet"
   */
  @ApiProperty({
    enum: networks,
    description: "The blockchain network to get price information for",
    default: "Mainnet",
  })
  @IsIn(networks)
  sourceDomainNetwork!: Network;

  /**
   * The target blockchain for the transfer
   * @example "Arbitrum"
   */
  @ApiProperty({ enum: supportedDomains })
  @IsIn(supportedDomains)
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
  @IsUsdcAmount({ min: "0.000001" })
  @Transform(({ value }: { value: Usdc }) => value.toUnit("USDC").toFixed(6), {
    toPlainOnly: true,
  })
  amount!: Usdc;

  /**
   * Sender's address
   * @example "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   */
  @ApiProperty({
    type: String,
    format: "address",
  })
  @IsPlatformAddress("sourceDomain")
  @Transform(({ value }) => value.toString(), { toPlainOnly: true })
  sender!: SupportedAddress;

  /**
   * Recipient's address on the target chain
   * @example "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   */
  @ApiProperty({
    type: String,
    format: "address",
  })
  @IsPlatformAddress("targetDomain")
  @Transform(({ value }) => value.toString(), { toPlainOnly: true })
  recipient!: SupportedAddress;

  @ApiProperty({ enum: corridors })
  @IsIn(corridors)
  corridor!: Exclude<Corridor, "avaxHop">;

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
    supportedDomains.includes(targetDomain),
  )
  @IsPlatformAmount("targetDomain", { min: 0 })
  @Transform(
    ({ value }: { value: EvmGasToken }) => value.toUnit("human").toFixed(18),
    {
      toPlainOnly: true,
    },
  )
  gasDropoff!: SupportedAmount;

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
  @IsUsdcAmount({ min: "0.000001" })
  @Transform(({ value }: { value: Usdc }) => value.toUnit("USDC").toFixed(6), {
    toPlainOnly: true,
  })
  maxRelayFee!: Usdc;

  /**
   * The rate charged by circle for a fast transfer
   * @example "0.001" -- 1bps
   */
  @ApiProperty({
    type: String,
    format: "percentage",
    pattern: AMOUNT_PATTERNS.PERCENTAGE,
  })
  @IsPercentage({ min: "0" })
  @Transform(
    ({ value }: { value: Percentage }) => value.toUnit("human").toString(),
    {
      toPlainOnly: true,
    },
  )
  fastFeeRate!: Percentage;

  /**
   * Whether the fees will be taken from the input or added
   * on top of it
   * @example "true"
   */
  @IsBooleanString()
  takeFeesFromInput!: boolean;
}
