import type { Network, Route } from "@stable-io/sdk";
import Head from "next/head";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ChainSelect } from "@/components";
import type { AvailableChains, GasDropoffLevel } from "@/constants";
import { availableChains, gasDropoffs } from "@/constants";
import { account, stable } from "@/context";
import { formatNumber, truncateAddress } from "@/utils";

const getExplorerUrl = (network: Network, txHash: string): string =>
  `https://wormholescan.io/#/tx/${txHash}?network=${network}`;

const Home = () => {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState(0);
  const [gasDropoffLevel, setGasDropoffLevel] =
    useState<GasDropoffLevel>("zero");
  const gasDropoffDesired = gasDropoffs[gasDropoffLevel];
  const [route, setRoute] = useState<Route | undefined>();
  const [isInProgress, setIsInProgress] = useState(false);
  const [txHashes, setTxHashes] = useState<readonly string[] | undefined>();
  const explorerUrl = txHashes
    ? getExplorerUrl("Testnet", txHashes.at(-1)!)
    : "#";

  const [sourceChain, setSourceChain] = useState<AvailableChains>(
    availableChains[0],
  );
  const [targetChain, setTargetChain] = useState<AvailableChains>(
    availableChains[1],
  );

  const updateBalance = useCallback(() => {
    stable
      .getBalance(account.address, [sourceChain])
      .then((balances) => {
        setBalance(Number.parseFloat(balances[sourceChain]));
      })
      .catch((error: unknown) => {
        console.error(error);
      });
  }, [sourceChain]);

  const estimatedDuration = route?.estimatedDuration.toString(10) ?? "??";

  // @todo: Subtract expected fees
  // const maxAmount = balance;
  // const handleMaxAmount = () => {
  //   setAmount(maxAmount);
  // };

  const handleSelectSourceChain = (chain: AvailableChains): void => {
    setSourceChain(chain);
    if (targetChain === chain) {
      setTargetChain(sourceChain);
    }
  };

  const handleSelectTargetChain = (chain: AvailableChains): void => {
    setTargetChain(chain);
    if (sourceChain === chain) {
      setSourceChain(targetChain);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = Number.parseFloat(e.target.value) || 0;
    setAmount(newAmount);
  };

  const handleTransfer = () => {
    if (!route) {
      return;
    }
    setIsInProgress(true);
    setTxHashes(undefined);
    stable
      .executeRoute(route)
      .then((txHashes) => {
        setTxHashes(txHashes);
        updateBalance();
      })
      .catch((error: unknown) => {
        console.error(error);
      })
      .finally(() => {
        setIsInProgress(false);
      });
  };

  useEffect(() => {
    updateBalance();
  }, [updateBalance]);

  useEffect(() => {
    setRoute(undefined);
    stable
      .findRoutes(
        {
          sourceChain,
          targetChain,
          amount: amount.toString(10),
          sender: account.address,
          recipient: account.address,
          gasDropoffDesired,
        },
        {},
      )
      .then((result) => {
        setRoute(result.all[result.fastest]);
      })
      .catch((error: unknown) => {
        console.error(error);
      });
  }, [amount, gasDropoffDesired, sourceChain, targetChain]);

  return (
    <>
      <Head>
        <title>
          Stable | Move USDC across networks with high speed and minimal costs
        </title>
      </Head>
      {txHashes && (
        <div className="top">
          <div className="alert alert-success">
            <h3>Transfer Complete</h3>
            {/* @todo: Add explorer link */}
            <p>
              Your USDC has been successfully bridged to {targetChain}. You can
              now view it in your wallet or explore the transaction on{" "}
              <a href={explorerUrl} target="_blank">
                our explorer
              </a>
              .
            </p>
          </div>
        </div>
      )}
      <div className="left" style={{ width: "50%" }}>
        <div className="bridge-widget">
          <div className="widget-title">
            <h2>Transfer USDC</h2>
          </div>
          <div className="widget-body">
            <div className="select-section select-from-section">
              <div className="network-settings">
                <div className="left">
                  <ChainSelect
                    title="From"
                    chains={availableChains}
                    selectedChain={sourceChain}
                    onSelect={handleSelectSourceChain}
                  />
                </div>
                <div className="right">
                  <div className="wallet-chip">
                    <Image
                      src="/imgs/metamask-logo.svg"
                      alt="MetaMask"
                      className="wallet-icon"
                      unoptimized
                      height={16}
                      width={16}
                    />
                    <span className="address">
                      {truncateAddress(account.address)}
                    </span>
                    <button className="edit-btn">Edit</button>
                  </div>
                  <div className="balance">
                    <span>Balance: {formatNumber(balance)} USDC</span>
                  </div>
                </div>
              </div>

              <div className="amount-section">
                <Image
                  src="/imgs/usdc-icon.svg"
                  alt="USDC"
                  className="usdc-icon"
                  unoptimized
                  height={32}
                  width={32}
                />
                <input
                  type="number"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="Enter amount"
                  min="0"
                  // max={maxAmount} // @todo
                  step="0.000001"
                />
                {/* <button className="max-button" onClick={handleMaxAmount}>MAX</button> */}
              </div>
            </div>

            <div className="divider">
              <div className="icon-circle">
                <Image
                  src="/imgs/arrow-long-down.svg"
                  alt=""
                  className="arrow-icon"
                  unoptimized
                  height={12}
                  width={10}
                />
              </div>
            </div>

            <div className="select-section select-from-section">
              <div className="network-settings">
                <div className="left">
                  <ChainSelect
                    title="To"
                    chains={availableChains}
                    selectedChain={targetChain}
                    onSelect={handleSelectTargetChain}
                  />
                </div>
                <div className="right">
                  <div className="wallet-chip">
                    <Image
                      src="/imgs/metamask-logo.svg"
                      alt="MetaMask"
                      className="wallet-icon"
                      unoptimized
                      height={16}
                      width={16}
                    />
                    <span className="address">
                      {truncateAddress(account.address)}
                    </span>
                    <button className="edit-btn">Edit</button>
                  </div>
                </div>
              </div>
              <div className="gas-settings">
                <div className="left">
                  <span className="label">Destination gas</span>
                  <div className="tooltip">
                    <Image
                      src="/imgs/tooltip.svg"
                      alt=""
                      className="tooltip-icon"
                      unoptimized
                      height={14}
                      width={14}
                    />
                  </div>
                  <div className="options">
                    <button
                      className={`option ${gasDropoffLevel === "zero" ? "active" : ""}`}
                      onClick={() => setGasDropoffLevel("zero")}
                    >
                      Zero
                    </button>
                    <button
                      className={`option ${gasDropoffLevel === "low" ? "active" : ""}`}
                      onClick={() => setGasDropoffLevel("low")}
                    >
                      Low
                    </button>
                    <button
                      className={`option ${gasDropoffLevel === "avg" ? "active" : ""}`}
                      onClick={() => setGasDropoffLevel("avg")}
                    >
                      Avg
                    </button>
                    <button
                      className={`option ${gasDropoffLevel === "high" ? "active" : ""}`}
                      onClick={() => setGasDropoffLevel("high")}
                    >
                      High
                    </button>
                  </div>
                </div>
                <div className="right">
                  <div className="gas-settings-fees">
                    <div className="fee-row">
                      <span className="currency">USDC</span>
                      <span className="value">0.0</span>
                    </div>
                    <div className="fee-row">
                      <span className="currency">OPT</span>
                      <span className="value">~0.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="divider" style={{ margin: "25px 0px" }}></div>

            {route && (
              <>
                <div className="route-summary">
                  <div className="left">
                    <Image
                      src="/imgs/route.svg"
                      alt=""
                      className="route-icon"
                      unoptimized
                      height={18}
                      width={18}
                    />
                    <span>
                      Route: <strong>{route.corridor}</strong>
                    </span>
                    <span className="badge badge-green">Best Route</span>
                  </div>
                  <div className="right">
                    <div className="meta">
                      <Image
                        src="/imgs/gas.svg"
                        className="icon"
                        alt="Gas fees"
                        unoptimized
                        height={16}
                        width={16}
                      />
                      <span>$3.20</span>
                    </div>
                    <div className="meta">
                      <Image
                        src="/imgs/time.svg"
                        className="icon"
                        alt="Duration"
                        unoptimized
                        height={16}
                        width={16}
                      />
                      <span>~{estimatedDuration} seconds</span>
                    </div>
                  </div>
                </div>

                <div className="divider" style={{ margin: "25px 0px" }}></div>
              </>
            )}

            <div className="summary">
              <div className="row">
                <span className="label">Estimated time</span>
                <span className="value">~{estimatedDuration} seconds</span>
              </div>
              {/* <div className="row">
                    <span className="label">Bridge fee</span>
                    <span className="value">$2.00</span>
                  </div> */}
              <div className="row">
                <span className="label">Destination gas</span>
                <span className="value">$0.00</span>
              </div>
              <div className="row total">
                <span className="label">You receive</span>
                <span className="value">
                  <Image
                    src="/imgs/usdc-icon.svg"
                    alt="USDC"
                    className="usdc-icon"
                    unoptimized
                    height={32}
                    width={32}
                  />
                  {formatNumber(amount)} USDC
                </span>
              </div>
            </div>

            <div className="main-cta-container">
              <button
                className="main-cta"
                disabled={!route}
                onClick={handleTransfer}
              >
                {isInProgress && <div className="spinner"></div>}
                <span>Confirm Transfer</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        className="right"
        style={{ width: "calc(100% - 50% - 30px)", marginLeft: "30px" }}
      >
        <div className="sidebar">
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
      </div>
    </>
  );
};

export default Home;
