import { Module } from '@nestjs/common';
import { GaslessTransferService } from './gaslessTransfer.service.js';
import { CctpRModule } from '../cctpr/cctpr.module.js';
import { TxLandingModule } from '../tx-landing/tx-landing.module.js';
import { ConfigModule } from '../config/config.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { GaslessTransferController } from './gaslessTransfer.controller.js';

@Module({
  imports: [
    CctpRModule,
    TxLandingModule,
    ConfigModule,
    AuthModule,
  ],
  controllers: [GaslessTransferController],
  providers: [GaslessTransferService],
  exports: [GaslessTransferService],
})
export class GaslessTransferModule {}
