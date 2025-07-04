import type { Duration } from "@stable-io/cctp-sdk-definitions";
import Image from "next/image";
import type { ReactElement } from "react";

import { SummaryRow } from "./SummaryRow";

import { formatNumber } from "@/utils";

interface TransferSummaryProps {
  estimatedDuration?: Duration;
  amount: number;
}

export const TransferSummary = ({
  estimatedDuration,
  amount,
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
      {formatNumber(amount)} USDC
    </>
  );

  return (
    <div className="summary">
      <SummaryRow
        label="Estimated time"
        value={`~${estimatedDuration?.toString() ?? "???"} seconds`}
      />
      <SummaryRow label="Destination gas" value="$0.00" />
      <SummaryRow label="You receive" value={receiveValue} isTotal={true} />
    </div>
  );
};
