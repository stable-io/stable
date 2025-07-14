import type { DeriveType, Layout } from "binary-layout";
import { enumItem, optionItem, setEndianness } from "binary-layout";
import { zip, fromEntries, difference, valueIndexEntries } from "@stable-io/map-utils";
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
  v1,
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
  eventLayout,
  accountLayout,
  instructionLayout,
  bumpItem,
  solanaAddressItem,
  vecItem,
} from "@stable-io/cctp-sdk-solana";

const endianness = "little";
const littleEndian = <const L extends Layout>(layout: L) => setEndianness(layout, endianness);

const foreignDomainItem = domainItem(difference(domains, ["Solana"]));
const rawEvmAddressItem = { binary: "bytes", size: 20 } as const;
const oracleChainIdItem = { binary: "uint", size: 2, endianness } as const;

const feeAdjustmentLayout = littleEndian([
  { name: "absolute", ...amountItem(4, Usdc), binary: "int" },
  { name: "relative", ...amountItem(4, Percentage, "bp")    },
]);
export type FeeAdjustment =
  DeriveType<typeof feeAdjustmentLayout>;

// ---- Event ----

export const relayRequestEventLayout =
  eventLayout("relay_request", littleEndian([
    { name: "v1Nonce",    ...v1.nonceItem   },
    { name: "gasDropoff", ...gasDropoffItem },
  ]));
export type RelayRequestEvent =
  DeriveType<typeof relayRequestEventLayout>;

// ---- State ----

export const configLayout =
  accountLayout("Config", [
    { name: "bump",           ...bumpItem          },
    { name: "owner",          ...solanaAddressItem },
    { name: "pendingOwner",   ...solanaAddressItem },
    { name: "feeAdjuster",    ...solanaAddressItem },
    { name: "feeRecipient",   ...solanaAddressItem },
    { name: "offchainQuoter", ...rawEvmAddressItem },
  ]);
export type Config =
  DeriveType<typeof configLayout>;

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

export const chainConfigLayout =
  accountLayout("ChainConfig", littleEndian([
    { name: "domain",         ...foreignDomainItem  },
    { name: "oracleChainId",  ...oracleChainIdItem  },
    { name: "feeAdjustments", ...feeAdjustmentsItem },
  ]));
export type ChainConfig =
  DeriveType<typeof chainConfigLayout>;

// ---- Transfer Instruction ----

const solanaUserQuoteVariantItem =
  userQuoteVariantItem(Sol, [{ name: "maxRelayFeeSol", ...amountItem(8, Sol) }]);

const gaslessParamsItem = optionItem(littleEndian([
  { name: "gaslessFeeUsdc", ...usdcItem      },
  { name: "expirationTime", ...timestampItem },
]));
export type GaslessParams = DeriveType<typeof gaslessParamsItem>;

export const transferWithRelayParamsLayout =
  instructionLayout("transfer_with_relay", littleEndian([
    { name: "inputAmount",     ...usdcItem                   },
    { name: "mintRecipient",   ...universalAddressItem       },
    { name: "gasDropoff",      ...gasDropoffItem             },
    { name: "corridorVariant", ...corridorVariantItem        },
    { name: "quoteVariant",    ...solanaUserQuoteVariantItem },
    { name: "gaslessParams",   ...gaslessParamsItem          },
  ]));
export type TransferWithRelayParams =
  DeriveType<typeof transferWithRelayParamsLayout>;

// ---- Operations Instructions ----

export const reclaimRentParamsLayout =
  instructionLayout("reclaim_rent", [
    { name: "attestation",          ...signatureItem },
    { name: "v2DestinationMessage", ...vecItem()     },
  ]);
export type ReclaimRentParams =
  DeriveType<typeof reclaimRentParamsLayout>;

export const transferSurplusSolParamsLayout =
  instructionLayout("transfer_surplus_sol", []);
export type TransferSurplusSolParams =
  DeriveType<typeof transferSurplusSolParamsLayout>;

// ---- Setup Instructions ----

export const initializeParamsLayout =
  instructionLayout("initialize", littleEndian([
    { name: "owner",          ...solanaAddressItem },
    { name: "feeAdjuster",    ...solanaAddressItem },
    { name: "feeRecipient",   ...solanaAddressItem },
    { name: "offchainQuoter", ...rawEvmAddressItem },
  ]));
export type InitializeParams =
  DeriveType<typeof initializeParamsLayout>;

export const registerChainParamsLayout =
  instructionLayout("register_chain", littleEndian([
    { name: "domain",        ...foreignDomainItem },
    { name: "oracleChainId", ...oracleChainIdItem },
  ]));
export type RegisterChainParams =
  DeriveType<typeof registerChainParamsLayout>;

export const deregisterChainParamsLayout =
  instructionLayout("deregister_chain", []);
export type DeregisterChainParams =
  DeriveType<typeof deregisterChainParamsLayout>;

const feeAdjustmentTypeItem = enumItem(valueIndexEntries(feeAdjustmentTypes));
export const updateFeeAdjustmentParamsLayout =
  instructionLayout("update_fee_adjustment", ([
    { name: "adjustmentType", ...feeAdjustmentTypeItem },
    ...feeAdjustmentLayout,
  ]));
export type UpdateFeeAdjustmentParams =
  DeriveType<typeof updateFeeAdjustmentParamsLayout>;

// ---- Role Update Instructions ----

export const submitOwnerTransferRequestParamsLayout =
  instructionLayout("submit_owner_transfer_request", ([
    { name: "newOwner", ...solanaAddressItem },
  ]));
export type SubmitOwnerTransferRequestParams =
  DeriveType<typeof submitOwnerTransferRequestParamsLayout>;

export const cancelOwnerTransferRequestParamsLayout =
  instructionLayout("cancel_owner_transfer_request", []);
export type CancelOwnerTransferRequestParams =
  DeriveType<typeof cancelOwnerTransferRequestParamsLayout>;

export const confirmOwnerTransferRequestParamsLayout =
  instructionLayout("confirm_owner_transfer_request", []);
export type ConfirmOwnerTransferRequestParams =
  DeriveType<typeof confirmOwnerTransferRequestParamsLayout>;

export const updateFeeRecipientParamsLayout =
  instructionLayout("update_fee_recipient", ([
    { name: "newFeeRecipient", ...solanaAddressItem },
  ]));
export type UpdateFeeRecipientParams =
  DeriveType<typeof updateFeeRecipientParamsLayout>;

export const updateFeeAdjusterParamsLayout =
  instructionLayout("update_fee_adjuster", ([
    { name: "newFeeAdjuster", ...solanaAddressItem },
  ]));
export type UpdateFeeAdjusterParams =
  DeriveType<typeof updateFeeAdjusterParamsLayout>;

export const updateOffchainQuoterParamsLayout =
  instructionLayout("update_offchain_quoter", ([
    { name: "newOffchainQuoter", ...rawEvmAddressItem },
  ]));
export type UpdateOffchainQuoterParams =
  DeriveType<typeof updateOffchainQuoterParamsLayout>;
