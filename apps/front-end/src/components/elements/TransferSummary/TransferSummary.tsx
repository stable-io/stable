// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { Duration } from "@stable-io/cctp-sdk-definitions";
import Image from "next/image";
import type { ReactElement } from "react";

import { SummaryRow } from "./SummaryRow";

import { formatNumber } from "@/utils";

interface TransferSummaryProps {
  estimatedDuration?: Duration;
  receivedAmount: number;
}

export const TransferSummary = ({
  estimatedDuration,
  receivedAmount,
}: TransferSummaryProps): ReactElement => {
  const receiveValue = (
    <>
      <Image
        src="/imgs/usdc-icon.svg"
        alt="USDC"
        className="usdc-icon"
        unoptimized
        height={32}
        width={32}
      />
      {formatNumber(receivedAmount)} USDC
    </>
  );

  return (
    <div className="summary">
      {estimatedDuration !== undefined && (
        <>
          <SummaryRow
            label="Estimated time"
            value={`~${estimatedDuration.toString()} seconds`}
          />
          <SummaryRow label="Destination gas" value="$0.00" />
        </>
      )}
      <SummaryRow label="You receive" value={receiveValue} isTotal={true} />
    </div>
  );
};
