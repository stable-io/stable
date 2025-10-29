// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Image from "next/image";
import type { ReactElement, ChangeEvent } from "react";

interface AmountInputProps {
  amount: string;
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
        value={amount}
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
