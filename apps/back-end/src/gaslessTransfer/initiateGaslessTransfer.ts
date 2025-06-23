import { TxLandingClient } from "@xlabs/tx-landing-client";
import { encoding } from "@stable-io/utils";
import { TODO } from "../../../../packages/common/utils/dist/misc.js";
import { CctpR, SupportedEvmDomain } from "@stable-io/cctp-sdk-cctpr-evm";
import { Network } from "./gaslessTransfer.service.js";
import { Usdc } from "@stable-io/cctp-sdk-definitions";

type GetTxLandingClient = () => TxLandingClient;
type GetCctprEvm<N extends Network> =
  (sourceChain: SupportedEvmDomain<N>) => CctpR<N, SupportedEvmDomain<N>>;
export type RelayTx = {
  hash: `0x${string}`;
};

export type InitiateTransferParams = {
  sourceChain: SupportedEvmDomain<Network>;
  targetChain: SupportedEvmDomain<Network>;
  inputAmount: Usdc;

  mintRecipient: TODO;
  gasDropoff: TODO;
  corridor: TODO;
  quote: TODO;
  nonce: Uint8Array;
  deadline: Date;
  gaslessFee: TODO;
  takeFeesFromInput: boolean;
  permit2Signature: Uint8Array;
};

export const initiateGaslessTransfer = <
  N extends Network,
>({
  getCctprEvm,
  getTxLandingClient,
}: {
  getCctprEvm: GetCctprEvm<N>;
  getTxLandingClient: GetTxLandingClient;
}) => async (transferParams: InitiateTransferParams): Promise<RelayTx> => {
  // 1. verify quote signature and throw if invalid
  // 2. call tx-landing-service and request the tx to be landed. set nonce+sender as the
  //    transaction tracking id.
  const client = getTxLandingClient();
  // 3. poll tx-landing-service for transaction confirmation

  const cctprEvm = getCctprEvm(transferParams.sourceChain);

  const txDetails = cctprEvm.transferGasless(
    transferParams.targetChain,
    transferParams.inputAmount,
    transferParams.mintRecipient,
    transferParams.gasDropoff,
    transferParams.corridor,
    transferParams.quote,
    transferParams.nonce,
    transferParams.deadline,
    transferParams.gaslessFee,
    transferParams.takeFeesFromInput,
    transferParams.permit2Signature,
  );

  const cctprAddress = "0xTODO";

  const { txHashes } = await client.signAndLandTransaction({
    /**
     * @todo: chain naming doesn't really match 1:1 with tx landing. We'll need a mapping.
     */
    chain: transferParams.targetChain,
    txRequests: [{
      to: cctprAddress,
      value: txDetails.value?.toUnit("atomic") ?? 0n,
      data: encoding.hex.encode(txDetails.data, true),
    }],

  });

  // fire some metric?

  // 4. respond.
  // return txHashes[0];

  throw new Error("Not Fully Implemented");
};
