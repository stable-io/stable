import { Domain } from "@stable-io/cctp-sdk-definitions";
import { Hex } from "./general.js";

export type Receive = {
  transactionHash: Hex;
  destinationDomain: Domain;
};
