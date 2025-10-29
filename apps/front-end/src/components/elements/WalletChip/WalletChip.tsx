// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { DynamicConnectButton } from "@dynamic-labs/sdk-react-core";
import Image from "next/image";
import type { ReactElement } from "react";

import { truncateAddress } from "@/utils";

export interface WalletChipProps {
  address?: string;
  walletIcon?: string;
  walletName?: string;
}

export const WalletChip = ({
  address,
  walletIcon = "/imgs/metamask-logo.svg",
  walletName = "MetaMask",
}: WalletChipProps): ReactElement => {
  const displayAddress = address ? truncateAddress(address) : "";
  return (
    <DynamicConnectButton>
      <div className="wallet-chip">
        <Image
          src={walletIcon}
          alt={walletName}
          className="wallet-icon"
          unoptimized
          height={16}
          width={16}
        />
        <span className="address">{displayAddress}</span>
        <span className="edit-btn">{address ? "Edit" : "Connect"}</span>
      </div>
    </DynamicConnectButton>
  );
};
