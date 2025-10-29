// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactElement } from "react";

import { BalanceDisplay } from "./BalanceDisplay";

import { ChainSelect, WalletChip, SplitLayout } from "@/components";
import type { AvailableChains } from "@/constants";

interface NetworkSettingsProps {
  title: string;
  selectedChain: AvailableChains;
  onSelectChain: (chain: AvailableChains) => void;
  availableChains: readonly AvailableChains[];
  walletAddress?: string;
  balance?: number;
}

export const NetworkSettings = ({
  title,
  selectedChain,
  onSelectChain,
  availableChains,
  walletAddress,
  balance,
}: NetworkSettingsProps): ReactElement => {
  return (
    <SplitLayout
      className="network-settings"
      left={
        <ChainSelect
          title={title}
          chains={availableChains}
          selectedChain={selectedChain}
          onSelect={onSelectChain}
        />
      }
      right={
        <>
          <WalletChip address={walletAddress} />
          {balance !== undefined && <BalanceDisplay balance={balance} />}
        </>
      }
    />
  );
};
