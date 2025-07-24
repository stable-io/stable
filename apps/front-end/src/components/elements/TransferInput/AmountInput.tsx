import Image from "next/image";
import type { ReactElement, ChangeEvent } from "react";

interface AmountInputProps {
  amount: number;
  onAmountChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onMaxClick: () => void;
}

export const AmountInput = ({
  amount,
  onAmountChange,
  onMaxClick,
}: AmountInputProps): ReactElement => {
  return (
    <div className="amount-section">
      <Image
        src="/imgs/usdc-icon.svg"
        alt="USDC"
        className="usdc-icon"
        unoptimized
        height={32}
        width={32}
      />
      <input
        type="number"
        value={amount || ""}
        onChange={onAmountChange}
        placeholder="Enter amount"
        min="0"
        step="0.000001"
      />
      <button className="max-button" onClick={onMaxClick}>
        MAX
      </button>
    </div>
  );
};
