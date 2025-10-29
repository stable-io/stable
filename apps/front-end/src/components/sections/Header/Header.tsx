// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactElement } from "react";
import { useState } from "react";

interface NavigationItem {
  href: string;
  label: string;
  isExternal?: boolean;
}

const navigationItems: NavigationItem[] = [
  { href: "/bridge", label: "USDC Bridge" },
  {
    href: "https://docs.stableit.com",
    label: "Stableit SDK",
    isExternal: true,
  },
  {
    href: "https://blog.stableit.com",
    label: "Why Stableit",
    isExternal: true,
  },
  { href: "mailto:hello@stableit.com", label: "Reach out", isExternal: true },
];

interface NavigationItemsProps {
  currentPath: string;
}

const NavigationItems = ({
  currentPath,
}: NavigationItemsProps): ReactElement => (
  <>
    {navigationItems.map((item) => (
      <li key={item.href} className={currentPath === item.href ? "active" : ""}>
        {item.isExternal ? (
          <a href={item.href}>{item.label}</a>
        ) : (
          <Link href={item.href}>{item.label}</Link>
        )}
      </li>
    ))}
  </>
);

export const Header = (): ReactElement => {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = (): void => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div test-id="header" className="top-nav">
      <div className="left">
        <Link href="/">
          <h1 className="logo"></h1>
        </Link>
      </div>
      <div className="right">
        <ul className="nav">
          <NavigationItems currentPath={router.pathname} />
        </ul>
        <button className="hamburger-menu" onClick={toggleMobileMenu}>
          <Image
            src="/imgs/hamburger-menu.svg"
            alt=""
            unoptimized
            height={20}
            width={20}
          />
        </button>
      </div>
      {isMobileMenuOpen && (
        <ul className="mobile-nav">
          <NavigationItems currentPath={router.pathname} />
        </ul>
      )}
    </div>
  );
};
