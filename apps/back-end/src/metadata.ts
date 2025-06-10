/* eslint-disable */
export default async () => {
    const t = {
        ["./gaslessTransfer/dto/quote.dto"]: await import("./gaslessTransfer/dto/quote.dto"),
        ["./gaslessTransfer/dto/quoteResponse.dto"]: await import("./gaslessTransfer/dto/quoteResponse.dto"),
        ["./gaslessTransfer/dto/relayResponse.dto"]: await import("./gaslessTransfer/dto/relayResponse.dto")
    };
    return { "@nestjs/swagger": { "models": [[import("./gaslessTransfer/dto/quote.dto"), { "QuoteDto": { foo: { required: true, type: () => String } } }], [import("./gaslessTransfer/dto/quoteResponse.dto"), { "QuoteResponseDto": { data: { required: true, type: () => t["./gaslessTransfer/dto/quote.dto"].QuoteDto } } }], [import("./gaslessTransfer/dto/relayResponse.dto"), { "RelayResponseDto": { data: { required: true, type: () => Object } } }]], "controllers": [[import("./metrics/metrics.controller"), { "MetricsController": { "getMetrics": { type: String } } }], [import("./gaslessTransfer/gaslessTransfer.controller"), { "GaslessTransferController": { "getStatus": { type: String }, "quoteGaslessTransfer": { type: t["./gaslessTransfer/dto/quoteResponse.dto"].QuoteResponseDto }, "initiateGaslessTransfer": { type: t["./gaslessTransfer/dto/relayResponse.dto"].RelayResponseDto } } }]] } };
};