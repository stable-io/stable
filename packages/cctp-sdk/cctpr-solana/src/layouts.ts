import type { DeriveType, Layout } from "binary-layout";
import { optionItem, setEndianness } from "binary-layout";
import { zip, fromEntries, difference } from "@stable-io/map-utils";
import {
  Usdc,
  Sol,
  Percentage,
  domainItem,
  universalAddressItem,
  signatureItem,
  amountItem,
  transform,
  domains,
  v2,
} from "@stable-io/cctp-sdk-definitions";
import {
  feeAdjustmentTypes,
  usdcItem,
  gasDropoffItem,
  corridorVariantItem,
  userQuoteVariantItem,
  timestampItem,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import {
  accountLayout,
  instructionLayout,
  bumpItem,
  solanaAddressItem,
  vecItem,
} from "@stable-io/cctp-sdk-solana";

const endianness = "little";

// ---- State ----

const rawEvmAddressItem = { binary: "bytes", size: 20 } as const;

export const configLayout = accountLayout("Config", [
  { name: "bump",           ...bumpItem          },
  { name: "owner",          ...solanaAddressItem },
  { name: "pendingOwner",   ...solanaAddressItem },
  { name: "feeAdjuster",    ...solanaAddressItem },
  { name: "feeRecipient",   ...solanaAddressItem },
  { name: "offchainQuoter", ...rawEvmAddressItem },
]);
export type Config = DeriveType<typeof configLayout>;

export const feeAdjustmentLayout = setEndianness([
  { name: "absolute", ...amountItem(4, Usdc), binary: "int" },
  { name: "relative", ...amountItem(4, Percentage, "bp")    },
], endianness);
export type FeeAdjustment = DeriveType<typeof feeAdjustmentLayout>;

const oracleChainIdItem = { binary: "uint", size: 2, endianness } as const;

const feeAdjustmentsArrayLayout = {
  binary: "array",
  length: feeAdjustmentTypes.length,
  layout: feeAdjustmentLayout,
} as const;
type FeeAdjustmentsArray = DeriveType<typeof feeAdjustmentsArrayLayout>;

const feeAdjustmentsItem = transform(
  feeAdjustmentsArrayLayout,
  derived => fromEntries(zip([feeAdjustmentTypes, derived])),
  transformed => feeAdjustmentTypes.map(t => transformed[t]) as unknown as FeeAdjustmentsArray,
);
export type FeeAdjustments = DeriveType<typeof feeAdjustmentsItem>;

const domainsWithoutSolana = difference(domains, ["Solana"]);
export const chainConfigLayout = accountLayout("ChainConfig", setEndianness([
  { name: "domain",         ...domainItem(domainsWithoutSolana) },
  { name: "oracleChainId",  ...oracleChainIdItem                },
  { name: "feeAdjustments", ...feeAdjustmentsItem               },
], endianness));
export type ChainConfig = DeriveType<typeof chainConfigLayout>;

// ---- Instructions ----

const solanaUserQuoteVariantItem =
  userQuoteVariantItem(Sol, [{ name: "maxRelayFeeSol", ...amountItem(8, Sol) }]);

const gaslessParamsItem = optionItem(setEndianness([
  { name: "gaslessFeeUsdc", ...usdcItem      },
  { name: "expirationTime", ...timestampItem },
], endianness));
export type GaslessParams = DeriveType<typeof gaslessParamsItem>;

export const transferWithRelayParamsLayout = instructionLayout("TransferWithRelay", setEndianness([
  { name: "inputAmount",     ...usdcItem                   },
  { name: "mintRecipient",   ...universalAddressItem       },
  { name: "gasDropoff",      ...gasDropoffItem             },
  { name: "corridorVariant", ...corridorVariantItem        },
  { name: "quoteVariant",    ...solanaUserQuoteVariantItem },
  { name: "gaslessParams",   ...gaslessParamsItem          },
], endianness));
export type TransferWithRelayParams = DeriveType<typeof transferWithRelayParamsLayout>;

export const reclaimRentParamsLayout = instructionLayout("ReclaimRent", [
  { name: "attestation",          ...signatureItem },
  { name: "v2DestinationMessage", ...vecItem()     },
]);
export type ReclaimRentParams = DeriveType<typeof reclaimRentParamsLayout>;
