import { Controller, Get } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { StatusService } from "./status.service.js";

@ApiTags("status")
@Controller("status")
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  /**
   * Get the current status of the service
   */
  @Get()
  @ApiResponse({
    status: 200,
    description: "Service is running and healthy",
    type: String,
  })
  public getStatus(): string {
    return this.statusService.getStatus();
  }
}
