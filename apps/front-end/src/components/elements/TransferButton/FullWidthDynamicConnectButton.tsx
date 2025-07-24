import { DynamicConnectButton } from "@dynamic-labs/sdk-react-core";
import type { ReactElement } from "react";

export const FullWidthDynamicConnectButton = (): ReactElement => {
  return (
    <div className="full-width-connect-wrapper">
      <DynamicConnectButton>
        <div className="main-cta">
          <span>Connect Wallet</span>
        </div>
      </DynamicConnectButton>
    </div>
  );
};
