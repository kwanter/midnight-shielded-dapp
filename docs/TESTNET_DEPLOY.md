# Testnet Deploy Guide

Deploy the ShieldedToken contract to Midnight Preview testnet. This
strengthens the bounty submission by showing the contract runs on a real
network, not just in the simulator.

## Prerequisites

### 1. Install a Midnight wallet (browser)

Either works. Lace is officially recommended.

- **Lace:** [lace.io](https://www.lace.io/) (browser extension, supports Midnight Preview)
- **1AM:** [1am.xyz](https://1am.xyz/)

Create a wallet, select the **Preview** network, and back up the seed phrase.

### 2. Get test NIGHT tokens

The faucet funds your wallet with test tokens for fees.

- **Preview faucet:** https://midnight-tmnight-preview.nethermind.dev/
- Enter your wallet shielded address
- Request tokens (DUST for fees, NIGHT for value)
- Wait for confirmation (usually under a minute)

You can check the balance in your wallet extension.

### 3. Endpoints (Preview testnet)

| Service | URL |
|---|---|
| Node RPC | `https://rpc.preview.midnight.network` |
| Indexer (GraphQL) | `https://indexer.preview.midnight.network/api/v4/graphql` |
| Indexer (WebSocket) | `wss://indexer.preview.midnight.network/api/v4/graphql/ws` |
| Faucet | `https://midnight-tmnight-preview.nethermind.dev/` |
| Block explorer | https://preview.midnightexplorer.com/ |

The proof server URL is published in the Midnight docs under "Environments
and endpoints". As of this writing it is hosted alongside the Preview node.
Check https://docs.midnight.network/relnotes/network for the current value.

## Deploy flow

### Option A: Browser UI (recommended for the tutorial)

The cleanest path for a tutorial is to deploy from the React app itself,
using the dApp connector API. This is the flow readers can follow.

1. Open the dApp in a browser with your wallet extension installed
2. Click "Connect Wallet", approve in the extension
3. The app reads your coin public key via `getShieldedAddresses()`
4. Click "Deploy Contract", approve the tx in the extension
5. The wallet balances the tx, generates the proof, submits to the node
6. The app displays the contract address + deploy tx hash
7. Paste the tx hash into the tutorial

To implement this, the `deployContract` call in `app/src/api/contract.ts`
swaps the simulator context for wallet-SDK providers. The `Contract` and
`witnesses` imports stay identical. See the
[deployContract API docs](https://docs.midnight.network/api-reference/midnight-js/@midnight-ntwrk/midnight-js-contracts/functions/deployContract.md).

### Option B: Node script

`app/src/scripts/deploy-testnet.mjs` is a template for a headless deploy.
It needs the wallet SDK packages added to `app/package.json`:

```bash
npm install -w app \
  @midnight-ntwrk/wallet \
  @midnight-ntwrk/wallet-sdk-facade \
  @midnight-ntwrk/midnight-js-contracts \
  @midnight-ntwrk/midnight-js-http-client-proof-provider \
  @midnight-ntwrk/midnight-js-indexer-public-data-provider \
  @midnight-ntwrk/midnight-js-level-private-state-provider \
  @midnight-ntwrk/midnight-js-node-zk-config-provider
```

Then generate a deployer seed, fund it, and run:

```bash
export DEPLOYER_SEED="<your-seed-phrase>"
node app/src/scripts/deploy-testnet.mjs
```

The script prints the contract address and a block explorer link to the
deploy transaction.

## After deploy

1. **Save the contract address and admin key.** You need both to mint.
2. **Mint tokens** by calling `mintShieldedToken` through the wallet.
3. **Verify** on https://preview.midnightexplorer.com/ that the contract
   exists and the deploy tx is confirmed.
4. **Update the tutorial** with a "Deployed on testnet" section linking the
   contract address and the first mint transaction. This is the evidence
   reviewers look for that the code actually runs on-chain.

## Troubleshooting

- **"Insufficient balance"** — the deployer wallet has no test tokens. Hit
  the faucet again.
- **Proof generation timeout** — the proof server can be slow under load.
  Retry, or run a local proof server via Docker (see the `example-counter`
  docker-compose for the pattern).
- **Version mismatch** — the wallet SDK version must match the compiled
  contract's runtime version. Pin `@midnight-ntwrk/compact-runtime` in both
  `contract/package.json` and `app/package.json` to the same version.
