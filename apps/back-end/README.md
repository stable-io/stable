# Stable Back End

## Development

### Environment Setup

Create a `.env` file:

```sh
cp .env.example .env
```

### RPC Configuration

Configure custom RPC endpoints for blockchain networks:

1. **Copy the example configuration:**

   ```sh
   cp config/rpc-urls.example.json config/rpc-urls.json
   ```

2. \*\*Edit `config/rpc-urls.json` with your preferred RPC providers.

3. **Configuration Notes:**
   - Set values to `null` to use Viem's default RPC endpoints
   - Invalid URLs will cause fallback to defaults with warnings
   - Missing config file will use all defaults with a warning
   - Changes require application restart

### Installation and Running

Install dependencies:

```sh
yarn install
```

Run the development server by default on [http://localhost:3001]():

```sh
yarn start:dev
```

Swagger UI is available at [http://localhost:3001/api](), and in JSON format at [http://localhost:3001/api-json]().
