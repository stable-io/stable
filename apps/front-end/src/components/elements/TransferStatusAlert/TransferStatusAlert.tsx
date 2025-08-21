import type { ReactElement } from "react";

import { getExplorerUrl } from "@/utils";

interface TransferStatusAlertProps {
  transferTxHash: string;
  receiveTxHash?: string;
  targetChain: string;
}

export const TransferStatusAlert = ({
  transferTxHash,
  receiveTxHash,
  targetChain,
}: TransferStatusAlertProps): ReactElement => {
  const explorerUrl = transferTxHash
    ? getExplorerUrl("Testnet", transferTxHash)
    : "#";
  return (
    <div className="alert alert-success">
      <h3>Transfer Complete</h3>
      <p>
        Your USDC has been successfully bridged to {targetChain}. You can now
        view it in your wallet or explore the transaction on{" "}
        <a href={explorerUrl} target="_blank">
          our explorer
        </a>
        .
      </p>
      {/* @todo: Add proper receive status alert */}
      {receiveTxHash && (
        <p style={{ marginTop: "10px", fontSize: "14px", opacity: 0.8 }}>
          <strong>Receive Transaction:</strong>{" "}
          <a
            href={getExplorerUrl("Testnet", receiveTxHash)}
            target="_blank"
            style={{ fontFamily: "monospace" }}
          >
            {receiveTxHash.slice(0, 10)}...{receiveTxHash.slice(-8)}
          </a>
        </p>
      )}
    </div>
  );
};
