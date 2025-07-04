import Image from "next/image";
import type { ReactElement } from "react";

import type { AvailableChains } from "@/constants";
import { chainLogos } from "@/constants";

interface TransferSummaryProps {
  sourceChain: AvailableChains;
  amount: number;
}

export const TransferSummary = ({
  sourceChain,
  amount,
}: TransferSummaryProps): ReactElement => (
  <div className="step transfer-summary">
    <div className="icon">
      <Image
        src={chainLogos[sourceChain]}
        className="network-logo"
        alt={sourceChain}
        unoptimized
        height={54}
        width={54}
      />
      <Image
        src="/imgs/usdc-icon.svg"
        alt="USDC"
        className="token-logo"
        unoptimized
        height={30}
        width={30}
      />
    </div>
    <div className="details">
      <div className="step-title">{amount.toLocaleString()}</div>
      <div className="step-desc">USDC on {sourceChain}</div>
    </div>
  </div>
);
