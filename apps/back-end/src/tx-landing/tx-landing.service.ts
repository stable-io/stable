import { Injectable } from '@nestjs/common';
// import { TxLandingClient } from "@xlabs/tx-landing-client";
import type { Network } from '../gaslessTransfer/gaslessTransfer.service.js';
import { ConfigService } from '../config/config.service.js';

@Injectable()
export class TxLandingService {
  private readonly txLandingBaseUrls = {
    Mainnet: "",
    Testnet: "http://localhost:50051",
  } as const;

  constructor(
    private readonly configService: ConfigService,
  ) {}

  // TODO: Instead of exposing a method to get the client this service will
  //       expose methods with direct actions such as "sendTransaction"
  getClient(): any {
    const url = this.txLandingBaseUrls[this.configService.network];
    // return new TxLandingClient(url, this.txLandingApiKey, {
    //   timeout: 60, // seconds
    // });
    throw new Error("not Implemented");
  }
} 