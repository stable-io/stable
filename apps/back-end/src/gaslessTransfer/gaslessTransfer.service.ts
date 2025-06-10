import { Injectable } from "@nestjs/common";
import { QuoteDto } from "./dto/index.js";

@Injectable()
export class GaslessTransferService {
  getStatus(): string {
    return "Gasless Transfer Service is running";
  }

  public quoteGaslessTransfer(): Promise<QuoteDto> {
    // 1. check if permit2 contract is already permitted to spend the user allowance.
    //    Create a permit message for the user to sign otherwise.
    // 2. quote transfer based on input parameters
    // 3. sign the quote
    // 4. respond
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
