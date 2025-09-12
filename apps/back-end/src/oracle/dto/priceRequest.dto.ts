import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { domainsOf } from "@stable-io/cctp-sdk-definitions";
import type { Domain, Network } from "../../common/types";
import { networks } from "../../common/types";

const domains = ["Solana", "Sui"].concat(domainsOf("Evm").filter((domain) => domain !== "Codex"));
export class PriceRequestDto {
  /**
   * The blockchain domain to get price information for
   * @example "Ethereum"
   */
  @ApiProperty({
    enum: domains,
    description: "The blockchain domain to get price information for",
  })
  @IsIn(domains)
  domain!: Domain;

  /**
   * The blockchain network for the domain
   * @example "Mainnet"
   */
  @ApiProperty({
    enum: networks,
    description: "The blockchain network to get price information for",
    default: "Mainnet",
  })
  @IsIn(networks)
  network!: Network;
}
