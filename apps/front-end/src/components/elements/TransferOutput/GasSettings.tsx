import Image from "next/image";
import type { ReactElement } from "react";

import { GasFeeDisplay } from "./GasFeeDisplay";
import { GasLevelOptions } from "./GasLevelOptions";

import { SplitLayout } from "@/components";
import type { GasDropoffLevel } from "@/constants";

interface GasSettingsProps {
  gasDropoffLevel: GasDropoffLevel;
  onGasDropoffLevelSelect: (level: GasDropoffLevel) => void;
}

export const GasSettings = ({
  gasDropoffLevel,
  onGasDropoffLevelSelect,
}: GasSettingsProps): ReactElement => {
  const leftContent = (
    <>
      <span className="label">Destination gas</span>
      <div className="tooltip">
        <Image
          src="/imgs/tooltip.svg"
          alt=""
          className="tooltip-icon"
          unoptimized
          height={14}
          width={14}
        />
        <span className="tooltip-text">
          Receive native gas along with your USDC on the destination chain.
        </span>
      </div>
      <GasLevelOptions
        gasDropoffLevel={gasDropoffLevel}
        onGasDropoffLevelSelect={onGasDropoffLevelSelect}
      />
    </>
  );

  return (
    <SplitLayout
      className="gas-settings"
      left={leftContent}
      right={<GasFeeDisplay />}
    />
  );
};
