import type { Network, Route } from "@stable-io/sdk";
import Image from "next/image";
import type { ReactElement } from "react";

import { RouteMetaItem } from "./RouteMetaItem";

import { SectionDivider, SplitLayout } from "@/components";
import type { AvailableChains } from "@/constants";
import { formatCost } from "@/utils";

interface RouteInformationProps {
  route?: Route<Network, AvailableChains, AvailableChains>;
}

export const RouteInformation = ({
  route,
}: RouteInformationProps): ReactElement | undefined => {
  if (!route) {
    return undefined;
  }

  const { corridor, estimatedDuration, estimatedTotalCost } = route;

  const leftContent = (
    <>
      <Image
        src="/imgs/route.svg"
        alt=""
        className="route-icon"
        unoptimized
        height={18}
        width={18}
      />
      <span>
        Route: <strong>{corridor}</strong>
      </span>
      <span className="badge badge-green">Best Route</span>
    </>
  );

  const rightContent = (
    <>
      <RouteMetaItem
        iconSrc="/imgs/gas.svg"
        altText="Gas fees"
        value={formatCost(estimatedTotalCost)}
      />
      <RouteMetaItem
        iconSrc="/imgs/time.svg"
        altText="Duration"
        value={`~${estimatedDuration.toString()} seconds`}
      />
    </>
  );

  return (
    <>
      <SplitLayout
        className="route-summary"
        left={leftContent}
        right={rightContent}
      />

      <SectionDivider style={{ margin: "25px 0px" }} />
    </>
  );
};
