import { Injectable } from "@nestjs/common";
import { EvmAddress, selectorOf } from "@stable-io/cctp-sdk-evm";
import { encoding, TODO } from "@stable-io/utils";
import { Flatten, HeadTail, RoArray, RoTuple } from "@stable-io/map-utils";
import {
  calcStaticSize,
  DeriveType,
  deserialize,
  Item,
  Layout,
  ProperLayout,
  serialize,
} from "binary-layout";
import {
  amountItem,
  Domain,
  domainOfWormholeChainId,
  DomainsOf,
  EvmGasToken,
  Network,
  Platform,
  PlatformOf,
  Usdc,
  wormholeChainIdOf,
} from "@stable-io/cctp-sdk-definitions";
import { PublicClient } from "viem";
import { Rational } from "@stable-io/amount";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { ConfigService } from "../config/config.service";

const avalancheOracleAddress: Record<Network, string> = {
  Mainnet: "0x418a0F8a9b4B4bbEC77b920983B96927406998D9",
  Testnet: "0x6b0d88ef2855756E4BB0b595B004E0773D583471",
};

const priceQueryLayout = {
  binary: "switch",
  idSize: 1,
  idTag: "query",
  layouts: [
    [
      [0x90, "FeeParams"],
      [
        {
          name: "chain",
          custom: {
            to: (val: number): { domain: Domain; network?: Network } => {
              let domain = domainOfWormholeChainId("Testnet", val as TODO);
              if (domain === undefined) {
                domain = domainOfWormholeChainId("Mainnet", val as TODO);
                if (domain === undefined)
                  throw new Error(`Invalid wormhole chain id: ${val}`);
                return { domain };
              }
              return { domain };
            },
            from: (val: { domain: Domain; network?: Network }): number => {
              if (val.network === undefined)
                throw new Error("Network is required");
              return wormholeChainIdOf(val.network, val.domain as TODO);
            },
          },
          binary: "uint",
          size: 2,
        },
      ],
    ],
  ],
} as const satisfies Layout;
type PriceQuery = DeriveType<typeof priceQueryLayout>;

const subArrayLayout = <const N extends string, const L extends Layout>(
  name: N,
  layout: L,
) => [{ name, binary: "array", lengthSize: 1, layout: layout }] as const;

const rootQueryLayout = {
  binary: "switch",
  idSize: 1,
  idTag: "query",
  layouts: [[[0x80, "Price"], subArrayLayout("queries", priceQueryLayout)]],
} as const;
type RootQuery = DeriveType<typeof rootQueryLayout>;

const versionEnvelopeLayout = <const N extends string, const L extends Layout>(
  name: N,
  layout: L,
) =>
  ({
    name: "versionEnvelope",
    binary: "switch",
    idSize: 1,
    idTag: "version",
    layouts: [[0, [{ name, binary: "array", layout }]]],
  }) as const;

const queryParamsLayout = versionEnvelopeLayout("queries", rootQueryLayout);

type ArgsResult<A, R> = {
  [K in keyof A | "result"]: K extends "result" ? R : A[Exclude<K, "result">];
};

type FeeParamQuery<C extends Domain> = {
  query: "FeeParams";
  chain: { domain: C; network: Network };
};

const mweiToGwei = {
  to: (val: number): Rational => Rational.from(BigInt(val), 1000n),
  from: (val: Rational): number => val.mul(1000n).toNumber(),
};

const gasTokenPriceItem = amountItem(6, Usdc, "µUSDC");
const pricePerTxByteItem = amountItem(
  4,
  EvmGasToken,
  "nEvmGasToken",
  mweiToGwei,
);
const gasPriceItem = amountItem(4, EvmGasToken, "nEvmGasToken", mweiToGwei);
const pricePerAccountByteItem = {
  binary: "uint",
  size: 4,
} as const satisfies Item;
const solanaComputationPriceItem = {
  binary: "uint",
  size: 4,
} as const satisfies Item;
const signaturePriceItem = {
  binary: "uint",
  size: 4,
} as const satisfies Item;
const suiComputationPriceItem = solanaComputationPriceItem;
const storagePriceItem = {
  binary: "uint",
  size: 4,
} as const satisfies Item;
const storageRebateItem = {
  binary: "uint",
  size: 1,
} as const satisfies Item;

const slotSize = 32;
const fullSlotLayout = <const L extends ProperLayout>(layout: L) =>
  [
    {
      name: "reserved",
      binary: "bytes",
      custom: new Uint8Array(slotSize - calcStaticSize(layout)!),
      omit: true,
    },
    ...layout,
  ] as const satisfies Layout;

const evmFeeParamsLayout = fullSlotLayout([
  { name: "pricePerTxByte", ...pricePerTxByteItem },
  { name: "gasPrice", ...gasPriceItem },
  { name: "gasTokenPrice", ...gasTokenPriceItem },
]);
type EvmFeeParams = DeriveType<typeof evmFeeParamsLayout>;

const gasTokenPriceNamedItem = evmFeeParamsLayout[3];

const solanaFeeParamsLayout = fullSlotLayout([
  { name: "signaturePrice", ...signaturePriceItem },
  { name: "pricePerAccountByte", ...pricePerAccountByteItem },
  { name: "computationPrice", ...solanaComputationPriceItem },
  gasTokenPriceNamedItem,
]);
type SolanaFeeParams = DeriveType<typeof solanaFeeParamsLayout>;

const suiFeeParamsLayout = fullSlotLayout([
  { name: "storageRebate", ...storageRebateItem },
  { name: "storagePrice", ...storagePriceItem },
  { name: "computationPrice", ...suiComputationPriceItem },
  gasTokenPriceNamedItem,
]);
type SuiFeeParams = DeriveType<typeof suiFeeParamsLayout>;

