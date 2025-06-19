import type { Route } from "@stable-io/sdk";
import { useCallback, useEffect, useState } from "react";

import type { AvailableChains, GasDropoffLevel } from "@/constants";
import { gasDropoffs } from "@/constants";
import { useStableContext } from "@/providers";

interface UseRoutesProps {
  sourceChain: AvailableChains;
  targetChain: AvailableChains;
  amount: number;
  gasDropoffLevel: GasDropoffLevel;
}

interface UseRoutesReturn {
  route: Route<AvailableChains, AvailableChains> | undefined;
  isLoading: boolean;
  error: string | undefined;
  findRoutes: () => Promise<void>;
}

export const useRoutes = ({
  sourceChain,
  targetChain,
  amount,
  gasDropoffLevel,
}: UseRoutesProps): UseRoutesReturn => {
  const { stable, address } = useStableContext();
  const [route, setRoute] = useState<Route<AvailableChains, AvailableChains> | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const gasDropoffDesired = gasDropoffs[gasDropoffLevel];

  const findRoutes = useCallback(async () => {
    if (!address || !stable || amount <= 0) {
      setRoute(undefined);
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const result = await stable.findRoutes(
        {
          sourceChain,
          targetChain,
          amount: amount.toString(10),
          sender: address,
          recipient: address,
          gasDropoffDesired,
        },
      );
      const route = result.fastest;
      // @todo: Parameterize findRoutes?
      setRoute(route as Route<AvailableChains, AvailableChains>);
    } catch (error: unknown) {
      console.error("Failed to find routes:", error);
      setError(
        error instanceof Error ? error.message : "Failed to find routes",
      );
      setRoute(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [address, amount, gasDropoffDesired, sourceChain, stable, targetChain]);

  useEffect(() => {
    void findRoutes();
  }, [findRoutes]);

  return {
    route,
    isLoading,
    error,
    findRoutes,
  };
};
