import Image from "next/image";
import type { ReactElement } from "react";
import { useCallback, useState } from "react";

import type { AvailableChains } from "@/constants";
import { chainLogos } from "@/constants";
import { truncateAddress } from "@/utils";

interface DestinationSummaryProps {
  destinationWallet: string;
  routePath: string;
  estimatedCost: string;
  amount: number;
  targetChain: AvailableChains;
}

export const DestinationSummary = ({
  destinationWallet,
  routePath,
  estimatedCost,
  amount,
  targetChain,
}: DestinationSummaryProps): ReactElement => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleDetails = useCallback((): void => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <div
      className={`step transfer-summary destination-summary ${isExpanded ? "destination-summary-expanded" : ""}`}
      style={{ marginTop: "50px" }}
    >
      <div className="icon">
        <Image
          src={chainLogos[targetChain]}
          className="network-logo"
          alt={targetChain}
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
        <div className="step-desc">USDC on {targetChain}</div>
        <Image
          src="/imgs/arrow-down.svg"
          alt="Details"
          className="arrow"
          unoptimized
          height={24}
          width={24}
          onClick={handleToggleDetails}
        />

        <div
          className="destination-summary-details summary"
          style={{ marginTop: "20px" }}
        >
          <div className="row">
            <span className="label">Destination wallet</span>
            <span className="value">{truncateAddress(destinationWallet)}</span>
          </div>
          <div className="row">
            <span className="label">Route</span>
            <span className="value">{routePath}</span>
          </div>
          <div className="row">
            <span className="label">Fees</span>
            <span className="value">{estimatedCost}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
