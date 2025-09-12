import { registerPlatformClient } from "@stable-io/cctp-sdk-definitions";
import { SolanaKitClient } from "./solanaKitClient.js";

registerPlatformClient(
  "Solana",
  SolanaKitClient.fromNetworkAndDomain.bind(SolanaKitClient),
);
