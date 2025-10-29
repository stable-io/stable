// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Image from "next/image";
import type { ReactElement } from "react";

interface TransactionTrackingHeaderProps {
  /** seconds */
  timeRemaining: number;
  isTransferInProgress: boolean;
}

export const TransactionTrackingHeader = ({
  timeRemaining,
  isTransferInProgress,
}: TransactionTrackingHeaderProps): ReactElement => {
  const getDisplayText = (): string => {
    if (isTransferInProgress && timeRemaining <= 0) {
      return "Finalizing transaction...";
    }

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="overlay-modal-header">
      <div className="left">
        <h4>Transfer USDC</h4>
      </div>
      <div className="right">
        <div className="meta header-time-meta">
          <Image
            src="/imgs/time.svg"
            className="icon"
            alt="Duration"
            unoptimized
            height={18}
            width={18}
            style={{ width: "18px", float: "left" }}
          />
          <span>{getDisplayText()}</span>
        </div>
      </div>
    </div>
  );
};
