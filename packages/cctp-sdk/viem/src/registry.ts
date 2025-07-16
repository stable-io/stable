import { registerPlatformClient } from "@stable-io/cctp-sdk-definitions";
import { ViemEvmClient } from "./viemEvmClient.js";

registerPlatformClient(
  "Evm",
  ViemEvmClient.fromNetworkAndDomain.bind(ViemEvmClient),
);
