# Gassless Relaying:
### What is it?
Feature added to CCTPR contract to allow the user to use all transfer features, paying only in usdc (no gas token).
### How does it work?
We use a permit2 typed message signed by the user to grant CCTPR spending power over the user tokens.
An offchain estimates the cost of relaying and triggers a relay for that exact quote.
CCTPR performs the transfer and re-imburses the relayer, adding a configurable fee.

> Permit2 is public infrastructure by uniswap and the user needs to sign a permit for it.

### Components:
- **CCTPR Contract:** Underlying on-chain infrastructure to support gasless.
- **SDK:** Provides the interface to the client.
- **Gasless API:** quotes and authorizes the relay.
- **Tx Landing Service:** Gets the transaction included.


### High Level Operations flow:
1. Check user's allowance on permit2 and determine if a permit is needed
2. Get a quote from the gasless-api. The quote is estimated, signed, and returned to the user.
3. User signs required permits (might be one or two depending on step 1) and requests them to be relayed
4. Gasless-api verifies the signature of the transfers parameters
5. If a permit is required, permit and transfer are batched using multicall3
6. Transaction is sent to transaction-landing-service for inclusion
5. Transaction hash is returned to the user, tracking is triggered as any route

### Flow Of Operations - Diagram:

```mermaid
sequenceDiagram
    participant User
    participant SDK as Stable SDK
    participant Backend as Gasless API
    participant TxLanding as Tx Landing Service
    participant Blockchain

    Note over User, Blockchain: Gasless Route Execution Flow

    %% Route Finding Phase
    User->>SDK: findRoutes(intent)
    Note over SDK: buildGaslessRoute()
    
    %% Check Permit2 Allowance
    SDK->>Blockchain: Check permit2 allowance
    Blockchain-->>SDK: Allowance status
    
    %% Get Quote from Backend
    SDK->>Backend: GET /gasless-transfer/quote
    Note over Backend: quoteGaslessTransfer()
    Backend->>Backend: Calculate quoted amount<br/>(amount + corridor costs + permit costs)
    Backend->>Backend: Generate permit2 typed data
    Backend->>Backend: Create JWT payload<br/>(permit2TypedData, quoteRequest, gaslessFee)
    Backend->>Backend: Sign JWT
    Backend-->>SDK: Quote response with JWT
    
    %% Build Route
    SDK->>SDK: Create route with workflow<br/>transferWithGaslessRelay()
    SDK-->>User: Routes including gasless route

    %% Route Execution Phase
    User->>SDK: executeRoute(gaslessRoute)
    Note over SDK: executeRouteSteps()
    
    %% Execute Workflow Steps
    SDK->>SDK: Start workflow generator
    
    alt Permit2 requires allowance
        SDK->>SDK: Yield permit message (EIP-2612)
        SDK->>User: Request permit signature
        User-->>SDK: Signed permit
        SDK->>SDK: Store permit for next step
    end
    
    SDK->>SDK: Yield permit2 typed data
    SDK->>User: Request permit2 signature
    User-->>SDK: Signed permit2 message
    
    %% Send to Backend
    SDK->>Backend: POST /gasless-transfer/relay<br/>(JWT, permit2Signature, permitSignature)
    Note over Backend: initiateGaslessTransfer()
    
    %% Backend Processing
    Backend->>Backend: Validate JWT payload
    Backend->>Backend: Extract parameters<br/>(quoteRequest, permit2TypedData, gaslessFee)
    
    alt Permit required
        Backend->>Backend: Validate permit signature present
        Backend->>Backend: Compose permit + transer into multicall3 calldata
    end
    
    Backend->>Backend: Build gasless transfer transaction<br/>via CctpRService
    
    %% Transaction Landing
    Backend->>TxLanding: sendTransaction()<br/>(cctprAddress, targetDomain, txDetails)
    TxLanding->>TxLanding: Sign transaction with relayer keys
    TxLanding->>Blockchain: Submit transaction
    Blockchain-->>TxLanding: Transaction hash
    TxLanding-->>Backend: Transaction hash
    Backend-->>SDK: Transaction hash
    
    %% Monitoring Phase
    SDK->>SDK: Start monitoring for attestation
    SDK->>Blockchain: Poll for Circle attestation
    Blockchain-->>SDK: Attestation found
    SDK->>SDK: Emit "transfer-confirmed" event
    
    SDK->>Blockchain: Poll for redeem transaction
    Blockchain-->>SDK: Redeem transaction found
    SDK->>SDK: Emit "transfer-redeemed" event
    
    SDK-->>User: Execution complete<br/>(transactions, attestations, redeems)
```