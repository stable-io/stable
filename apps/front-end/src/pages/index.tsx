import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

import { LandingLayout } from "@/components";
import type { NextPageWithLayout } from "@/utils";

const Home: NextPageWithLayout = (): ReactElement => (
  <>
    <Head>
      <title>
        Stable | Move USDC across networks with high speed and minimal costs
      </title>
    </Head>
    <div className="hero">
      <div className="left">
        <h1 style={{ color: "#29233C" }}>
          Move <span style={{ color: "#7667EC" }}>USDC</span> across chains.
          Blazing <span style={{ color: "#48C6DA" }}>FAST!</span>
        </h1>
        <h2>
          Powered by Circle, Stable&apos;s SDK enables instant USDC transfers
          across networks.
        </h2>
        <Link href="/bridge" className="bridge-link">
          <button className="main-cta">Bridge Now</button>
        </Link>
        <Link
          href="https://docs.stable.io"
          className="docs-link"
          style={{ marginLeft: "20px" }}
        >
          <button className="text-cta">Start building →</button>
        </Link>
      </div>
      <div className="right transfer-widget-placeholder-container">
        <Link href="/bridge">
          <div className="widget-placeholder">
            <Image
              unoptimized
              width={500}
              height={623}
              alt="transfer-widget"
              src="/imgs/transfer-widget-placeholder.png"
            />
            <div className="placeholder-overlay"></div>
          </div>
        </Link>
      </div>
    </div>
    <div className="offerings">
      <ul>
        <li>
          <Image
            src="/imgs/radial-circle-0.png"
            className="icon"
            unoptimized
            width={64}
            height={64}
            alt="step-0-image"
          />
          <h3>Fast & cost-efficient USDC transfers</h3>
          <p>
            Seamlessly move USDC across networks with high speed and minimal
            costs.
          </p>
        </li>
        <li>
          <Image
            src="/imgs/radial-circle-1.png"
            className="icon"
            unoptimized
            width={64}
            height={64}
            alt="step-1-image"
          />
          <h3>Built for developers, designed for scale</h3>
          <p>
            A developer-friendly SDK designed for a smooth, intuitive
            integration experience.
          </p>
        </li>
        <li>
          <Image
            src="/imgs/radial-circle-2.png"
            className="icon"
            unoptimized
            width={64}
            height={64}
            alt="step-2-image"
          />
          <h3>All the features you need and more..</h3>
          <p>
            Mainnet and testnet support, gas drop-off, live transfer tracking,
            and a lot more!
          </p>
        </li>
      </ul>
    </div>

    <div className="sdk-steps">
      <h2>The SDK to Move USDC in 1-2-3</h2>
      <div className="steps-container">
        <ul className="steps">
          <li className="step">
            <div className="icon">
              <span>1</span>
            </div>
            <div className="details">
              <div className="step-title">Initialize The SDK</div>
              <div className="step-desc">
                Create a StableSDK instance by providing a network, signer, and
                optional RPCs.
              </div>
            </div>
          </li>
          <li className="step step-follow">
            <div className="icon"></div>
          </li>
          <li className="step">
            <div className="icon">
              <span>2</span>
            </div>
            <div className="details">
              <div className="step-title">Find Routes</div>
              <div className="step-desc">
                Provide the source/target chains, amount, and addresses to get
                available transfer routes.
              </div>
            </div>
          </li>
          <li className="step step-follow">
            <div className="icon"></div>
          </li>
          <li className="step">
            <div className="icon" style={{ border: "0px" }}>
              <span>🎉</span>
            </div>
            <div className="details">
              <div className="step-title">Execute The Transfer</div>
              <div className="step-desc">
                Execute the route to sign and submit all required transactions.
                It’s that simple!
              </div>
            </div>
          </li>
        </ul>
        <Link href="https://docs.stable.io/">
          <button className="main-cta">Start building →</button>
        </Link>
      </div>
    </div>
  </>
);

Home.getLayout = (page: ReactElement): ReactElement => (
  <LandingLayout>{page}</LandingLayout>
);

export default Home;
