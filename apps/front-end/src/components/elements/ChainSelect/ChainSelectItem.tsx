import Image from "next/image";
import type { ReactElement } from "react";

import type { AvailableChains } from "@/constants";
import { chainLogos } from "@/constants";

export interface ChainSelectItemProps {
  chain: AvailableChains;
  onSelect: (chain: AvailableChains) => void;
}

export const ChainSelectItem = ({
  chain,
  onSelect,
}: ChainSelectItemProps): ReactElement => (
  <li onClick={() => onSelect(chain)}>
    <Image
      src={chainLogos[chain]}
      className="network-logo item-icon"
      alt={chain}
      unoptimized
      height={24}
      width={24}
    />
    <span>{chain}</span>
  </li>
);
