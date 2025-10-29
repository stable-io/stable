// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactNode, ReactElement } from "react";

interface RightSectionProps {
  children?: ReactNode;
}

export const RightSection = ({ children }: RightSectionProps): ReactElement => {
  return (
    <div
      className="right"
      style={{ width: "calc(100% - 50% - 30px)", marginLeft: "30px" }}
    >
      {children}
    </div>
  );
};
