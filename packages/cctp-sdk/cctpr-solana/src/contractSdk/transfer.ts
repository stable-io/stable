// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import type {
  TransactionMessage,
  Nonce,
  TransactionMessageWithFeePayer,
  TransactionMessageWithDurableNonceLifetime,
} from "@solana/kit";
import {
  AccountRole,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingDurableNonce,
} from "@solana/kit";
import { serialize, deserialize } from "binary-layout";
import type { Text } from "@stable-io/utils";
import { definedOrThrow, encoding } from "@stable-io/utils";
import type { RoPair, RoArray, Replace } from "@stable-io/map-utils";
import { zip, chunk, fromEntries } from "@stable-io/map-utils";
import type { KindWithAtomic, Amount } from "@stable-io/amount";
import { Conversion } from "@stable-io/amount";
import type { Network, GasTokenOf, Percentage } from "@stable-io/cctp-sdk-definitions";
import {
  UniversalAddress,
  Usdc,
  usdc,
  Sol,
  sol,
  Gas,
  gas,
  sui,
  ComputeUnit,
  computeUnit,
  Byte,
  byte,
  GenericGasToken,
  genericGasToken,
  mulPercentage,
  platformOf,
  usdcContracts,
} from "@stable-io/cctp-sdk-definitions";
import type {
  InOrOut,
  Corridor,
  QuoteParams,
  QuoteBase,
  UsdcQuote,
  CorridorParamsBase,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import {
  timestampItem,
  checkIsSensibleCorridor,
  routerHookDataSize,
  calcUsdcAmounts,
  toCorridorVariant,
  quoteIsInUsdc,
} from "@stable-io/cctp-sdk-cctpr-definitions";
import {
  SolanaAddress,
  findPda,
  findAta,
  systemProgramId,
  tokenProgramId,
  cctpAccounts,
  v1SentEventDataSize,
  v2SentEventDataSize,
  minimumBalanceForRentExemption,
  durableNonceAccountLayout,
} from "@stable-io/cctp-sdk-solana";
import { type ForeignDomain, executionCosts } from "./constants.js";
import type {
  FeeAdjustment,
  GaslessParams,
  UserQuoteVariant,
  EventDataSeed,
} from "./layouts.js";
import { chainConfigLayout, transferWithRelayParamsLayout } from "./layouts.js";
import type { PriceState } from "./oracleLayouts.js";
import { configLayout as oracleConfigLayout, priceStateLayout } from "./oracleLayouts.js";
import { CctpRBase } from "./base.js";

const priceAccountsPerDomain = 2; //i.e. PriceAddresses["length"]

export type QuoteRelay<N extends Network> =
  Replace<QuoteParams<N>, "destinationDomain", ForeignDomain<N>>;

export type Quote<N extends Network> = QuoteBase<N, "Solana", "Solana">;

export type CorridorParams<N extends Network, DD extends ForeignDomain<N>> =
  CorridorParamsBase<N, "Solana", "Solana", DD>;

export type OnChainRelayQueryResult = RoPair<RoArray<Usdc>, Conversion<typeof Usdc, typeof Sol>>;

//TODO: remove this and all its mentions once Sui is actually a legitimate foreign domain
//  (The code here already supports Sui, but Sui is not yet part of the supported domains of CctpR
//   and hence ForeignDomain doesn't include Sui yet and so neither does platformOf(foreignDomain))
type ForeignPlatformHack = "Evm" | "Sui";
const hackPlatformOf = <N extends Network>(domain: ForeignDomain<N>) =>
  platformOf(domain) as ForeignPlatformHack;

//TODO: find a better place for this once Sui gets implemented
//  (but make sure it goes into the definitions package to avoid cross-dependencies)
const suiMinTransactionCost = sui(2000, "atomic");

export class CctpR<N extends Network> extends CctpRBase<N> {
  async transferWithRelay<DD extends ForeignDomain<N>>(
    destination: DD,
    inOrOut: InOrOut, //meaningless distinction, if relay fee is paid in gas and corridor is v1
    mintRecipient: UniversalAddress,
    gasDropoff: GasTokenOf<DD, ForeignDomain<N>>,
    corridor: CorridorParams<N, DD>,
    quote: Quote<N>,
    user: SolanaAddress,
    opts?: { userUsdc?: SolanaAddress; eventDataSeed?: EventDataSeed },
  ): Promise<TransactionMessage & TransactionMessageWithFeePayer> {
    checkIsSensibleCorridor(this.network, "Solana", destination, corridor.type);

    const userQuote = (
      quote.type === "offChain"
      ? { type: "offChain",
          expirationTime: quote.expirationTime,
          quoterSignature: quote.quoterSignature,
          relayFee: quote.relayFee.kind.name === "Usdc"
            ? { payIn: "usdc",     amount: quote.relayFee as Usdc               }
            : { payIn: "gasToken", amount: sol(quote.relayFee.toUnit("human")) },
        }
      : quoteIsInUsdc(quote)
      ? { type: "onChainUsdc",
          takeRelayFeeFromInput: inOrOut.type === "in",
          maxRelayFeeUsdc: quote.maxRelayFee,
        }
      : { type: "onChainGas",
          maxRelayFeeSol: quote.maxRelayFee as Sol,
        }
    ) satisfies UserQuoteVariant;

    return this.composeTransfer(
      destination,
      inOrOut,
      mintRecipient,
      gasDropoff,
      corridor,
      quote,
      userQuote,
      user,
      user,
      undefined,
      opts,
    );
  }

  async transferGasless<DD extends ForeignDomain<N>>(
    destination: DD,
    inOrOut: InOrOut,
    mintRecipient: UniversalAddress,
    gasDropoff: GasTokenOf<DD, ForeignDomain<N>>,
    corridor: CorridorParams<N, DD>,
    quote: UsdcQuote,
    user: SolanaAddress,
    deadline: Date,
    gaslessFee: Usdc,
    relayer: SolanaAddress,
    nonceAccount: SolanaAddress,
    opts?: { userUsdc?: SolanaAddress; eventDataSeed?: EventDataSeed },
  ): Promise<TransactionMessage &
             TransactionMessageWithFeePayer &
             TransactionMessageWithDurableNonceLifetime> {
    checkIsSensibleCorridor(this.network, "Solana", destination, corridor.type);

    const { blockhash } = definedOrThrow(
      await this.fetchAndParseAccountData(nonceAccount, durableNonceAccountLayout),
      `Failed to fetch blockhash from durable nonce account` as Text,
    );

    const gaslessQuote = (
      quote.type === "offChain"
      ? { type: "offChain",
          expirationTime: quote.expirationTime,
          quoterSignature: quote.quoterSignature,
          relayFee: {
            payIn: "usdc",
            amount: quote.relayFee,
          },
        }
      : { type: "onChainUsdc",
          takeRelayFeeFromInput: inOrOut.type === "in",
          maxRelayFeeUsdc: quote.maxRelayFee,
        }
    ) satisfies UserQuoteVariant;

    const tx = await this.composeTransfer(
      destination,
      inOrOut.type === "in" ? { type: "in", amount: inOrOut.amount.sub(gaslessFee) } : inOrOut,
      mintRecipient,
      gasDropoff,
      corridor,
      quote as Quote<N>,
      gaslessQuote,
      relayer,
      user,
      { gaslessFeeUsdc: gaslessFee, expirationTime: deadline },
      opts,
    );

    return setTransactionMessageLifetimeUsingDurableNonce(
      { nonce: encoding.base58.encode(blockhash) as Nonce,
        nonceAccountAddress: nonceAccount.unwrap(),
        nonceAuthorityAddress: relayer.unwrap(),
      },
      tx,
    );
  }

  private async composeTransfer<DD extends ForeignDomain<N>>(
    destination: DD,
    inOrOut: InOrOut,
    mintRecipient: UniversalAddress,
    gasDropoff: GasTokenOf<DD, ForeignDomain<N>>,
    corridor: CorridorParams<N, DD>,
    quote: Quote<N>,
    quoteVariant: UserQuoteVariant,
    relayer: SolanaAddress,
    user: SolanaAddress,
    gaslessParams: GaslessParams | undefined,
    opts?: { userUsdc?: SolanaAddress; eventDataSeed?: EventDataSeed },
  ): Promise<TransactionMessage & TransactionMessageWithFeePayer> {
    const usdcMint = new SolanaAddress(usdcContracts.contractAddressOf[this.network]["Solana"]);
    const userUsdc = opts?.userUsdc ?? findAta(user, usdcMint);
    const eventDataSeed = opts?.eventDataSeed ?? serialize(timestampItem, new Date());
    const [messageSentEventData, eventDataBump] = findPda([user, eventDataSeed], this.address);

    const config = this.configAddress();
    const rentCustodian = this.rentCustodianAddress();
    const oracleConfig = this.oracleConfigAddress();
    const [chainConfig, destinationPrices] = this.priceAddresses(destination);
    const avalanchePrices = corridor.type === "avaxHop"
      ? this.priceAddresses("Avalanche")[1]
      : this.address;

    const { feeRecipient } = await this.config();
    const feeRecipientUsdc = findAta(feeRecipient, usdcMint);

    const cctpAccs = cctpAccounts[this.network][corridor.type === "v1" ? "v1" : "v2"];
    const {
      messageTransmitter,
      messageTransmitterConfig,
      tokenMessenger,
      tokenMessengerConfig,
      tokenMinter,
      senderAuthority,
      remoteTokenMessengers,
      localToken,
      eventAuthority,
    } = cctpAccs;
    const remoteTokenMessenger =
      remoteTokenMessengers[corridor.type === "avaxHop" ? "Avalanche" : destination];
    const denylisted = corridor.type === "v1"
      ? this.address
      : (cctpAccs as Extract<typeof cctpAccs, { denylist: unknown }>).denylist(user);
    const cctprEventAuthority = findPda(["__event_authority"], this.address)[0];

    const accounts = [
      [relayer,                  AccountRole.WRITABLE_SIGNER],
      [user,                     AccountRole.READONLY_SIGNER],
      [config,                   AccountRole.READONLY       ],
      [chainConfig,              AccountRole.READONLY       ],
      [rentCustodian,            AccountRole.WRITABLE       ],
      [feeRecipient,             AccountRole.WRITABLE       ],
      [feeRecipientUsdc,         AccountRole.WRITABLE       ],
      [userUsdc,                 AccountRole.WRITABLE       ],
      [oracleConfig,             AccountRole.READONLY       ],
      [destinationPrices,        AccountRole.READONLY       ],
      [avalanchePrices,          AccountRole.READONLY       ],
      [messageSentEventData,     AccountRole.WRITABLE       ],
      [usdcMint,                 AccountRole.WRITABLE       ],
      [denylisted,               AccountRole.READONLY       ],
      [senderAuthority,          AccountRole.READONLY       ],
      [messageTransmitterConfig, AccountRole.WRITABLE       ],
      [tokenMessengerConfig,     AccountRole.READONLY       ],
      [remoteTokenMessenger,     AccountRole.READONLY       ],
      [tokenMinter,              AccountRole.READONLY       ],
      [localToken,               AccountRole.WRITABLE       ],
      [tokenMessenger,           AccountRole.READONLY       ],
      [messageTransmitter,       AccountRole.READONLY       ],
      [eventAuthority,           AccountRole.READONLY       ],
      [tokenProgramId,           AccountRole.READONLY       ],
      [systemProgramId,          AccountRole.READONLY       ],
      [cctprEventAuthority,      AccountRole.READONLY       ],
      [this.address,             AccountRole.READONLY       ],
    ] as const;

    const [, inputAmount, burnAmount] = calcUsdcAmounts(inOrOut, corridor, quote, usdc(0));
    const params = {
      inputAmount,
      mintRecipient,
      gasDropoff: genericGasToken(gasDropoff.toUnit("human")),
      corridorVariant: toCorridorVariant(corridor, burnAmount),
      quoteVariant,
      gaslessParams,
      eventDataSeed,
      eventDataBump,
    } as const;

    const transferIx = this.composeIx(accounts, transferWithRelayParamsLayout, params);

    return pipe(
      createTransactionMessage({ version: 0 }),
      tx => setTransactionMessageFeePayer(relayer.unwrap(), tx),
      tx => appendTransactionMessageInstructions([transferIx], tx),
    );
  }

  //WARNING: does not include the rent rebate for user instantiated (i.e. not gasless) transfers
  //use cctpMessageRentCost() and the returned solPrice to calculate the rebate as necessary
  async quoteOnChainRelay(queries: RoArray<QuoteRelay<N>>): Promise<OnChainRelayQueryResult> {
    const hasAvaxHopQuery = queries.some(q => q.corridor === "avaxHop");

    //collect all domains that are involved in any of the queries
    const involvedDomainsSet = new Set<ForeignDomain<N>>(queries.map(q => q.destinationDomain));
    if (hasAvaxHopQuery)
      involvedDomainsSet.add("Avalanche");
    const involvedDomains = [...involvedDomainsSet.values()];

    //determine the addresses of their associated oracle and cctpr price accounts
    const priceAddresses = involvedDomains
      .flatMap(d => this.priceAddresses(d))
      .map(a => a.unwrap());

    //fetch all price accounts + the oracle config (which contains the sol price) in a single call,
    //  ensure that they all exist, and base64-decode them
    const [oracleConfigRawData, ...flatPriceAccountsRawData] =
      (await this.rpc.getMultipleAccounts(
          [this.oracleConfigAddress().unwrap(), ...priceAddresses],
          { encoding: "base64" },
        ).send()
      ).value.map((account, i) => encoding.base64.decode(definedOrThrow(
        account?.data[0],
        i === 0
        ? `Failed to fetch oracle config account` as Text
        : `Failed to fetch ${["cctpr", "oracle"][(i-1)%2]} price account for domain ` +
          `${involvedDomains[Math.floor((i-1)/priceAccountsPerDomain)]}` as Text,
      )));

    //group them by domain and deserialize them
    const { solPrice } = deserialize(oracleConfigLayout, oracleConfigRawData!);
    const priceAccountsRawData = chunk(flatPriceAccountsRawData, priceAccountsPerDomain);
    const domainPriceAccounts = fromEntries(zip([involvedDomains, priceAccountsRawData])
      .map(([domain, [chainConfig, oraclePrices]]) => [
        domain,
        [ deserialize(chainConfigLayout(this.network), chainConfig!),
          deserialize(priceStateLayout(this.network)[hackPlatformOf<N>(domain)], oraclePrices!),
        ],
      ] as const));

    //calculate avax hop execution fee in advance only once if necessary
    const avaxHopExecutionFee = hasAvaxHopQuery
      ? this.calcEvmExecutionFee(
          gas(executionCosts.Evm.Gas.avaxHop),
          byte(0),
          domainPriceAccounts["Avalanche"][1] as PriceState<N, "Evm">,
        )
      : undefined;

    //finally calculate the fees for each query
    const results = queries.map((query) => {
      const { destinationDomain, corridor, gasDropoff } = query;
      const { feeAdjustments } = domainPriceAccounts[destinationDomain][0];

      const hasGasDropoff = gasDropoff.gt(genericGasToken(0));
      let gasDropoffFee: Usdc | undefined;

      //gasDropoff is calculated the same way regardless of the platform or corridor
      if (hasGasDropoff) {
        const { gasTokenPrice } = domainPriceAccounts[destinationDomain][1];
        gasDropoffFee = CctpR.applyFeeAdjustment(
          feeAdjustments["gasDropoff"],
          gasDropoff.convert(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            Conversion.from(usdc((gasTokenPrice as any).toUnit("human", "human")), GenericGasToken),
          ),
        );
      }

      //calculate the execution fee of the relay to the destination domain depending on the platform
      let unadjustedFee = (() => {
        switch (hackPlatformOf<N>(destinationDomain)) {
          case "Evm": {
            const oraclePrices = domainPriceAccounts[destinationDomain][1] as PriceState<N, "Evm">;
            const execCosts = executionCosts.Evm;

            // eslint-disable-next-line prefer-const
            let [gasCost, txBytes] = corridor === "v2Direct"
              ? [execCosts.Gas.v2, execCosts.TxBytes.v2]
              : [execCosts.Gas.v1, execCosts.TxBytes.v1];
            if (hasGasDropoff)
              gasCost += execCosts.Gas.gasDropoff;

            return this.calcEvmExecutionFee(gas(gasCost), byte(txBytes), oraclePrices);
          }
          case "Sui": {
            const oraclePrices = domainPriceAccounts[destinationDomain][1] as PriceState<N, "Sui">;
            const execCosts = executionCosts.Sui;

            let executionCUs = execCosts.ComputeUnits.delivery;
            let storageBytes = execCosts.StorageBytes.delivery;
            let rebateBytes  = execCosts.RebateBytes.delivery;
            if (hasGasDropoff) {
              executionCUs += execCosts.ComputeUnits.gasDropoff;
              storageBytes += execCosts.StorageBytes.gasDropoff;
              rebateBytes  += execCosts.RebateBytes.gasDropoff;
            }

            return this.calcSuiExecutionFee(
              computeUnit(executionCUs),
              byte(storageBytes),
              byte(rebateBytes),
              oraclePrices,
            );
          }
        }
      })();

      if (corridor === "avaxHop")
        unadjustedFee = unadjustedFee.add(avaxHopExecutionFee!);

      let usdcFee = CctpR.applyFeeAdjustment(feeAdjustments[corridor], unadjustedFee);
      if (hasGasDropoff)
        usdcFee = usdcFee.add(gasDropoffFee!);

      return usdcFee;
    });

    return [results, solPrice];
  }

  cctpMessageRentCost(corridor: Corridor): Sol {
    return minimumBalanceForRentExemption(
      corridor === "v1"
      ? v1SentEventDataSize
      : v2SentEventDataSize(corridor === "avaxHop" ? routerHookDataSize : byte(0)),
    );
  }

  private calcEvmExecutionFee(gas: Gas, bytes: Byte, oraclePrices: PriceState<N, "Evm">): Usdc {
    const { gasPrice, pricePerTxByte, gasTokenPrice } = oraclePrices;
    return CctpR.convert(
      CctpR.convert(gas, gasPrice).add(CctpR.convert(bytes, pricePerTxByte)),
      gasTokenPrice,
    );
  }

  private calcSuiExecutionFee(
    executionCUs: ComputeUnit,
    storageBytes: Byte,
    rebateBytes: Byte,
    oraclePrices: PriceState<N, "Sui">,
  ): Usdc {
    const { computeUnitPrice, bytePrice, rebateRatio, gasTokenPrice } = oraclePrices;
    const rebatedBytes = storageBytes.sub(CctpR.mulPercentage(rebateBytes, rebateRatio));
    let executionCost = CctpR.convert(executionCUs, computeUnitPrice)
      .add(CctpR.convert(rebatedBytes, bytePrice));

    if (executionCost.lt(suiMinTransactionCost))
      executionCost = suiMinTransactionCost;

    return CctpR.convert(executionCost, gasTokenPrice);
  }

  private static applyFeeAdjustment(feeAdjustment: FeeAdjustment, fee: Usdc): Usdc {
    const { absolute, relative } = feeAdjustment;
    return CctpR.mulPercentage(fee, relative).add(absolute);
  }

  private static convert<NK extends KindWithAtomic, DK extends KindWithAtomic>(
    amount: Amount<DK>,
    conversion: Conversion<NK, DK>,
  ): Amount<NK> {
    return amount.convert(conversion).floorTo("atomic");
  }

  private static mulPercentage<K extends KindWithAtomic>(
    amount: Amount<K>,
    percentage: Percentage,
  ): Amount<K> {
    return mulPercentage(amount, percentage).floorTo("atomic");
  }
}
