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
          <Link href="https://docs.stable.io/">Docs</Link>
        </li>
        <li>
          <Link href="https://github.com/stable-io/stable" target="_blank">
            Github
          </Link>
        </li>
      </ul>
      <ul className="footer-links">
        <li>
          <Link href="https://blog.stable.io">Why Stable</Link>
        </li>
        <li>
          <Link href="https://blog.stable.io">Blog</Link>
        </li>
        <li>
          <Link href="https://x.com/stable_io" target="_blank">
            Twitter
          </Link>
        </li>
        <li>
          <Link href="mailto:hello@stable.io">Reach out</Link>
        </li>
      </ul>
    </div>
    <div className="right">
      <Link href="/">
        <Image
          alt="stable-logo"
          src="/imgs/logo-bw.png"
          className="footer-logo"
          width={170}
          height={40}
          unoptimized
        />
      </Link>
      <ul className="footer-socialmedia">
        <li>
          <a href="https://x.com/stable_io" target="_blank">
            <button className="social-media-btn">
              <Image
                src="/imgs/x-logo.svg"
                alt=""
                unoptimized
                height={14}
                width={14}
                style={{ width: "12px", height: "12px" }}
              />
            </button>
          </a>
        </li>
      </ul>
    </div>
  </footer>
);
