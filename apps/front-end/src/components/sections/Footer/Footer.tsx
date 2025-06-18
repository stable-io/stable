import Image from "next/image";
import type { ReactElement } from "react";

export const Footer = (): ReactElement => (
  <footer>
    <div className="left">
      <ul className="footer-links">
        <li><a href="/bridge">Bridge USDC</a></li>
        <li><a href="https://docs.stable.io/">Docs</a></li>
        <li><a href="https://github.com/stable-io/stable" target="_blank">Github</a></li>
      </ul>
      <ul className="footer-links">
        <li><a href="https://blog.stable.io">Why Stable</a></li>
        <li><a href="https://blog.stable.io">Blog</a></li>
        <li><a href="https://x.com/stable_io" target="_blank">Twitter</a></li>
        <li><a href="mailto:hello@stable.io">Reach out</a></li>
      </ul>
    </div>
    <div className="right">
      <a href="/">
        <Image
          alt="stable-logo"
          src="/imgs/logo-bw.png"
          className="footer-logo"
          width={170}
          height={40}
          unoptimized
        />
      </a>
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
