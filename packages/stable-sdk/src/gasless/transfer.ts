import { composePermitMsg, EvmAddress, permit2Address, Permit } from "@stable-io/cctp-sdk-evm";
import { SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";
import { Network } from "src/types/general.js";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { usdc, usdcContracts } from "@stable-io/cctp-sdk-definitions";

import { Intent } from "../types/index.js";
import { composePermit2Msg } from "./permit2.js";
import { postTransferRequest } from './api.js';

export async function* transferWithGaslessRelay<
  N extends Network,
  S extends SupportedEvmDomain<N>,
  D extends SupportedEvmDomain<N>,
>(
  evmClient: ViemEvmClient<N, S>,
  permit2RequiresAllowance: boolean,
  network: N,
  intent: Intent<S,D>,
  transferNonce: string, // comes from backend.
): AsyncGenerator<any, any, any> {
  const usdcAddress = new EvmAddress(usdcContracts.contractAddressOf[network][intent.sourceChain]);
  const permit2Addr = new EvmAddress(permit2Address);
  const maxUint256Usdc = usdc((1n << 256n) - 1n);

  let permit: Permit | undefined;
  if (permit2RequiresAllowance) {
    permit = yield composePermitMsg(network)(evmClient, usdcAddress, intent.sender, permit2Addr, maxUint256Usdc);
  }

  const permit2 = yield composePermit2Msg(network, intent.sourceChain, usdcAddress, transferNonce, intent.sender);


  const { txHash } = await postTransferRequest(
    // TODO: pass permit, permit2 and transfer parameters to transfer endpoint.
  );

  throw new Error("not fully implemented");
}