type PlatformToFeeParams<P> = P extends "Solana"
  ? SolanaFeeParams
  : P extends "Sui"
    ? SuiFeeParams
    : EvmFeeParams;

type DistributeFeeParamsArgsResult<
  C extends Domain,
  AssociatedP extends Platform,
> = AssociatedP extends infer P extends AssociatedP
  ? ArgsResult<FeeParamQuery<C>, PlatformToFeeParams<P>>
  : never;

type PriceQueryToResult<Q extends PriceQuery> =
  Q extends FeeParamQuery<infer C>
    ? DistributeFeeParamsArgsResult<C, PlatformOf<C>>
    : never;

type PriceQueryTupleResults<QA extends RoTuple<PriceQuery>> =
  QA extends HeadTail<QA, infer Head, infer Tail>
    ? [PriceQueryToResult<Head>, ...PriceQueryTupleResults<Tail>]
    : [];

type PriceQueryResults<QA extends RoArray<PriceQuery>> =
  QA extends RoTuple<PriceQuery>
    ? PriceQueryTupleResults<QA>
    : QA extends RoArray<infer Q extends PriceQuery>
      ? PriceQueryToResult<Q>[]
      : never;

type RootQueryResults<C extends RootQuery> = C extends { query: "Price" }
  ? PriceQueryResults<C["queries"]>
  : never;

type QueryTupleResultsImpl<CA extends RoTuple<RootQuery>> =
  CA extends HeadTail<CA, infer Head, infer Tail>
    ? RootQueryResults<Head> extends infer V
      ? V extends RoTuple
        ? [...V, ...QueryTupleResults<Tail>]
        : V extends RoArray
          ? void
          : [V, ...QueryTupleResults<Tail>]
      : never
    : [];

type QueryTupleResults<CA extends RoTuple<RootQuery>> =
  QueryTupleResultsImpl<CA> extends infer R
    ? R extends RoTuple
      ? R
      : R extends void
        ? QueryArrayResults<CA>
        : never
    : never;

type QueryArrayResults<CA extends RoArray<RootQuery>> =
  CA extends RoArray<infer Q extends RootQuery>
    ? Flatten<RootQueryResults<Q>[]>
    : never;

type QueryResults<CA extends RoArray<RootQuery>> =
  CA extends RoTuple<RootQuery> ? QueryTupleResults<CA> : QueryArrayResults<CA>;

@Injectable()
export class OracleService {
  constructor(private readonly configService: ConfigService) {}

  public getStatus(): string {
    return "Oracle service is running";
  }

  public async getPrices(
    domains: DomainsOf<"Evm">[],
  ): Promise<{ gasTokenPrice: Usdc; gasPrice: EvmGasToken }[]> {
    const network = this.configService.network;

    // TODO: RPC Urls? Create clients at startup?
    const client = ViemEvmClient.fromNetworkAndDomain(
      network,
      "Avalanche",
    ).client;
    const oracle = new EvmAddress(avalancheOracleAddress[network]);
    const queries = [
      {
        query: "Price",
        queries: domains.map((domain) => ({
          query: "FeeParams",
          chain: { domain, network },
        })),
      },
    ] satisfies RoArray<RootQuery>;
    const results = await this.query(client, oracle, queries);
    return results.map((result) => ({
      gasTokenPrice: result.result.gasTokenPrice,
      gasPrice: result.result.gasPrice,
    }));
  }

  private async query<const Q extends RoArray<RootQuery>>(
    client: PublicClient,
    oracle: EvmAddress,
    queries: Q,
  ): Promise<QueryResults<Q>> {
    if (queries.length === 0) return [] as QueryResults<Q>;

    const data = encoding.hex.encode(
      encoding.bytes.concat(
        selectorOf("get1959()"),
        serialize(queryParamsLayout, { version: 0, queries }),
      ),
      true,
    );

    const result = await client.call({ to: oracle.toString(), data });
    const resultData = result.data ?? "0x0";
    const encodedResults = encoding.hex.decode(resultData);

    if (encodedResults.length === 0)
      throw new Error(
        "Empty result returned by the provider. Please check your config params.",
      );

    const decodedResults: any[] = [];
    const solidityBytesEncodingLayout = [
      //ptr must always point to the next "slot", i.e. 0x20
      { name: "ptr", binary: "uint", size: 32, custom: 32n, omit: true },
      //if the response claims to be longer than 2^32 bytes, something is wrong
      { name: "mustBeZero", binary: "uint", size: 28, custom: 0n, omit: true },
      //the actual length of the response
      { name: "length", binary: "uint", size: 4 },
    ] as const;

    let offset = 0;
    const [header, offsetHeader] = deserialize(
      solidityBytesEncodingLayout,
      encodedResults.subarray(offset),
      false,
    );
    offset += offsetHeader;

    const deserializeResult = (query: any, layout: any) => {
      const [result, newOffset] = deserialize(
        layout,
        encodedResults.subarray(offset),
        false,
      );
      decodedResults.push({ ...query, result });
      offset += newOffset;

      if (offset > encodedResults.length)
        throw new Error("Query response too short");
    };

    for (const rootQuery of queries)
      for (const query of rootQuery.queries)
        deserializeResult(
          query,
          query.chain.domain === "Solana"
            ? solanaFeeParamsLayout
            : query.chain.domain === "Sui"
              ? suiFeeParamsLayout
              : evmFeeParamsLayout,
        );

    if (offset < header.length) throw new Error("Query response too long");

    return decodedResults as QueryResults<Q>;
  }
}
