import type { Route } from "@stable-io/sdk";
import type { ReactElement } from "react";

import {
  TransferInput,
  SectionDivider,
  TransferOutput,
  RouteInformation,
  TransferSummary,
  TransferButton,
} from "@/components";
import type { AvailableChains, GasDropoffLevel } from "@/constants";

interface BridgeWidgetProps {
  amount: number;
  onAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  gasDropoffLevel: GasDropoffLevel;
  onGasDropoffLevelSelect: (level: GasDropoffLevel) => void;
  sourceChain: AvailableChains;
  onSelectSourceChain: (chain: AvailableChains) => void;
  targetChain: AvailableChains;
  onSelectTargetChain: (chain: AvailableChains) => void;
  availableChains: readonly AvailableChains[];
  walletAddress?: string;
  balance: number;
  route?: Route<AvailableChains, AvailableChains>;
  isInProgress: boolean;
  onTransfer: () => void;
}

export const BridgeWidget = ({
  amount,
  onAmountChange,
  gasDropoffLevel,
  onGasDropoffLevelSelect,
  sourceChain,
  onSelectSourceChain,
  targetChain,
  onSelectTargetChain,
  availableChains,
  walletAddress,
  balance,
  route,
  isInProgress,
  onTransfer,
}: BridgeWidgetProps): ReactElement => {
  const transferEnabled =
    !isInProgress && !!walletAddress && !!route && balance > amount;

  return (
    <div className="bridge-widget content-box">
      <div className="widget-title">
        <h2>Transfer USDC</h2>
      </div>
      <div className="widget-body">
        <TransferInput
          sourceChain={sourceChain}
          onSelectSourceChain={onSelectSourceChain}
          availableChains={availableChains}
          amount={amount}
          onAmountChange={onAmountChange}
          walletAddress={walletAddress}
          balance={balance}
        />

        <SectionDivider variant="arrow" />

        <TransferOutput
          targetChain={targetChain}
          onSelectTargetChain={onSelectTargetChain}
          availableChains={availableChains}
          walletAddress={walletAddress}
          gasDropoffLevel={gasDropoffLevel}
          onGasDropoffLevelSelect={onGasDropoffLevelSelect}
        />

        <SectionDivider style={{ margin: "25px 0px" }} />

        <RouteInformation route={route} />

        <TransferSummary
          estimatedDuration={route?.estimatedDuration}
          amount={amount}
        />

        <TransferButton
          onTransfer={onTransfer}
          isInProgress={isInProgress}
          disabled={!transferEnabled}
          walletAddress={walletAddress}
        />
      </div>
    </div>
  );
};
