import type { ReactElement, ChangeEvent } from "react";

import { AmountInput } from "./AmountInput";

import { NetworkSettings } from "@/components";
import type { AvailableChains } from "@/constants";

interface TransferInputProps {
  sourceChain: AvailableChains;
  onSelectSourceChain: (chain: AvailableChains) => void;
  availableChains: readonly AvailableChains[];
  amount: string;
  onAmountChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onMaxClick: () => void;
  walletAddress?: string;
  balance: number;
}

export const TransferInput = ({
  sourceChain,
  onSelectSourceChain,
  availableChains,
  amount,
  onAmountChange,
  onMaxClick,
  walletAddress,
  balance,
}: TransferInputProps): ReactElement => {
  return (
    <div className="select-section select-from-section">
      <NetworkSettings
        title="From"
        selectedChain={sourceChain}
        onSelectChain={onSelectSourceChain}
        availableChains={availableChains}
        walletAddress={walletAddress}
        balance={balance}
      />

      <AmountInput
        amount={amount}
        onAmountChange={onAmountChange}
        onMaxClick={onMaxClick}
      />
    </div>
  );
};
