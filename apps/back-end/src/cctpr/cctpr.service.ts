import { Injectable } from '@nestjs/common';
import { CctpR, SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import type { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import type { Network } from '../gaslessTransfer/gaslessTransfer.service.js';
import { ConfigService } from '../config/config.service.js';

@Injectable()
export class CctpRService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  // TODO: instead of getClient this service should expose methods with actions
  //       such as "transferGasless"
  getCctprEvm(sourceChain: keyof EvmDomains): CctpR<Network, SupportedEvmDomain<Network>> {
    const client = ViemEvmClient.fromNetworkAndDomain(this.configService.network, sourceChain);
    const cctprAddress = "0xTODO";

    return new CctpR(client, new EvmAddress(cctprAddress));
  }
} 