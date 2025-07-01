import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

export const Footer = (): ReactElement => (
  <footer>
    <div className="left">
      <ul className="footer-links">
        <li>
          <Link href="/bridge">Bridge USDC</Link>
        </li>
        <li>
          <Link href="https://docs.stableit.com/">Docs</Link>
        </li>
        <li>
          <Link href="https://github.com/stable-io/stable" target="_blank">
            Github
          </Link>
        </li>
      </ul>
      <ul className="footer-links">
        <li>
          <Link href="https://blog.stableit.com/enter-stable">
            Why Stableit
          </Link>
        </li>
        <li>
          <Link href="https://blog.stableit.com">Blog</Link>
        </li>
        <li>
          <Link href="https://x.com/stable_it" target="_blank">
            Twitter
          </Link>
        </li>
        <li>
          <Link href="mailto:hello@stableit.com">Reach out</Link>
        </li>
      </ul>
    </div>
    <div className="right">
      <Link href="/">
        <Image
          alt="stableit-logo"
          src="/imgs/logo-bw.png"
          className="footer-logo"
          unoptimized
          width={175}
          height={35}
        />
      </Link>
      <ul className="footer-socialmedia">
        <li>
          <a href="https://x.com/stable_it" target="_blank">
            <button className="social-media-btn">
              <Image
                src="/imgs/x-logo.svg"
                alt=""
                unoptimized
                height={12}
                width={12}
              />
            </button>
          </a>
        </li>
      </ul>
    </div>
  </footer>
);
