import { Module } from '@nestjs/common';
import { TxLandingService } from './tx-landing.service.js';

@Module({
  providers: [TxLandingService],
  exports: [TxLandingService],
})
export class TxLandingModule {} 