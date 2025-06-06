import { useCallback, useEffect, useState } from "react";

import type { AvailableChains } from "@/constants";
import { useStableContext } from "@/providers";

interface UseBalanceProps {
  sourceChain: AvailableChains;
}

interface UseBalanceReturn {
  balance: number;
  isLoading: boolean;
  updateBalance: () => Promise<void>;
}

export const useBalance = ({
  sourceChain,
}: UseBalanceProps): UseBalanceReturn => {
  const { stable, address } = useStableContext();
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const updateBalance = useCallback(async () => {
    if (!address || !stable) {
      setBalance(0);
      return;
    }

    setIsLoading(true);
    try {
      const balances = await stable.getBalance(address, [sourceChain]);
      setBalance(Number.parseFloat(balances[sourceChain]));
    } catch (error: unknown) {
      console.error("Failed to fetch balance:", error);
      setBalance(0);
    } finally {
      setIsLoading(false);
    }
  }, [address, sourceChain, stable]);

  useEffect(() => {
    void updateBalance();
  }, [updateBalance]);

  return {
    balance,
    isLoading,
    updateBalance,
  };
};
