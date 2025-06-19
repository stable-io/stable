import { Module } from '@nestjs/common';
import { CctpRService } from './cctpr.service.js';

@Module({
  providers: [CctpRService],
  exports: [CctpRService],
})
export class CctpRModule {} 