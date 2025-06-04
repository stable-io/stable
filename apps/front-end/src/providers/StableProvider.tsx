import { isEthereumWallet } from "@dynamic-labs/ethereum";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import type { EvmPlatformSigner } from "@stable-io/sdk";
import Stable from "@stable-io/sdk";
import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
  type JSX,
} from "react";
import { WalletClient } from "viem";

interface StableContextValue {
  address?: string;
  stable?: Stable<"Testnet">;
  isConnected: boolean;
}

const StableContext = createContext<StableContextValue | undefined>(undefined);

export const StableProvider = ({
  children,
}: PropsWithChildren): JSX.Element => {
  const { primaryWallet } = useDynamicContext();

  const address = useMemo(() => primaryWallet?.address, [primaryWallet]);

  const signer: EvmPlatformSigner | undefined = useMemo(
    () =>
      primaryWallet && isEthereumWallet(primaryWallet)
        ? {
            platform: "Evm" as const,
            getWalletClient: async (chain): Promise<WalletClient> => {
              const walletClient = await primaryWallet.getWalletClient(
                chain.id.toString(10),
              );
              if ((await walletClient.getChainId()) !== chain.id) {
                await walletClient.switchChain(chain);
              }
              return walletClient;
            },
          }
        : undefined,
    [primaryWallet],
  );

  const stable = useMemo(
    () =>
      signer
        ? new Stable({
            network: "Testnet",
            signer,
          })
        : undefined,
    [signer],
  );

  const value: StableContextValue = {
    address,
    stable,
    isConnected: !!address,
  };

  return (
    <StableContext.Provider value={value}>{children}</StableContext.Provider>
  );
};

export const useStableContext = (): StableContextValue => {
  const context = useContext(StableContext);
  if (!context) {
    throw new Error("useStableContext must be used within a StableProvider");
  }
  return context;
};
