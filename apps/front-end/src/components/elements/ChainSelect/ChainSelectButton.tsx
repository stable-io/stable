// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Image from "next/image";
import type { ReactElement } from "react";

import type { AvailableChains } from "@/constants";
import { chainLogos } from "@/constants";

export interface ChainSelectButtonProps {
  selectedChain: AvailableChains;
  onToggle: () => void;
}

export const ChainSelectButton = ({
  selectedChain,
  onToggle,
}: ChainSelectButtonProps): ReactElement => (
  <div className="network-select-btn" onClick={onToggle}>
    <Image
      src={chainLogos[selectedChain]}
      className="network-logo"
      alt={selectedChain}
      unoptimized
      height={24}
      width={24}
    />
    <span>{selectedChain}</span>
    <Image
      src="/imgs/arrow-down.svg"
      alt=""
      className="arrow"
      unoptimized
      height={6}
      width={10}
    />
  </div>
);
