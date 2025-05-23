import { avaxRouterContractAddress, type SupportedDomain } from "@stable-io/cctp-sdk-cctpr-definitions";
import { domainIdOf, EvmDomains, init as initDefinitions, isEvmDomain, UniversalAddress, v1, v2 } from "@stable-io/cctp-sdk-definitions";
import { ViemEvmClient } from "@stable-io/cctp-sdk-viem";
import { TODO } from "@stable-io/utils";
import type { SDK, Network, TxHash } from "../types/index.js";
import { parseAbiItem } from "viem/utils";
import { deserialize } from "binary-layout";
import { Hex } from "viem";
import { routerHookDataLayout } from "@stable-io/cctp-sdk-cctpr-evm";
import { Redeem } from "src/types/redeem.js";

export type findRedeemDeps<N extends Network> = Pick<SDK<N>, "getNetwork" | "getRpcUrl">;

const v1MessageReceivedEvent = parseAbiItem(
  "event MessageReceived(address indexed caller,uint32 sourceDomain,uint64 indexed nonce,bytes32 sender,bytes messageBody)",
);

const v2MessageReceivedEvent = parseAbiItem(
  "event MessageReceived(address indexed caller,uint32 sourceDomain,bytes32 indexed nonce,bytes32 sender,uint32 indexed finalityThresholdExecuted,bytes messageBody)",
);

// On Avalanche the max block range is 2048 and on Optimism is 2000
const MAX_BLOCK_RANGE = 2000n;

export const $findRedeem =
  <N extends Network>({
    getNetwork,
    getRpcUrl,
  }: findRedeemDeps<N>): SDK<N>["findRedeem"] =>
  async (
    sourceDomain: keyof EvmDomains,
    transactionHash: TxHash,
    destFromBlock: bigint,
    avaxFromBlock?: bigint,
  ): Promise<Redeem> => {
    const network = getNetwork();
    const definitions = initDefinitions(network);

    let response: v2.GetMessagesResponse;
    while (true) {
      response = await v2.fetchMessagesFactory(network)(
        sourceDomain,
        { transactionHash },
      );
      if (response.status === "success" && response.messages[0].status === "complete") {
        break;
      }
      // Wait half a second before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const message = response.messages[0];
    const decodedMessage = deserialize(
      message.cctpVersion === 1 ? v1.burnMessageLayout() : v2.burnMessageLayout(),
      message.message,
    );

    if (!isEvmDomain(decodedMessage.destinationDomain)) {
      throw new Error(`Unsupported destination domain: ${decodedMessage.destinationDomain}`);
    }
    const { destinationDomain, destinationCaller } = decodedMessage;

    // TODO: Remove this eventually
    if (avaxRouterContractAddress[network] === undefined) {
      throw new Error(`Avalanche router contract address not deployed in ${network}`);
    }
    const avaxRouter = new UniversalAddress(avaxRouterContractAddress[network], "Evm");
    const isAvaxHop = destinationCaller.equals(avaxRouter) && destinationDomain === "Avalanche";
    if (isAvaxHop && avaxFromBlock === undefined) {
      throw new Error("avaxFomBlock parameter is required for AvaxHop transactions");
    }

    const rpcUrl = getRpcUrl(destinationDomain);
    const viemEvmClient = ViemEvmClient.fromNetworkAndDomain(
      network,
      destinationDomain,
      rpcUrl,
    );

    /* @todo We need to add the contracts for the other EVM chains
       Also contractAddressOf isn't working here, throws undefined when used "properly" */
    // console.log(v1.contractAddressOf("Testnet", "Arbitrum", "messageTransmitter"));
    const destContract = message.cctpVersion === 1 ?
      //eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (definitions.v1.contractAddressOf as TODO)(destinationDomain)[0][1] :
      //eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (definitions.v2.contractAddressOf as TODO)(destinationDomain)[0][1];

    let filteredLogs: { transactionHash: Hex }[] = [];
    let fromBlock = isAvaxHop ? avaxFromBlock! : destFromBlock;
    let lastBlock = await viemEvmClient.getLatestBlock();
    while (true) {
      const blockRange = lastBlock - fromBlock + 1n;
      const toBlock = blockRange > MAX_BLOCK_RANGE ? fromBlock + MAX_BLOCK_RANGE - 1n : lastBlock;
      const logs = message.cctpVersion === 1 ?
        await viemEvmClient.client.getLogs({
          address: destContract,
          event: v1MessageReceivedEvent,
          fromBlock,
          toBlock,
          args: {
            nonce: BigInt(message.eventNonce),
          },
        })
        :
        await viemEvmClient.client.getLogs({
          address: destContract,
          event: v2MessageReceivedEvent,
          fromBlock,
          toBlock,
          args: {
            nonce: message.eventNonce as Hex,
          },
        });

      filteredLogs = logs.filter(log => log.args.sourceDomain === domainIdOf(sourceDomain));
      if (filteredLogs.length > 0) {
        break;
      }
      // If we don't find any logs, we need to move to the next block range available
      fromBlock = toBlock + 1n;
      // We wait for half a second to not get throttled
      await new Promise(resolve => setTimeout(resolve, 500));
      if (blockRange <= MAX_BLOCK_RANGE) {
        // We wait 1.5 seconds more to get new blocks
        await new Promise(resolve => setTimeout(resolve, 1500));
        lastBlock = await viemEvmClient.getLatestBlock();
      }
    }

    if (filteredLogs.length !== 1) {
      throw new Error(`Expected a single log, got ${filteredLogs.length}`);
    }

    if (isAvaxHop) {
      return $findRedeem({ getNetwork, getRpcUrl })(
        "Avalanche", filteredLogs[0].transactionHash, destFromBlock,
      );
    }

    return {
      transactionHash: filteredLogs[0].transactionHash,
      destinationDomain,
    };
  };
