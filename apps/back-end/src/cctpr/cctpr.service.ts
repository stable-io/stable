import { Injectable } from '@nestjs/common';
import { CctpR, SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { EvmAddress } from "@stable-io/cctp-sdk-evm";
import type { EvmDomains } from "@stable-io/cctp-sdk-definitions";
import type { Network } from '../gaslessTransfer/gaslessTransfer.service.js';

@Injectable()
export class CctpRService {
  constructor(
    private readonly network: Network,
  ) {}

  getCctprEvm(sourceChain: keyof EvmDomains): CctpR<Network, SupportedEvmDomain<Network>> {
    const client = ViemEvmClient.fromNetworkAndDomain(this.network, sourceChain);
    const cctprAddress = "0xTODO";

    return new CctpR(client, new EvmAddress(cctprAddress));
  }
} 