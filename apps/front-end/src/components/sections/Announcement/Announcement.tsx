import Link from "next/link";
import type { ReactElement } from "react";

export const Announcement = (): ReactElement => (
  <div className="announcement">
    <div className="container">
      <p>
        Coming Soon to Stableit: Native USDC to Solana with Gas Dropoff.{" "}
        <Link
          href="https://blog.stableit.com/native-usdc-to-solana-with-gas-dropoff/"
          target="_blank"
          style={{ textDecoration: "underline", fontWeight: 600 }}
        >
          Learn more →
        </Link>
      </p>
    </div>
  </div>
);
