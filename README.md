# Stable

## Overview

Stable is a comprehensive infrastructure for fast, secure USDC transfers across blockchain networks. Built on Circle's Cross-Chain Transfer Protocol (CCTP), it provides both low-level and high-level interfaces for developers to integrate cross-chain USDC functionality into their applications.

> **⚠️ Early Stage**: This project is in pre-MVP phase and represents an architectural outline of the planned system.

## Architecture

This is a **Yarn v4 monorepo** organized into distinct workspace categories, each serving specific architectural layers:

### 🏗️ Applications (`apps/`)
Production-ready applications deployed to cloud infrastructure:

- **`apps/front-end/`** - Next.js web application for USDC bridging
- **`apps/back-end/`** - Backend services and APIs
- *Future: Additional microservices and backend applications*

**Deployment**: Public and private cloud infrastructure

### 📋 Smart Contracts (`contracts/`)
On-chain protocol implementations:

- **`contracts/cctpr/`** - CCTPR (Cross-Chain Transfer Protocol Relayer) - An on-chain relaying protocol built on top of CCTPv1, CCTPv2, and Avalanche Bridge
- **`contracts/price-oracle/`** - Price oracle contracts for cross-chain fee calculations

### 🔧 Shared Utilities (`packages/common/`)
Foundational utilities shared across the entire ecosystem:

- **`packages/common/amount/`** - Type-safe amount handling and calculations
- **`packages/common/utils/`** - General utility functions and helpers
- **`packages/common/map-utils/`** - Map manipulation and utility functions
- **`packages/common/eslint-config/`** - Shared ESLint configuration

### 🛠️ Low-Level SDK (`packages/cctp-sdk/`)
**Modular, layered SDK** designed for optional loading to minimize bundle size:

#### Core Layers:
- **`packages/cctp-sdk/definitions/`** - Type definitions and constants for CCTP
- **`packages/cctp-sdk/evm/`** - EVM blockchain support layer
- **`packages/cctp-sdk/viem/`** - Viem client integration layer

#### Protocol Extensions:
- **`packages/cctp-sdk/cctpr-definitions/`** - CCTPR protocol definitions
- **`packages/cctp-sdk/cctpr-evm/`** - CCTPR EVM implementation

**Architecture Benefits**:
- **Tree-shakeable**: Import only needed layers
- **Blockchain-agnostic**: Add support for new chains without bloating existing implementations
- **Client-flexible**: Support multiple blockchain clients (viem, ethers, etc.)

### 🎯 Public SDK (`packages/stable-sdk/`)
**Developer-focused interface** that provides:
- High-level abstractions over the low-level CCTP SDK
- Simplified API for common use cases
- Developer ergonomics and ease of integration
- Route finding and execution
- Gasless transaction support

### 🚀 Deployment (`deployment/`)
Infrastructure and deployment configurations:

- **`deployment/evm/`** - EVM chain deployment scripts and configurations
- *Future: `deployment/solana/`* - Solana deployment configurations

## Quick Start

### Prerequisites
- **Node.js**: ^22
- **Yarn**: v4 (managed via corepack)

### Installation & Setup

```bash
# Enable Yarn (first time only)
corepack enable

# Install dependencies
yarn install --immutable

# Build all packages
yarn build
```

### Development Workflow

```bash
# Build specific workspace categories
yarn build:packages     # Build all packages
yarn build:front-end    # Build front-end app
yarn build:back-end     # Build back-end app
yarn build:cctp-sdk     # Build CCTP SDK layers
yarn build:sdk          # Build public SDK

# Development commands
yarn lint               # Lint all workspaces
yarn test               # Test all workspaces
yarn clean              # Clean all build artifacts

# Run examples
yarn workspace @stable-io/sdk tsx examples/executeRoute.ts
```

## Workspace Structure
stable/
├── apps/ # Applications
│ ├── front-end/ # Next.js web app
│ └── back-end/ # Backend services
├── contracts/ # Smart contracts
│ ├── cctpr/ # CCTPR protocol
│ └── price-oracle/ # Price oracle contracts
├── packages/
│ ├── common/ # Shared utilities
│ │ ├── amount/ # Type-safe amounts
│ │ ├── utils/ # General utilities
│ │ ├── map-utils/ # Map utilities
│ │ └── eslint-config/ # Shared linting
│ ├── cctp-sdk/ # Low-level modular SDK
│ │ ├── definitions/ # Core CCTP types
│ │ ├── evm/ # EVM support
│ │ ├── viem/ # Viem integration
│ │ ├── cctpr-definitions/ # CCTPR types
│ │ └── cctpr-evm/ # CCTPR EVM implementation
│ └── stable-sdk/ # Public high-level SDK
└── deployment/ # Infrastructure
└── evm/ # EVM deployment configs

## Package Dependencies

The monorepo follows a clear dependency hierarchy:
```
Apps (front-end, back-end)
↓
Public SDK (stable-sdk)
↓
Low-Level SDK (cctp-sdk/)
↓
Shared Utilities (common/)
```

```bash
# Publish all public packages
yarn publish-all

# Version management
yarn upgrade:sdk        # Bump stable-sdk version
yarn upgrade:cctp-sdk   # Bump cctp-sdk packages
yarn upgrade:common     # Bump common packages
```

## Contributing

1. **Package Development**: Each package has its own README with specific setup instructions
2. **Monorepo Commands**: Use workspace-specific commands for targeted development
3. **Architecture**: Follow the layered architecture - avoid circular dependencies between workspace categories

## Resources

- **📚 Documentation**: https://docs.stableit.com
- **🌐 Website**: https://stableit.com
- **📦 NPM**: [@stable-io/sdk](https://www.npmjs.com/package/@stable-io/sdk)

---

**License**: MPL-2.0 | **Author**: Stable Technologies
