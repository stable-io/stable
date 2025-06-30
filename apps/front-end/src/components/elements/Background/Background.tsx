import type { ReactElement } from "react";

export const Background = (): ReactElement => (
  <div className="backgrounds">
    <div className="radial-right"></div>
    <div className="radial-left"></div>
    <div className="topographic" style={{top: "30%", left: "-10%"}}></div>
  </div>
);
