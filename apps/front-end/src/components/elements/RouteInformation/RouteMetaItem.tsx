// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Image from "next/image";
import type { ReactElement, ReactNode } from "react";

interface RouteMetaItemProps {
  iconSrc: string;
  altText: string;
  value: ReactNode;
}

export const RouteMetaItem = ({
  iconSrc,
  altText,
  value,
}: RouteMetaItemProps): ReactElement => {
  return (
    <div className="meta">
      <Image
        src={iconSrc}
        className="icon"
        alt={altText}
        unoptimized
        height={16}
        width={16}
      />
      <span>{value}</span>
    </div>
  );
};
