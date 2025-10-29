// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type { ReactElement } from "react";

interface OverlayProps {
  children?: ReactElement;
  onClose?: () => void;
  disableClose?: boolean;
}

export const Overlay = ({
  children,
  onClose,
  disableClose = false,
}: OverlayProps): ReactElement | undefined => {
  if (!children) {
    return undefined;
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget && onClose && !disableClose) {
      onClose();
    }
  };

  return (
    <div className="overlay" onClick={handleOverlayClick}>
      {children}
    </div>
  );
};
