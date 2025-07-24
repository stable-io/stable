import type { ReactElement } from "react";

import { FullWidthDynamicConnectButton } from "./FullWidthDynamicConnectButton";

interface TransferButtonProps {
  onTransfer: () => void;
  isInProgress: boolean;
  disabled: boolean;
  walletAddress?: string;
}

export const TransferButton = ({
  onTransfer,
  isInProgress,
  disabled,
  walletAddress,
}: TransferButtonProps): ReactElement => {
  if (!walletAddress) {
    return (
      <div className="main-cta-container">
        <FullWidthDynamicConnectButton />
      </div>
    );
  }

  return (
    <div className="main-cta-container">
      <button className="main-cta" disabled={disabled} onClick={onTransfer}>
        {isInProgress && <div className="spinner"></div>}
        <span>{isInProgress ? "Transferring..." : "Confirm Transfer"}</span>
      </button>
    </div>
  );
};
