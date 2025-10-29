// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactElement } from "react";

import { DestinationSummary } from "./DestinationSummary";
import type { ProgressStepProps } from "./ProgressStep";
import { ProgressStep } from "./ProgressStep";
import { TransactionTrackingHeader } from "./TransactionTrackingHeader";
import { TransferSummary } from "./TransferSummary";

import type { AvailableChains } from "@/constants";

interface TransactionTrackingWidgetProps {
  sourceChain: AvailableChains;
  targetChain: AvailableChains;
  amount: number;
  receivedAmount: number;
  /** seconds */
  timeRemaining: number;
  isTransferInProgress: boolean;
  destinationWallet: string;
  routePath: string;
  estimatedCost: string;
  steps: readonly ProgressStepProps[];
}

export const TransactionTrackingWidget = ({
  sourceChain,
  targetChain,
  amount,
  receivedAmount,
  timeRemaining,
  isTransferInProgress,
  destinationWallet,
  routePath,
  estimatedCost,
  steps,
}: TransactionTrackingWidgetProps): ReactElement => (
  <div className="overlay-modal content-box transaction-tracking-widget">
    <TransactionTrackingHeader
      timeRemaining={timeRemaining}
      isTransferInProgress={isTransferInProgress}
    />
    <div className="overlay-modal-content">
      <div className="steps">
        <TransferSummary sourceChain={sourceChain} amount={amount} />
        {steps.map((step) => (
          <ProgressStep
            key={step.title}
            title={step.title}
            description={step.description}
            status={step.status}
          />
        ))}
        <DestinationSummary
          destinationWallet={destinationWallet}
          routePath={routePath}
          estimatedCost={estimatedCost}
          amount={receivedAmount}
          targetChain={targetChain}
        />
      </div>
    </div>
  </div>
);
