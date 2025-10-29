// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Network, Route } from "@stable-io/sdk";
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

interface UseRoutesReturn<N extends Network> {
  route: Route<N, AvailableChains, AvailableChains> | undefined;
  isLoading: boolean;
  error: string | undefined;
  findRoutes: () => Promise<void>;
}

export const useRoutes = <N extends Network>({
  sourceChain,
  targetChain,
  amount,
  gasDropoffLevel,
}: UseRoutesProps): UseRoutesReturn<N> => {
  const { stable, address } = useStableContext();
  const [route, setRoute] = useState<
    Route<N, AvailableChains, AvailableChains> | undefined
  >();
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
      const result = await stable.findRoutes({
        sourceChain,
        targetChain,
        amount: amount.toString(10),
        sender: address,
        recipient: address,
        gasDropoffDesired,
      });
      const route = result.fastest;
      // @todo: Parameterize findRoutes?
      setRoute(route as Route<N, AvailableChains, AvailableChains>);
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
