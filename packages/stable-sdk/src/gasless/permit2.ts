import { TODO } from "@stable-io/utils";
import { SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";
import { chainIdOf } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress, permit2Address } from "@stable-io/cctp-sdk-evm";
import { AllowanceTransfer, MaxAllowanceTransferAmount, PermitSingle, MaxSigDeadline } from "@uniswap/permit2-sdk";
import { Network } from "src/types/general.js";

const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;

export async function composePermit2Msg<
  N extends Network,
  S extends SupportedEvmDomain<N>,
>(
  network: N,
  sourceChain: S,
  usdcAddress: EvmAddress,
  nonce: string,
  spender: EvmAddress,
) {
  const permit: PermitSingle = {
    details: {
      token: usdcAddress.toString(),
      amount: MaxAllowanceTransferAmount,
      expiration: deadline(THIRTY_DAYS),
      nonce,
    },
    spender: spender.toString(),
    sigDeadline: MaxSigDeadline
  };

  const chainId = chainIdOf(network, sourceChain as TODO);

  const typedData = AllowanceTransfer.getPermitData(permit, permit2Address, chainId);

  return typedData;
}

function deadline(expiration: number) {
  return Math.floor((Date.now() + expiration) / 1000);
}