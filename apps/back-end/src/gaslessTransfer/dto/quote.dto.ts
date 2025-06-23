import { ApiProperty } from "@nestjs/swagger";

export class QuoteDto {
  /**
   * Server-signed JWT containing the permit2 permit data for the user to sign as well as the quote data
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
   */
  @ApiProperty({
    format: "jwt",
  })
  jwt!: string;
}
