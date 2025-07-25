import type { Client, DomainsOf, GasTokenOf, Network } from "@stable-io/cctp-sdk-definitions";
import { EvmAddress } from "./address.js";
import type { BaseTx, ContractTx } from "./platform.js";

export interface EvmClient<
  N extends Network = Network,
  D extends DomainsOf<"Evm"> = DomainsOf<"Evm">,
> extends Client<N, "Evm", D> {
  estimateGas:    (tx: BaseTx) => Promise<bigint>;
  ethCall:        (tx: ContractTx) => Promise<Uint8Array>;
  getStorageAt:   (contract: EvmAddress, slot: bigint) => Promise<Uint8Array>;
  getBalance:     (address: EvmAddress) => Promise<GasTokenOf<D, DomainsOf<"Evm">>>;
  getLatestBlock: () => Promise<bigint>;
}
