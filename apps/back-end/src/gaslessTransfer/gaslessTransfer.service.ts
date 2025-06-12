import { Injectable } from "@nestjs/common";
import { QuoteDto, QuoteRequestDto } from "./dto/index.js";

@Injectable()
export class GaslessTransferService {
  getStatus(): string {
    return "Gasless Transfer Service is running";
  }

  public quoteGaslessTransfer(request: QuoteRequestDto): Promise<QuoteDto> {
    // @todo:
    // 1. quote transfer based on input parameters
    // 2. sign the quote
    // 3. respond
    return Promise.resolve({ foo: "bar" });
  }

  public initiateGaslessTransfer(): Promise<object> {
    // 1. verify quote signature and throw if invalid
    // 2. call tx-landing-service and request the tx to be landed. set nonce+sender as the
    //    transaction tracking id.
    // 3. poll tx-landing-service for transaction confirmation
    // 4. respond.
    return Promise.resolve({});
  }
}
