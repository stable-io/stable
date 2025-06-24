import { Injectable } from '@nestjs/common';
import { TxLandingClient } from "@stable-io/tx-landing-client";
import type { Network } from '../gaslessTransfer/gaslessTransfer.service.js';
import { encoding } from "@stable-io/utils";
import { ConfigService } from '../config/config.service.js';
import { EvmDomains } from '@stable-io/cctp-sdk-definitions';
import { ContractTx, EvmAddress } from '@stable-io/cctp-sdk-evm';

@Injectable()
export class TxLandingService {
  private readonly txLandingBaseUrls = {
    Mainnet: "",
    Testnet: "http://localhost:50051",
  } as const;

  private readonly client!: TxLandingClient;
  constructor(
    private readonly configService: ConfigService,
  ) {
    this.client = new TxLandingClient(
      this.txLandingBaseUrls[this.configService.network],
      this.configService.txLandingApiKey
    );
  }

  public async sendTransaction(
    to: EvmAddress,
    targetDomain: keyof EvmDomains,
    txDetails: ContractTx,
  ): Promise<string> {
    const { txHashes } = await this.client.signAndLandTransaction({
      chain: targetDomain,
      txRequests: [
        {
          to: to.toString(),
          value: txDetails.value?.toUnit("atomic") ?? 0n,
          data: encoding.hex.encode(txDetails.data, true),
        },
      ],
    });

    return txHashes[0]!;
  }
} 