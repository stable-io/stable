// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Image from "next/image";
import type { ReactElement } from "react";

interface SectionDividerProps {
  variant?: "arrow"; // @note: Extend with more options
  style?: React.CSSProperties;
}

export const SectionDivider = ({
  variant,
  style,
}: SectionDividerProps): ReactElement => {
  return (
    <div className="divider" style={style}>
      {variant === "arrow" && (
        <div className="icon-circle">
          <Image
            src="/imgs/arrow-long-down.svg"
            alt=""
            className="arrow-icon"
            unoptimized
            height={12}
            width={10}
          />
        </div>
      )}
    </div>
  );
};
