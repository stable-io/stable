import { TODO, encoding } from "@stable-io/utils";
import { composePermitMsg, EvmAddress, permit2Address, Permit, Permit2TypedData } from "@stable-io/cctp-sdk-evm";
import { layouts, SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";
import { Network } from "src/types/general.js";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { Usdc, usdc, usdcContracts } from "@stable-io/cctp-sdk-definitions";

import { Intent } from "../types/index.js";
import { postTransferRequest } from './api.js';

export async function* transferWithGaslessRelay<
  N extends Network,
  S extends SupportedEvmDomain<N>,
  D extends SupportedEvmDomain<N>,
>(
  evmClient: ViemEvmClient<N, S>,
  network: N,
  permit2RequiresAllowance: boolean,
  intent: Intent<S,D>,
  permit2TypedData: Permit2TypedData,
  jwt: string,
  maxRelayFee: Usdc,
  maxFastFee: Usdc,
): AsyncGenerator<any, any, any> {
  const usdcAddress = new EvmAddress(usdcContracts.contractAddressOf[network][intent.sourceChain]);
  const permit2Addr = new EvmAddress(permit2Address);
  const maxUint256Usdc = usdc(2n ** 256n - 1n, "atomic");

  let permit: Permit | undefined;
  if (permit2RequiresAllowance) {
    permit = yield composePermitMsg(network)(evmClient, usdcAddress, intent.sender, permit2Addr, maxUint256Usdc);
  }

  const { signature: permit2Signature } = yield permit2TypedData

  const { txHash } = await postTransferRequest(
    network,
    {
      permitSignature: permit?.signature,
      permit2Signature,
      jwt,
    }
  );

  throw new Error("not fully implemented");
}


