import { Injectable } from '@nestjs/common';
import { TxLandingClient } from "@xlabs/tx-landing-client";
import type { Network } from '../gaslessTransfer/gaslessTransfer.service.js';

@Injectable()
export class TxLandingService {
  private readonly txLandingBaseUrls = {
    Mainnet: "",
    Testnet: "http://localhost:50051",
  } as const;

  constructor(
    private readonly network: Network,
    private readonly txLandingApiKey: string,
  ) {}

  getClient(): TxLandingClient {
    const url = this.txLandingBaseUrls[this.network];
    return new TxLandingClient(url, this.txLandingApiKey, {
      timeout: 60, // seconds
    });
  }
} 