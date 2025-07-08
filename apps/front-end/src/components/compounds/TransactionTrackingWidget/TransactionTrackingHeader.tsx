import Image from "next/image";
import type { ReactElement } from "react";

interface TransactionTrackingHeaderProps {
  /** seconds */
  timeRemaining: number;
  isTransferActive: boolean;
}

export const TransactionTrackingHeader = ({
  timeRemaining,
  isTransferActive,
}: TransactionTrackingHeaderProps): ReactElement => {
  const getDisplayText = (): string => {
    if (isTransferActive && timeRemaining <= 0) {
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
