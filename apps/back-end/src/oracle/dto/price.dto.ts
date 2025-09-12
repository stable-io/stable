import {
  EvmPriceResult,
  SolanaPriceResult,
  SuiPriceResult,
} from "../oracle.service";

export type PriceDto = (EvmPriceResult | SolanaPriceResult | SuiPriceResult)[];
