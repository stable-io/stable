import { Module } from '@nestjs/common';
import { GaslessTransferService } from './gaslessTransfer.service.js';
import { CctpRModule } from '../cctpr/cctp-r.module.js';
import { TxLandingModule } from '../tx-landing/tx-landing.module.js';
import { ConfigModule } from '../config/config.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    CctpRModule,
    TxLandingModule,
    ConfigModule,
    AuthModule,
  ],
  providers: [GaslessTransferService],
  exports: [GaslessTransferService],
})
export class GaslessTransferModule {}
