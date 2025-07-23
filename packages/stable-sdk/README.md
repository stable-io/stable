# @stable-io/sdk

[![NPM Version](https://img.shields.io/npm/v/@stable-io/sdk)](https://www.npmjs.com/package/@stable-io/sdk)
[![License](https://img.shields.io/github/license/stable-io/stable)](https://github.com/stable-io/stable)

The official JavaScript/TypeScript SDK for **Stableit** - enabling fast, secure cross-chain USDC transfers using Circle's Cross-Chain Transfer Protocol (CCTP).

## Installation

```bash
npm install @stable-io/sdk
# or
yarn add @stable-io/sdk
```

## Quick Start

```typescript
import StableSDK, { ViemSigner } from "@stable-io/sdk";
import { privateKeyToAccount } from "viem/accounts";

// Initialize with your wallet
const account = privateKeyToAccount("0x...");
const signer = new ViemSigner(account);

const stable = new StableSDK({
  network: "Testnet", // or "Mainnet"
  signer,
  rpcUrls: { // Optional: Use custom RPC URLs
    Ethereum: "https://your-rpc-url",
  }
});

// Find available routes
const routes = await stable.findRoutes({
  sourceChain: "Ethereum",
  targetChain: "Polygon",
  amount: "100", // 100 USDC
  sender: account.address,
  recipient: account.address,
});

// Execute the fastest route
const result = await stable.executeRoute(routes.fastest);
console.log("Transfer hash:", result.transferHash);
```

## Key Advantages

### 🔗 **Automatic Cross-Chain Relaying**
Complete transfers with just a signature from your source chain wallet - no transactions to send, no wallet switching, no destination chain interactions:

```typescript
// With gasless: Just one executeRoute call, user only signs messages
const result = await stable.executeRoute(gaslessRoute);
console.log("Transfer completed:", result.transferHash);

// Behind the scenes, the SDK automatically:
// 1. User signs permit message (no transaction sent!)
// 2. SDK submits gasless transfer to our relayers
// 3. Monitors for Circle attestation  
// 4. Relays and completes transfer on destination chain
// 5. Handles any intermediate hops (e.g., Avalanche bridge)

// ✅ What you get: Just sign a message, transfer completed
// ❌ Without relaying: Connect to source chain → Sign transfer → Pay gas → Wait → 
//     Switch to destination chain → Connect wallet → Sign receive → Pay more gas → Complete
```

### 🚀 **Gasless Transfers**
Pay transaction fees using USDC instead of native tokens - no need to hold ETH, MATIC, or other gas tokens:

```typescript
const routes = await stable.findRoutes({
  sourceChain: "Ethereum",
  targetChain: "Polygon",
  amount: "100",
  sender: account.address,
  recipient: account.address,
  paymentToken: "usdc", // Automatically includes gasless routes
});

// Gasless routes handle all gas payments with USDC
const gaslessRoute = routes.all.find(route => 
  route.steps.some(step => step.type === "gasless-transfer")
);
```

### ✍️ **Permit-Based Approvals (Default)**
Seamless user experience with signature-based approvals instead of separate approval transactions:

```typescript
// By default, the SDK uses permit signatures (no approval transactions needed)
const routes = await stable.findRoutes({
  sourceChain: "Ethereum",
  targetChain: "Polygon",
  amount: "100",
  sender: account.address,
  recipient: account.address,
  // usePermit: true is the default behavior
});

// Only disable permits for advanced distributed wallet management scenarios
const routesWithApprovals = await stable.findRoutes({
  // ... other params
  usePermit: false, // Forces traditional approval transactions
});
```

### 💎 **Gas Drop-off**
Receive native tokens on the destination chain for immediate usability:

```typescript
const routes = await stable.findRoutes({
  // ... other params
  gasDropoffDesired: "0.01", // Receive 0.01 ETH on destination
});
```

## Core Features

### 🔍 Route Discovery
Find optimal transfer routes between supported chains with cost and time estimates:

```typescript
const routes = await stable.findRoutes({
  sourceChain: "Ethereum",
  targetChain: "Polygon", 
  amount: "100.50",
  sender: "0x...",
  recipient: "0x...",
});

// Access different route options
console.log("Fastest route:", routes.fastest);
console.log("Cheapest route:", routes.cheapest);
console.log("All routes:", routes.all);
```

### ⚡ Transfer Execution
Execute transfers with real-time progress tracking:

```typescript
const route = routes.fastest;

// Check if user has sufficient funds
const hasEnoughFunds = await stable.checkHasEnoughFunds(route);

if (hasEnoughFunds) {
  // Execute the transfer
  const result = await stable.executeRoute(route);
  
  // Access transaction details
  console.log("Transactions:", result.transactions);
  console.log("Attestations:", result.attestations);
  console.log("Transfer hash:", result.transferHash);
  console.log("Receive hash:", result.receiveHash);
}
```

### 📊 Progress Monitoring
Track transfer progress with detailed events:

```typescript
// Listen to transfer progress events
route.progress.on("transfer-initiated", (data) => {
  console.log("Transfer started:", data);
});

route.progress.on("transfer-confirmed", (data) => {
  console.log("Transfer confirmed on source chain:", data);
});

route.progress.on("transfer-received", (data) => {
  console.log("Transfer completed on destination chain:", data);
});

// Handle errors with detailed information
route.progress.on("error", (errorData) => {
  console.error("Transfer failed:", errorData.type);
  
  switch (errorData.type) {
    case "transfer-failed":
      // Tokens never left the account
      console.error("Transfer transaction failed");
      break;
    case "attestation-failed":
      // Circle attestation issues
      console.error("Attestation failed for tx:", errorData.details.txHash);
      break;
    case "receive-failed":
      // Destination chain receive issues
      console.error("Receive failed for tx:", errorData.details.txHash);
      break;
  }
});
```

### 🔗 Transaction Events
Monitor individual transaction lifecycle:

```typescript
// Listen to transaction events
route.transactionListener.on("transaction-sent", (txData) => {
  console.log("Transaction sent:", txData.hash);
});

route.transactionListener.on("transaction-included", (receipt) => {
  console.log("Transaction included in block:", receipt.blockNumber);
});
```

### 💰 Balance Management
Check USDC balances across multiple chains:

```typescript
const balances = await stable.getBalance(
  "0x...", // address
  ["Ethereum", "Polygon", "Avalanche"]
);

console.log("Balances:", balances);
// Output: { Ethereum: 1000.0, Polygon: 250.5, Avalanche: 0.0 }
```

## Examples

The package includes comprehensive examples in the [`examples/`](./examples/) directory:

### Running Examples

```bash
# Setup environment variables
cp .env.example .env
# Edit .env with your private key and RPC URLs

# Run individual examples
yarn tsx examples/findRoutes.ts
yarn tsx examples/executeRoute.ts
yarn tsx examples/logTransferProgress.ts
yarn tsx examples/logTransactionEvents.ts
yarn tsx examples/parseTransferCallData.ts
yarn tsx examples/parseRouterHookData.ts
yarn tsx examples/timeTransfer.ts
```

### Available Examples

- **`findRoutes.ts`** - Discover transfer routes between chains
- **`executeRoute.ts`** - Execute a complete cross-chain transfer
- **`logTransferProgress.ts`** - Monitor transfer progress in real-time
- **`logTransactionEvents.ts`** - Track transaction lifecycle events
- **`parseTransferCallData.ts`** - Parse and analyze transfer call data
- **`parseRouterHookData.ts`** - Parse router hook data for integrations
- **`timeTransfer.ts`** - Performance benchmark script that executes multiple transfers and measures timing for each step, saving detailed results to CSV

## Configuration

### Network Support
- **Testnet**: Ethereum (Sepolia), Avalanche (Fuji), Optimism (Sepolia), Arbitrum (Sepolia), Base (Sepolia), Polygon (Amoy), Unichain (Sepolia)
- **Mainnet**: Ethereum, Avalanche, Optimism, Arbitrum, Base, Polygon, Unichain, Linea, Codex, Sonic, Worldchain

### Environment Variables
```bash
# Required for examples
EVM_PRIVATE_KEY=0x...

# Optional: Custom RPC URLs
ETHEREUM_RPC_URL=https://your-ethereum-rpc
POLYGON_RPC_URL=https://your-polygon-rpc
```

## Error Handling

Handle transfer errors using the progress event system:

```typescript
route.progress.on("error", (errorData) => {
  switch (errorData.type) {
    case "transfer-failed":
      // Transaction failed, tokens remained in source account
      console.error("Transfer transaction failed");
      // errorData.details is undefined for transfer-failed
      break;
      
    case "attestation-failed":
      // Circle's attestation service issues
      console.error("Circle attestation failed for transaction:", errorData.details.txHash);
      // Retry logic could be implemented here
      break;
      
    case "receive-failed":
      // Destination chain receive transaction failed
      console.error("Destination receive failed for transaction:", errorData.details.txHash);
      // Manual intervention may be required
      break;
  }
});

// Execute the route
await stable.executeRoute(route);
```

## TypeScript Support

The SDK is fully typed with comprehensive TypeScript definitions:

```typescript
import StableSDK, { 
  Route, 
  UserIntent, 
  EvmDomains,
  ViemSigner,
  TransferFailedEventData
} from "@stable-io/sdk";

// All types are exported for advanced usage
type SupportedChain = keyof EvmDomains;
```

## Development

### Prerequisites
- Node.js ^22
- Yarn v4

### Setup
```bash
# Install dependencies
yarn install

# Build the package
yarn build

# Run tests
yarn test

# Lint code
yarn lint
```

### Environment Setup
Create a `.env` file with your configuration:

```bash
cp .env.example .env
```

Update the `.env` file with:
- `EVM_PRIVATE_KEY`: Your wallet private key for testing
- Custom RPC URLs for different networks (optional)

## Support

- **Documentation**: https://docs.stableit.com
- **Issues**: [GitHub Issues](https://github.com/stable-io/stable/issues)
- **Discussions**: [GitHub Discussions](https://github.com/stable-io/stable/discussions)

## License

MPL-2.0 - See [LICENSE](./LICENSE) for details.
