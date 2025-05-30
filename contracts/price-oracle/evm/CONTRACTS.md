# Price Oracle

### Contract Inheritance diagram

`ProxyBase` and `RawDispatcher` from [Wormhole's Solidity SDK](https://github.com/wormhole-foundation/wormhole-solidity-sdk).

```
                              ┌─> RawDispatcher
PriceOracle ─> PO-Dispatcher ─┴─> PO-Prices ─> PO-Governance ─> ProxyBase
```
