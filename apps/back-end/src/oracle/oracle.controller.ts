import { Controller, Get } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import { OracleService } from "./oracle.service";

@Controller("oracle")
export class OracleController {
  constructor(private readonly oracleService: OracleService) {}

  /**
   * Get the current status of the oracle service
   */
  @Get("/status")
  @ApiResponse({
    status: 200,
    description: "Oracle service status information",
    type: String,
  })
  public getStatus(): string {
    return this.oracleService.getStatus();
  }
}
