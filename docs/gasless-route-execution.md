```mermaid
sequenceDiagram
    participant User
    participant SDK as Stable SDK
    participant Backend as Backend API
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