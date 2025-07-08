import { Domain } from "@stable-io/cctp-sdk-definitions";
import { Hex } from "./general.js";

export type Redeem = {
  transactionHash: Hex;
  destinationDomain: Domain;
};
