import { Domain } from "@stable-io/cctp-sdk-definitions";
import { TxHash } from "./general.js";

export type Receive = {
  transactionHash: TxHash;
  destinationDomain: Domain;
};
