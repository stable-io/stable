import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactElement } from "react";

export const Header = (): ReactElement => {
  const router = useRouter();

  return (
    <div test-id="header" className="top-nav">
      <div className="left">
        <Link href="/">
          <h1 className="logo"></h1>
        </Link>
      </div>
      <div className="right">
        <ul className="nav">
          <li className={router.pathname === "/bridge" ? "active" : ""}>
            <Link href="/bridge">USDC Bridge</Link>
          </li>
          <li>
            <a href="https://docs.stableit.com">Stable SDK</a>
          </li>
          <li>
            <a href="https://blog.stableit.com/enter-stable">Why Stable</a>
          </li>
          <li>
            <a href="mailto:hello@stable.io">Reach out</a>
          </li>
        </ul>
        <button className="hamburger-menu">
          <Image
            src="/imgs/hamburger-menu.svg"
            alt=""
            unoptimized
            height={20}
            width={20}
          />
        </button>
      </div>
    </div>
  );
};
