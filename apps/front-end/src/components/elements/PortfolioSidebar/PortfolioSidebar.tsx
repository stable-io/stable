import type { ReactElement } from "react";

export const PortfolioSidebar = (): ReactElement => {
  return (
    <div className="sidebar content-box">
      <ul className="tabs">
        <li className="active">My Portfolio</li>
        <li>History</li>
      </ul>
      <div className="sidebar-content">
        <p
          style={{
            textAlign: "center",
            padding: "260px 0px",
            opacity: ".6",
          }}
        >
          Portfolio view goes here..
        </p>
      </div>
    </div>
  );
};
