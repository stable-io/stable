import Image from "next/image";
import type { ReactElement } from "react";

export const Footer = (): ReactElement => (
  <footer>
    <div className="left"></div>
    <div className="right">
      <ul>
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
