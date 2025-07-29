import type { DeriveType, Layout } from "binary-layout";
import { enumItem, optionItem, setEndianness } from "binary-layout";
import { mapTo, zip, fromEntries, valueIndexEntries } from "@stable-io/map-utils";
import type { Network } from "@stable-io/cctp-sdk-definitions";
import {
  Usdc,
  Sol,
  Percentage,
  domainItem,
  universalAddressItem,
  signatureItem,
  amountItem,
  transform,
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
  littleEndian,
  eventLayout,
  accountLayout,
  instructionLayout,
  bumpItem,
  solanaAddressItem,
  vecItem,
} from "@stable-io/cctp-sdk-solana";
import { oracleChainIdItem } from "./oracleLayouts.js";
import { foreignDomains } from "./constants.js";

export const foreignDomainItem = <N extends Network>(network: N) =>
  domainItem(foreignDomains(network));
const rawEvmAddressItem = { binary: "bytes", size: 20 } as const;

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
} as const satisfies Layout;

const feeAdjustmentsItem = transform(
  feeAdjustmentsArrayLayout,
  derived => fromEntries(zip([feeAdjustmentTypes, derived])),
  transformed => mapTo(feeAdjustmentTypes)(t => transformed[t]),
) satisfies Layout;
export type FeeAdjustments = DeriveType<typeof feeAdjustmentsItem>;

export const chainConfigLayout = <N extends Network>(network: N) =>
  accountLayout("ChainConfig", littleEndian([
    { name: "domain",         ...foreignDomainItem(network) },
    { name: "oracleChainId",  ...oracleChainIdItem(network) },
    { name: "feeAdjustments", ...feeAdjustmentsItem         },
  ]));
export type ChainConfig<N extends Network> =
  DeriveType<ReturnType<typeof chainConfigLayout<N>>>;

// ---- Transfer Instruction ----

const solanaUserQuoteVariantItem =
  userQuoteVariantItem(Sol, [{ name: "maxRelayFeeSol", ...amountItem(8, Sol) }]);
export type UserQuoteVariant = DeriveType<typeof solanaUserQuoteVariantItem>;

const gaslessParamsLayout = [
  { name: "gaslessFeeUsdc", ...usdcItem      },
  { name: "expirationTime", ...timestampItem },
] as const satisfies Layout;
export type GaslessParams = DeriveType<typeof gaslessParamsLayout>;

const gaslessParamsItem = optionItem(littleEndian(gaslessParamsLayout));
export const eventDataSeedItem = { binary: "bytes", size: 4 } as const;
export type EventDataSeed = DeriveType<typeof eventDataSeedItem>;

export const transferWithRelayParamsLayout =
  instructionLayout("transfer_with_relay", littleEndian([
    { name: "inputAmount",     ...usdcItem                   },
    { name: "mintRecipient",   ...universalAddressItem       },
    { name: "gasDropoff",      ...gasDropoffItem             },
    { name: "corridorVariant", ...corridorVariantItem        },
    { name: "quoteVariant",    ...solanaUserQuoteVariantItem },
    { name: "gaslessParams",   ...gaslessParamsItem          },
    { name: "eventDataSeed",   ...eventDataSeedItem          },
    { name: "eventDataBump",   ...bumpItem                   },
  ]));
export type TransferWithRelayParams =
  DeriveType<typeof transferWithRelayParamsLayout>;

// ---- Operations Instructions ----

//it's sorta silly to pass in the attestation as a vec because we know it's a 65 byte signature
//  but this saves us from having to do a memcopy in the contract and if attestations ever change
//  length then we haven't committed to anything (the way a [u8; 65] would) on-chain but only have
//  to change the layout here
const signatureVecLengthItem = { binary: "uint", size: 4, custom: 65, omit: true } as const;
export const reclaimRentParamsLayout =
  instructionLayout("reclaim_rent", littleEndian([
    { name: "_attestationLength",   ...signatureVecLengthItem },
    { name: "attestation",          ...signatureItem          },
    { name: "v2DestinationMessage", ...vecItem()              },
  ]));
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

export const registerChainParamsLayout = <N extends Network>(network: N) =>
  instructionLayout("register_chain", littleEndian([
    { name: "domain",        ...foreignDomainItem(network) },
    { name: "oracleChainId", ...oracleChainIdItem(network) },
  ]));
export type RegisterChainParams<N extends Network> =
  DeriveType<ReturnType<typeof registerChainParamsLayout<N>>>;

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
