import type { DeriveType, ProperLayout } from "binary-layout";
import { calcStaticSize, optionItem } from "binary-layout";
import type { KindWithHuman } from "@stable-io/amount";
import {
  amountItem,
  conversionItem,
  paddingItem,
  linearTransform,
  Sol,
  EvmGasToken,
  Sui,
  Gas,
  ComputeUnit,
  Byte,
  Percentage,
  wormholeChainIdItem,
} from "@stable-io/cctp-sdk-definitions";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import { usdcItem } from "@stable-io/cctp-sdk-cctpr-definitions";
import { littleEndian,solanaAddressItem } from "@stable-io/cctp-sdk-solana";
import { foreignDomains } from "./constants.js";

export const oracleChainIdItem = <N extends Network>(network: N) =>
  wormholeChainIdItem(network, foreignDomains(network));

export const oracleConfigLayout = littleEndian([
  { name: "owner",        ...solanaAddressItem             },
  { name: "pendingOwner", ...optionItem(solanaAddressItem) },
  { name: "solPrice",     ...conversionItem(usdcItem, Sol) },
] as const);

const platformPriceSpace = 16;
const platformPriceLayout = <const L extends ProperLayout>(layout: L) => littleEndian([
  ...layout,
  { name: "reserved", ...paddingItem(platformPriceSpace - calcStaticSize(layout)!) }
]);

const mweiAmount = amountItem(4, EvmGasToken, linearTransform("to->from", 10n**6n));
const evmPricesLayout = platformPriceLayout([
  { name: "gasPrice",       ...conversionItem(mweiAmount, Gas ) },
  { name: "pricePerTxByte", ...conversionItem(mweiAmount, Byte) },
]);
export type EvmPrices = DeriveType<typeof evmPricesLayout>;

const mistAmount = amountItem(4, Sui);
const suiPricesLayout = platformPriceLayout([
  { name: "computeUnitPrice", ...conversionItem(mistAmount, ComputeUnit) },
  { name: "bytePrice",        ...conversionItem(mistAmount, Byte)        },
  { name: "rebateRatio",      ...amountItem(1, Percentage, "%")          },
]);
export type SuiPrices = DeriveType<typeof suiPricesLayout>;

export const priceStateLayoutTemplate = <
  N extends Network,
  const L extends ProperLayout,
  const K extends KindWithHuman,
>(network: N, layout: L, kind: K) => ([
    { name: "oracleChainId", ...oracleChainIdItem(network) },
    { name: "gasTokenPrice", ...conversionItem(usdcItem, kind) },
    ...layout,
  ] as const);

export const priceStateLayout = <N extends Network>(network: N) => ({
  Evm: priceStateLayoutTemplate(network, evmPricesLayout, EvmGasToken),
  Sui: priceStateLayoutTemplate(network, suiPricesLayout, Sui),
} as const);
export type PriceState<N extends Network, P extends keyof ReturnType<typeof priceStateLayout<N>>> =
  DeriveType<ReturnType<typeof priceStateLayout<N>>[P]>;
