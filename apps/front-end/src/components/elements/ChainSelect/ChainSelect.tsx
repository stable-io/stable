// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { useState, useRef, useEffect } from "react";
import type { ReactElement } from "react";

import { ChainSelectButton } from "./ChainSelectButton";
import { ChainSelectMenu } from "./ChainSelectMenu";

import type { AvailableChains } from "@/constants";

export interface ChainSelectProps {
  title: string;
  chains: readonly AvailableChains[];
  selectedChain: AvailableChains;
  onSelect: (network: AvailableChains) => void;
}

export const ChainSelect = ({
  title,
  chains,
  selectedChain,
  onSelect,
}: ChainSelectProps): ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = (): void => {
    setIsOpen(!isOpen);
  };

  const handleSelect = (chain: AvailableChains): void => {
    onSelect(chain);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return (): void => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      data-testid="ChainSelect"
      className="network-select"
    >
      <span className="network-select-title">{title}</span>
      <ChainSelectButton
        selectedChain={selectedChain}
        onToggle={handleToggle}
      />
      {isOpen && (
        <ChainSelectMenu
          chains={chains}
          selectedChain={selectedChain}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
};
