import { Domain } from "@stable-io/cctp-sdk-definitions";
import { TxHash } from "./general.js";

export type Redeem = {
  transactionHash: TxHash;
  destinationDomain: Domain;
};
