import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, PropsWithChildren, ReactElement } from "react";
import { http } from "viem";
import {
  mainnet,
  polygon,
  avalanche,
  arbitrum,
  optimism,
  base,
  linea,
  unichain,
  worldchain,
  sonic,
} from "viem/chains";
import type { Transport } from "wagmi";
import { createConfig, WagmiProvider } from "wagmi";

import { env } from "@/env";

const chains = [
  mainnet,
  polygon,
  avalanche,
  arbitrum,
  optimism,
  base,
  linea,
  unichain,
  worldchain,
  sonic,
] as const;

const transports = Object.fromEntries(
  chains.map(({ id }) => [id, http()]),
) as Record<(typeof chains)[number]["id"], Transport>;

const wagmiConfig = createConfig({
  chains,
  multiInjectedProviderDiscovery: false,
  transports,
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const settings: ComponentProps<typeof DynamicContextProvider>["settings"] = {
  environmentId: env.dynamicEnvironmentId,
  walletConnectors: [EthereumWalletConnectors],
};

export const DynamicProvider = ({
  children,
}: PropsWithChildren): ReactElement => (
  <DynamicContextProvider settings={settings}>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
      </QueryClientProvider>
    </WagmiProvider>
  </DynamicContextProvider>
);
