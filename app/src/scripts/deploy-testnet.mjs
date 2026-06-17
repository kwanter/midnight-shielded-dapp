// SPDX-License-Identifier: Apache-2.0
//
// Testnet deploy script TEMPLATE for the ShieldedToken contract.
//
// STATUS: template, not verified end-to-end. The wallet SDK API surface
// (parameter names, method names, proof server URL) must be confirmed
// against current Midnight docs before running. See docs/TESTNET_DEPLOY.md.
//
// Prerequisites:
//   1. Build the contract:  npm run build -w contract
//   2. Install wallet SDK deps (see TESTNET_DEPLOY.md)
//   3. Set DEPLOYER_SEED env var to a funded wallet seed
//   4. Verify PROOF_SERVER_URL against https://docs.midnight.network/relnotes/network
//
// Usage:
//   DEPLOYER_SEED="<seed>" PROOF_SERVER_URL="<url>" \
//     node app/src/scripts/deploy-testnet.mjs

import { webcrypto } from "node:crypto";
import { walletSdk } from "@midnight-ntwrk/wallet-sdk-facade";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import {
  Contract as ShieldedTokenContract,
  witnesses,
  createShieldedTokenPrivateState,
} from "@midnight-ntwrk/shielded-token-contract";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto;
}

const NETWORK_ID = "preview";
const EXPLORER = "https://preview.midnightexplorer.com";
const ENDPOINTS = {
  nodeRpc: "https://rpc.preview.midnight.network",
  indexer: "https://indexer.preview.midnight.network/api/v4/graphql",
  indexerWs: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
  // Proof server URL changes across environments and is not in the public
  // endpoints table. Verify at https://docs.midnight.network/relnotes/network
  // before running. Override via PROOF_SERVER_URL env var.
  proofServer: process.env.PROOF_SERVER_URL || "https://proof-server.preview.midnight.network",
  faucet: "https://midnight-tmnight-preview.nethermind.dev/",
};

const SEED = process.env.DEPLOYER_SEED;
if (!SEED) {
  console.error("Set DEPLOYER_SEED env var to the deployer wallet seed phrase.");
  console.error("Generate one with:");
  console.error('  node --input-type=module -e "import { randomBytes } from \'node:crypto\'; console.log(randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

if (!process.env.PROOF_SERVER_URL) {
  console.warn("WARNING: using default proof server URL. Verify it at");
  console.warn("  https://docs.midnight.network/relres/network");
  console.warn("Override with PROOF_SERVER_URL env var if wrong.\n");
}

setNetworkId(NETWORK_ID);

async function withTimeout(promise, ms, label) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timer]);
}

async function main() {
  console.log(`Deploying ShieldedToken to Midnight ${NETWORK_ID}...`);
  console.log(`Node:         ${ENDPOINTS.nodeRpc}`);
  console.log(`Indexer:      ${ENDPOINTS.indexer}`);
  console.log(`Proof server: ${ENDPOINTS.proofServer}\n`);

  console.log("Building wallet...");
  const wallet = await withTimeout(
    walletSdk({
      seed: SEED,
      networkId: NETWORK_ID,
      indexer: ENDPOINTS.indexer,
      indexerWs: ENDPOINTS.indexerWs,
      proofServer: ENDPOINTS.proofServer,
      nodeRpc: ENDPOINTS.nodeRpc,
    }),
    30000,
    "walletSdk init"
  );

  console.log("Waiting for wallet sync (up to 30s)...");
  try {
    await withTimeout(wallet.startSync(), 30000, "wallet sync");
  } catch (err) {
    console.warn("Sync did not complete in 30s, continuing anyway:", err.message);
  }

  // Method name may vary by SDK version. Verify against wallet-sdk-facade types.
  const addressMethod =
    typeof wallet.getShieldedAddress === "function"
      ? "getShieldedAddress"
      : typeof wallet.getShieldedAddresses === "function"
        ? "getShieldedAddresses"
        : null;
  if (!addressMethod) {
    throw new Error("Wallet has neither getShieldedAddress nor getShieldedAddresses. Check SDK version.");
  }
  const addressResult = await wallet[addressMethod]();
  const deployerAddress =
    typeof addressResult === "string" ? addressResult : addressResult.shieldedAddress;
  console.log(`Deployer shielded address: ${deployerAddress}`);
  console.log(`Fund it at: ${ENDPOINTS.faucet}\n`);

  const providers = {
    wallet,
    proofProvider: httpClientProofProvider(ENDPOINTS.proofServer),
    publicProvider: indexerPublicDataProvider(ENDPOINTS.indexer, ENDPOINTS.indexerWs),
    privateStateProvider: levelPrivateStateProvider("./private-state"),
  };

  const adminKey = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const privateState = createShieldedTokenPrivateState(adminKey);

  console.log("Submitting deploy transaction...");
  const deployed = await deployContract(providers, {
    contract: new ShieldedTokenContract(witnesses),
    privateState,
  });

  console.log("\n=== DEPLOY SUCCESSFUL ===");
  console.log(`Contract address: ${deployed.contractAddress}`);
  console.log(`Deploy tx:        ${EXPLORER}/transaction/${deployed.deployTxHash}`);
  console.log(`\nAdmin key (hex, keep secret): ${Buffer.from(adminKey).toString("hex")}`);
  console.log(`\nVerify on explorer: ${EXPLORER}`);

  try {
    await wallet.stopSync();
  } catch {
    // best-effort
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
