// Copyright (c) 2025 Stable Technologies Inc
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Chain as ViemChain, Account as ViemAccount, parseAbiItem, decodeFunctionData } from "viem";

import { Permit, ContractTx } from "@stable-io/cctp-sdk-evm";
import { ViemEvmClient, viemChainOf } from "@stable-io/cctp-sdk-viem";
import type { Network, EvmDomains } from "@stable-io/cctp-sdk-definitions";
import { evmGasToken } from "@stable-io/cctp-sdk-definitions";
import { encoding } from "@stable-io/utils";
import { parseTransferTxCalldata } from "@stable-io/cctp-sdk-cctpr-evm";
import { isContractTx, Route, getStepType, isEip2612Data, ViemWalletClient, TxHash, Hex } from "../../types/index.js";
import { ApprovalSentEventData, TransferSentEventData, parsePermitEventData } from "../../progressEmitter.js";
import { TxSentEventData } from "../../transactionEmitter.js";

const fromGwei = (gwei: number) => evmGasToken(gwei, "nEvmGasToken").toUnit("atomic");

export async function executeRouteSteps<N extends Network, D extends keyof EvmDomains>(
  network: N, route: Route, signer: ViemWalletClient, client: ViemEvmClient<N, D>,
): Promise<TxHash[]> {
  const txHashes = [] as string[];
  let permit: Permit | undefined = undefined;
  while (true) {
    const { value: txOrSig, done } = await route.workflow.next(permit);
    permit = undefined;

    const stepType = getStepType(txOrSig);

    if (stepType !== "sign-permit" && isContractTx(txOrSig)) {
      const txParameters = buildEvmTxParameters(txOrSig, signer.chain!, signer.account!);
      const tx = await signer.sendTransaction(txParameters);

      route.transactionListener.emit("transaction-sent", parseTxSentEventData(tx, txParameters));

      const receipt = await client.client.waitForTransactionReceipt({ hash: tx });
      txHashes.push(tx);

      route.transactionListener.emit("transaction-included", receipt);

      if (receipt.status === "reverted") throw new Error("Execution Reverted");

      const { eventName, eventData } = buildTransactionEventData(network, stepType, txOrSig, tx);
      route.progress.emit(eventName, eventData);
    } else if (stepType === "sign-permit" && isEip2612Data(txOrSig)) {
      const signature = await signer.signTypedData({
        account: signer.account!,
        ...txOrSig,
      });

      permit = {
        signature: encoding.hex.decode(signature),
        // It's possible to override the following values by changing them
        // before signing the message.
        // We need to pass them back to the cctp-sdk so that it can know
        // what changes we made.
        // We don't modify them rn, so we give it back what it gave us.
        value: txOrSig.message.value,
        deadline: txOrSig.message.deadline,
      };

      route.progress.emit("permit-signed", parsePermitEventData(permit));
    }

    if (done) break;
  }

  return txHashes;
}

export type EvmTxParameters = {
  from: Hex;
  value: bigint | undefined;
  chain: ViemChain;
  account: ViemAccount;
  to: Hex;
  data: Hex;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

function buildEvmTxParameters(tx: ContractTx, chain: ViemChain, account: ViemAccount) {
  const callData = `0x${Buffer.from(tx.data).toString("hex")}` as const;
  const txValue = tx.value
    ? BigInt(tx.value.toUnit("atomic").toString())
    : undefined;
  return {
    from: tx.from?.unwrap() as Hex,
    value: txValue,
    chain: chain,
    account: account,
    to: tx.to.unwrap(),
    data: callData,
    /**
     * @todo: Proper gas calculation will be necessary at some point...
     *        we could consider using the gasEstimation field of the corresponding step.
     */
    gas: fromGwei(0.001),
    maxFeePerGas: fromGwei(40),
    maxPriorityFeePerGas: fromGwei(20),
  };
}

function buildTransactionEventData(
  network: Network,
  stepType: "pre-approve" | "transfer",
  contractTx: ContractTx,
  txHash: Hex,
): {
  eventName: "approval-sent";
  eventData: ApprovalSentEventData;
} | {
  eventName: "transfer-sent";
  eventData: TransferSentEventData;
} {
  return stepType === "pre-approve"
? {
      eventName: "approval-sent",
      eventData: parseApprovalTransactionEventData(contractTx, txHash),
    }
: {
      eventName: "transfer-sent",
      eventData: parseTransferTransactionEventData(network, contractTx, txHash),
    };
}

const approveAbi = parseAbiItem("function approve(address, uint256) view returns (bool)");

function parseApprovalTransactionEventData(
  contractTx: ContractTx, txHash: Hex,
): ApprovalSentEventData {
  const callData = `0x${Buffer.from(contractTx.data).toString("hex")}` as const;
  const approvalAmount = decodeFunctionData({
    abi: [approveAbi],
    data: callData,
  }).args[1];

  return {
    transactionHash: txHash,
    approvalAmount,
  };
}

function parseTransferTransactionEventData(
  network: Network, contractTx: ContractTx, txHash: Hex,
): TransferSentEventData {
  const transferData = parseTransferTxCalldata(network)(contractTx.data);
  // there's plenty other params on the call data we could extract if we wished to.
  return {
    transactionHash: txHash,
    approvalType: transferData.approvalType,
    gasDropOff: BigInt(transferData.gasDropoff.toUnit("aGasToken").toString()),
    usdcAmount: transferData.inputAmountUsdc.toUnit("human").toNumber(),
    recipient: `0x${encoding.hex.encode(transferData.mintRecipient.unwrap())}`,
    quoted: transferData.quoteVariant.type,
  };
}

export function parseTxSentEventData(tx: Hex, parameters: EvmTxParameters): TxSentEventData {
  return {
    transactionHash: tx,
    parameters: {
      from: parameters.from,
      to: parameters.to,
      data: parameters.data,
      value: parameters.value ?? BigInt(0),
      gas: parameters.gas,
      maxFeePerGas: parameters.maxFeePerGas,
      maxPriorityFeePerGas: parameters.maxPriorityFeePerGas,
    },
  };
};
