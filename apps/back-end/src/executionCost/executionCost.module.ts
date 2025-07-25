import { Module } from "@nestjs/common";
import { ExecutionCostController } from "./executionCost.controller";
import { ExecutionCostService } from "./executionCost.service";

@Module({
  controllers: [ExecutionCostController],
  providers: [ExecutionCostService],
  exports: [ExecutionCostService],
})
export class ExecutionCostModule {} 