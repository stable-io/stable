import { Module } from "@nestjs/common";
import { StatusController } from "./status.controller.js";
import { StatusService } from "./status.service.js";

@Module({
  controllers: [StatusController],
  providers: [StatusService],
})
export class StatusModule {}
