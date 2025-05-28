import Stable from "@stable-io/sdk";
import type { Url } from "@stable-io/utils";
import type { HDAccount } from "viem";
import { createWalletClient, http } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import type { Chain } from "viem/chains";

export const dynamicEnvironmentId =
  process.env["NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID"]!;

const mnemonic = process.env["NEXT_PUBLIC_MNEMONIC"]!;
export const account: HDAccount = mnemonicToAccount(mnemonic);

const signer = {
  platform: "Evm" as const,
  getWalletClient: (chain: Chain, url: Url) =>
    createWalletClient({
      account,
      chain,
      transport: http(url),
    }),
};

export const stable = new Stable({
  network: "Testnet",
  signer,
});
