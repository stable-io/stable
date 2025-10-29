// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Head from "next/head";
import { useState } from "react";
import type { ReactElement } from "react";

import {
  BridgeLayout,
  Overlay,
  LeftSection,
  RightSection,
  TransactionTrackingWidget,
  BridgeWidget,
  PortfolioSidebar,
} from "@/components";
import type { AvailableChains, GasDropoffLevel } from "@/constants";
import { availableChains } from "@/constants";
import { useBalance, useRoutes, useTransferProgress } from "@/hooks";
import { useStableContext } from "@/providers";
import type { NextPageWithLayout } from "@/utils";
import { formatCost } from "@/utils";

const Bridge: NextPageWithLayout = (): ReactElement => {
  const [amount, setAmount] = useState(0);
  const [amountInput, setAmountInput] = useState<string>("");
  const [gasDropoffLevel, setGasDropoffLevel] =
    useState<GasDropoffLevel>("zero");
  const [sourceChain, setSourceChain] = useState<AvailableChains>(
    availableChains[0],
  );
  const [targetChain, setTargetChain] = useState<AvailableChains>(
    availableChains[1],
  );

  const { address, stable } = useStableContext();
  const { balance, updateBalance } = useBalance({ sourceChain });
  const { route, findRoutes } = useRoutes({
    sourceChain,
    targetChain,
    amount,
    gasDropoffLevel,
  });

  const {
    isCurrent,
    isActive,
    isTransferInProgress,
    timeRemaining,
    resetTransfer,
    dismiss,
    steps,
  } = useTransferProgress(route);

  const handleMaxAmount = (): void => {
    setAmount(balance);
    setAmountInput(balance.toString());
  };

  const receivedAmount = route
    ? ((): number => {
        const grossAmount = route.intent.amount.toUnit("human").toNumber();
        const usdcFees = route.fees
          .filter((fee) => fee.kind.name === "Usdc") // @todo: Handle gas token fees?
          .reduce((total, fee) => total + fee.toUnit("human").toNumber(), 0);
        return grossAmount - usdcFees;
      })()
    : 0;

  const handleSelectSourceChain = (chain: AvailableChains): void => {
    setSourceChain(chain);
    if (targetChain === chain) {
      setTargetChain(sourceChain);
    }
  };

  const handleSelectTargetChain = (chain: AvailableChains): void => {
    setTargetChain(chain);
    if (sourceChain === chain) {
      setSourceChain(targetChain);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { value } = e.target;
    setAmountInput(value);

    if (value === "" || value === ".") {
      setAmount(0);
      return;
    }

    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      setAmount(parsed);
    }
  };

  const handleTransfer = (): void => {
    if (!route || !stable) {
      return;
    }
    resetTransfer();

    stable
      .executeRoute(route)
      .then(() => {
        void updateBalance();
      })
      .catch((error: unknown) => {
        console.error(error);
      })
      .finally(() => {
        void findRoutes();
      });
  };

  return (
    <>
      <Head>
        <title>
          Stableit | Move USDC across networks with high speed and minimal costs
        </title>
      </Head>
      {address && route && isCurrent && (
        <Overlay
          onClose={() => {
            dismiss();
          }}
          disableClose={isActive}
        >
          <TransactionTrackingWidget
            sourceChain={sourceChain}
            targetChain={targetChain}
            amount={amount}
            receivedAmount={receivedAmount}
            timeRemaining={timeRemaining}
            isTransferInProgress={isTransferInProgress}
            destinationWallet={address}
            routePath={route.corridor}
            estimatedCost={formatCost(route.estimatedTotalCost)}
            steps={steps}
          />
        </Overlay>
      )}
      <LeftSection>
        <BridgeWidget
          amount={amount}
          amountInput={amountInput}
          onAmountChange={handleAmountChange}
          onMaxClick={handleMaxAmount}
          receivedAmount={receivedAmount}
          gasDropoffLevel={gasDropoffLevel}
          onGasDropoffLevelSelect={setGasDropoffLevel}
          sourceChain={sourceChain}
          onSelectSourceChain={handleSelectSourceChain}
          targetChain={targetChain}
          onSelectTargetChain={handleSelectTargetChain}
          availableChains={availableChains}
          walletAddress={address}
          balance={balance}
          route={route}
          isInProgress={isCurrent}
          onTransfer={handleTransfer}
        />
      </LeftSection>
      <RightSection>
        <PortfolioSidebar />
      </RightSection>
    </>
  );
};

Bridge.getLayout = (page: ReactElement): ReactElement => (
  <BridgeLayout>{page}</BridgeLayout>
);

export default Bridge;
