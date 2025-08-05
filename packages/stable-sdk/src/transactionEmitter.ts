import { EventEmitter } from "events";
import { Hex, TransactionReceipt } from "viem";

export class TransactionEmitter extends (EventEmitter as { new(): TransactionEventEmitter }) {
  emit<K extends keyof TransactionEvents>(event: K, payload: TransactionEvents[K]): boolean {
    const result = super.emit(event, payload);
    super.emit("*", { name: event, data: payload });
    return result;
  }
}

export interface TransactionEventEmitter extends EventEmitter {
  on<
    K extends keyof TransactionEvents,
  >(event: K, listener: (payload: TransactionEvents[K]) => void): this;

  emit<K extends keyof TransactionEvents>(event: K, payload: TransactionEvents[K]): boolean;
}

// events related directly to the blockchain transactions we manage
// in execute route.
interface TransactionEvents {
  "transaction-sent": TxSentEventData;
  "transaction-included": TxIncludedEventData;
  "*": TransactionEventData<keyof TransactionEvents>;
}

export type TxIncludedEventData = TransactionReceipt;

export type TxSentEventData = {
  transactionHash: Hex;
  parameters: {
    from: Hex;
    to: Hex;
    data: Hex;
    value: bigint;
    gas: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  };
};

export interface TransactionEventData<K extends keyof TransactionEvents> {
  name: K;
  data: TransactionEvents[K];
}
