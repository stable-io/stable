/* eslint-disable */
export default async () => {
    const t = {
        ["./gaslessTransfer/gaslessTransfer.controller"]: await import("./gaslessTransfer/gaslessTransfer.controller")
    };
    return { "@nestjs/swagger": { "models": [], "controllers": [[import("./metrics/metrics.controller"), { "MetricsController": { "getMetrics": { type: String } } }], [import("./gaslessTransfer/gaslessTransfer.controller"), { "GaslessTransferController": { "getStatus": { type: String }, "quoteGaslessTransfer": { type: t["./gaslessTransfer/gaslessTransfer.controller"].QuoteResponseData }, "initiateGaslessTransfer": { type: t["./gaslessTransfer/gaslessTransfer.controller"].RelayResponseData } } }]] } };
};