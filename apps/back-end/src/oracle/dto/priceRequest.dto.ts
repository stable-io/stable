import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { domainsOf } from "@stable-io/cctp-sdk-definitions";
import type { Domain } from "../../common/types";

const domains = domainsOf("Evm").filter((domain) => domain !== "Codex");

export class PriceRequestDto {
  /**
   * The blockchain domain to get price information for
   * @example "Ethereum"
   */
  @ApiProperty({ 
    enum: domains,
    description: "The blockchain domain to get price information for"
  })
  @IsIn(domains)
  domain!: Domain;
} 