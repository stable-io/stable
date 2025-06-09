/* eslint-disable */
export default async () => {
    const t = {
        ["./gasless-transfer/gasless-transfer.controller"]: await import("./gasless-transfer/gasless-transfer.controller")
    };
    return { "@nestjs/swagger": { "models": [], "controllers": [[import("./metrics/metrics.controller"), { "MetricsController": { "getMetrics": { type: String } } }], [import("./gasless-transfer/gasless-transfer.controller"), { "GaslessTransferController": { "getStatus": { type: String }, "quoteGaslessTransfer": { type: t["./gasless-transfer/gasless-transfer.controller"].QuoteResponseData }, "initiateGaslessTransfer": { type: t["./gasless-transfer/gasless-transfer.controller"].RelayResponseData }, "checkPermit2Allowed": { type: t["./gasless-transfer/gasless-transfer.controller"].Permit2AllowedResponseData } } }]] } };
};