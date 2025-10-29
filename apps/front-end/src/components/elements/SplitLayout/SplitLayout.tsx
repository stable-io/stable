// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactElement, ReactNode } from "react";

interface SplitLayoutProps {
  left: ReactNode;
  right: ReactNode;
  className?: string;
}

export const SplitLayout = ({
  left,
  right,
  className = "",
}: SplitLayoutProps): ReactElement => {
  return (
    <div className={className}>
      <div className="left">{left}</div>
      <div className="right">{right}</div>
    </div>
  );
};
