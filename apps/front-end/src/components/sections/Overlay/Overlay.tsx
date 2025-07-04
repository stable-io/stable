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
