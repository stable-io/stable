import { DynamicConnectButton } from "@dynamic-labs/sdk-react-core";
import type { ReactElement } from "react";

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
        <DynamicConnectButton>
          <div className="main-cta">
            <span>Connect Wallet</span>
          </div>
        </DynamicConnectButton>
      </div>
    );
  }

  return (
    <div className="main-cta-container">
      <button className="main-cta" disabled={disabled} onClick={onTransfer}>
        {isInProgress && <div className="spinner"></div>}
        <span>Confirm Transfer</span>
      </button>
    </div>
  );
};
