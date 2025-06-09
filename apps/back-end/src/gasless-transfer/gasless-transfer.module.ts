import { Module } from '@nestjs/common';
import { GaslessTransferService } from './gasless-transfer.service';
import { GaslessTransferController } from './gasless-transfer.controller';
import { MetricsModule } from '../metrics/metrics.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [MetricsModule, ConfigModule],
  controllers: [GaslessTransferController],
  providers: [GaslessTransferService],
})
export class GaslessTransferModule {} 