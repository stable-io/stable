import { Module } from "@nestjs/common";
import { CctpRService } from "./cctpr.service";

@Module({
  providers: [CctpRService],
  exports: [CctpRService],
})
export class CctpRModule {}
