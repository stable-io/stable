import { encoding } from "@stable-io/utils";
import { composePermitMsg, EvmAddress, permit2Address, Permit, Eip2612Data } from "@stable-io/cctp-sdk-evm";
import type { Permit2GaslessData } from "@stable-io/cctp-sdk-cctpr-evm";
import { Network } from "src/types/general.js";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import type { DomainsOf, PlatformClient, RegisteredPlatform } from "@stable-io/cctp-sdk-definitions";
import { usdc, usdcContracts } from "@stable-io/cctp-sdk-definitions";
import type { SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";

import { Intent } from "../types/index.js";
import { postTransferRequest } from "../api/gasless.js";
import { GaslessTransferData } from "src/methods/findRoutes/steps.js";

export async function* transferWithGaslessRelay<
  N extends Network,
  P extends RegisteredPlatform,
  S extends DomainsOf<P>,
  D extends SupportedDomain<N>,
>(
  client: PlatformClient<N, P, S>, //ViemEvmClient<N, S>,
  network: N,
  permit2RequiresAllowance: boolean,
  intent: Intent<N, S, D>,
  permit2GaslessData: Permit2GaslessData,
  jwt: string,
): AsyncGenerator<Eip2612Data | GaslessTransferData | Permit2GaslessData, any, any> {
  const usdcAddress = new EvmAddress(usdcContracts.contractAddressOf[network][intent.sourceChain]);
  const permit2Addr = new EvmAddress(permit2Address);
  const maxUint256Usdc = usdc(2n ** 256n - 1n, "atomic");

  let permit: Permit | undefined;
  if (permit2RequiresAllowance) {
    permit = yield composePermitMsg(network)(
      client, usdcAddress, intent.sender as EvmAddress, permit2Addr, maxUint256Usdc,
    );
  }

  const { signature: permit2Signature } = yield permit2GaslessData;

  const { txHash } = await postTransferRequest(network, { jwt, permit2Signature, permit });

  return {
    permit2GaslessData,
    txHash,
    permit2Signature: encoding.hex.encode(permit2Signature, true),
    ...permit,
  };
}
