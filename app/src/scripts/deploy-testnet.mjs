// SPDX-License-Identifier: Apache-2.0
//
// Testnet deploy script for the ShieldedToken contract.
//
// This script deploys the contract to Midnight Preview testnet using the
// wallet SDK (not the dApp connector browser API, since this runs in Node).
// Run it after building the contract (`npm run build -w contract`).
//
// Prerequisites (see TESTNET_DEPLOY.md):
//   1. Build the contract:  npm run build -w contract
//   2. Generate a deployer seed (or reuse one): the wallet SDK derives keys
//      from a seed phrase. Store it in DEPLOYER_SEED env var.
//   3. Fund the deployer address at the Preview faucet.
//   4. Set the network endpoints (defaults below point at Preview).
//
// Usage:
//   DEPLOYER_SEED="<your-seed>" node --experimental-vm-modules \
//     app/src/scripts/deploy-testnet.mjs
//
// Output: prints the deployed contract address + deploy tx hash. Paste the
// tx hash into the tutorial and the issue comment to strengthen the
// submission.

import {
  Wallet,
  type WalletServiceProvider,
} from "@midnight-ntwrk/wallet";
import {
  walletSdk,
} from "@midnight-ntwrk/wallet-sdk-facade";
import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import {
  httpClientProofProvider,
} from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import {
  indexerPublicDataProvider,
} from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {
  levelPrivateStateProvider,
} from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import {
  FetchZkConfigProvider,
} from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import {
  Contract as ShieldedTokenContract,
  witnesses,
  createShieldedTokenPrivateState,
} from "@midnight-ntwrk/shielded-token-contract";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

// Preview testnet endpoints. Swap for preprod/mainnet if needed.
const NETWORK_ID = "preview";
const ENDPOINTS = {
  nodeRpc: "https://rpc.preview.midnight.network",
  indexer: "https://indexer.preview.midnight.network/api/v4/graphql",
  indexerWs: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
  proofServer: "https://proof-server.preview.midnight.network/webgs",
  faucet: "https://midnight-tmnight-preview.nethermind.dev/",
};

const SEED = process.env.DEPLOYER_SEED;
if (!SEED) {
  console.error("Set DEPLOYER_SEED env var to the deployer wallet seed phrase.");
  console.error("Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  process.exit(1);
}

setNetworkId(NETWORK_ID);

async function main() {
  console.log(`Deploying ShieldedToken to Midnight ${NETWORK_ID}...`);
  console.log(`Node:    ${ENDPOINTS.nodeRpc}`);
  console.log(`Indexer: ${ENDPOINTS.indexer}`);

  // 1. Build the wallet. The wallet SDK derives keys from the seed and
  //    manages coin selection, fee payment, and signing.
  const wallet = await walletSdk({
    seed: SEED,
    networkId: NETWORK_ID,
    indexer: ENDPOINTS.indexer,
    indexerWs: ENDPOINTS.indexerWs,
    proofServer: ENDPOINTS.proofServer,
    nodeServer: ENDPOINTS.nodeRpc,
  });

  // Wait for the wallet to sync with the indexer.
  console.log("Waiting for wallet to sync...");
  await wallet.startSync();
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const deployerAddress = await wallet.getShieldedAddress();
  console.log(`Deployer shielded address: ${deployerAddress}`);
  console.log(`Fund it at: ${ENDPOINTS.faucet}`);

  // 2. Assemble the providers that deployContract needs.
  const providers = {
    wallet,
    proofProvider: httpClientProofProvider(ENDPOINTS.proofServer),
    publicProvider: indexerPublicDataProvider(ENDPOINTS.indexer, ENDPOINTS.indexerWs),
    privateStateProvider: levelPrivateStateProvider("./private-state"),
    zkConfigProvider: new FetchZkConfigProvider(ENDPOINTS.proofServer),
  };

  // 3. Generate the admin key and the initial private state.
  const adminKey = crypto.getRandomValues(new Uint8Array(32));
  const privateState = createShieldedTokenPrivateState(adminKey);

  // 4. Deploy. This builds the deploy tx, balances it with fees, proves it,
  //    and submits to the node. It blocks until the tx is confirmed.
  console.log("Submitting deploy transaction...");
  const deployed = await deployContract(providers, {
    contract: new ShieldedTokenContract(witnesses),
    privateState,
  });

  console.log("\n=== DEPLOY SUCCESSFUL ===");
  console.log(`Contract address: ${deployed.contractAddress}`);
  console.log(`Deploy tx:        ${ENDPOINTS.nodeRpc.replace("rpc.", "explorer.").replace(".network", "explorer.com")}/transaction/${deployed.deployTxHash}`);
  console.log(`\nAdmin key (hex, keep secret): ${Buffer.from(adminKey).toString("hex")}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Verify on explorer: https://preview.midnightexplorer.com/`);
  console.log(`  2. Save the contract address + admin key for minting.`);
  console.log(`  3. Paste the deploy tx hash into the tutorial.`);

  await wallet.stopSync();
  process.exit(0);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
