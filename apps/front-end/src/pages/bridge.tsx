import Head from "next/head";
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

import {
  BridgeLayout,
  TopSection,
  LeftSection,
  RightSection,
  TransferStatusAlert,
  BridgeWidget,
  PortfolioSidebar,
} from "@/components";
import type { AvailableChains, GasDropoffLevel } from "@/constants";
import { availableChains } from "@/constants";
import { useBalance, useRoutes } from "@/hooks";
import { useStableContext } from "@/providers";
import type { NextPageWithLayout } from "@/utils";

const Bridge: NextPageWithLayout = (): ReactElement => {
  const [amount, setAmount] = useState(0);
  const [gasDropoffLevel, setGasDropoffLevel] =
    useState<GasDropoffLevel>("zero");
  const [sourceChain, setSourceChain] = useState<AvailableChains>(
    availableChains[0],
  );
  const [targetChain, setTargetChain] = useState<AvailableChains>(
    availableChains[1],
  );
  const [isInProgress, setIsInProgress] = useState(false);
  const [transferTxHash, setTransferTxHash] = useState<string | undefined>();
  const [redeemTxHash, setRedeemTxHash] = useState<string | undefined>();

  const { address, stable } = useStableContext();
  const { balance, updateBalance } = useBalance({ sourceChain });
  const { route } = useRoutes({
    sourceChain,
    targetChain,
    amount,
    gasDropoffLevel,
  });

  const resetTransferState = useCallback(() => {
    setTransferTxHash(undefined);
    setRedeemTxHash(undefined);
    setIsInProgress(false);
  }, []);

  useEffect(() => {
    if (!route) return;

    const handleTransferSent = (eventData: {
      transactionHash: string;
    }): void => {
      setTransferTxHash(eventData.transactionHash);
    };

    route.progress.on("transfer-sent", handleTransferSent);

    return (): void => {
      route.progress.off("transfer-sent", handleTransferSent);
    };
  }, [route]);

  useEffect(() => {
    if (!route) return;

    const handleTransferRedeemed = (redeemData: {
      transactionHash: string;
    }): void => {
      setRedeemTxHash(redeemData.transactionHash);
      void updateBalance();
    };

    route.progress.on("transfer-redeemed", handleTransferRedeemed);

    return (): void => {
      route.progress.off("transfer-redeemed", handleTransferRedeemed);
    };
  }, [route, updateBalance]);

  // @todo: Subtract expected fees
  // const maxAmount = balance;
  // const handleMaxAmount = () => {
  //   setAmount(maxAmount);
  // };

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
    const newAmount = Number.parseFloat(e.target.value) || 0;
    setAmount(newAmount);
  };

  const handleTransfer = (): void => {
    if (!route || !stable) {
      return;
    }
    setIsInProgress(true);
    resetTransferState();

    stable
      .executeRoute(route)
      .then(() => {
        void updateBalance();
      })
      .catch((error: unknown) => {
        console.error(error);
      })
      .finally(() => {
        setIsInProgress(false);
      });
  };

  return (
    <>
      <Head>
        <title>
          Stable | Move USDC across networks with high speed and minimal costs
        </title>
      </Head>
      {transferTxHash && (
        <TopSection>
          <TransferStatusAlert
            transferTxHash={transferTxHash}
            redeemTxHash={redeemTxHash}
            targetChain={targetChain}
          />
        </TopSection>
      )}
      <LeftSection>
        <BridgeWidget
          amount={amount}
          onAmountChange={handleAmountChange}
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
          isInProgress={isInProgress}
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
