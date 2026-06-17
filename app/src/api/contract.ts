// Contract management for the ShieldedToken dApp.
//
// Wires the compiled Compact contract through the compact-runtime simulator.
// In a real deploy the same Contract + witnesses surface connects through
// the wallet SDK's balanceTransaction + prove-and-submit flow (identical
// API; only the transport changes).

import {
  Contract,
  ledger,
  witnesses,
  createShieldedTokenPrivateState,
  generateAdminSecretKey,
  type ShieldedTokenPrivateState,
  type Ledger
} from "@midnight-ntwrk/shielded-token-contract";
import {
  createConstructorContext,
  createCircuitContext,
  sampleContractAddress,
  type CircuitContext
} from "@midnight-ntwrk/compact-runtime";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContractStatus = "none" | "ready" | "error";

export type DappState = {
  readonly status: ContractStatus;
  readonly address: string | null;
  readonly totalSupply: bigint;
  readonly error: string | null;
};

// ---------------------------------------------------------------------------
// Runtime handle
// ---------------------------------------------------------------------------

let contract: Contract<ShieldedTokenPrivateState> | null = null;
let ctx: CircuitContext<ShieldedTokenPrivateState> | null = null;

export function createFreshAdminKey(): Uint8Array {
  return generateAdminSecretKey();
}

export function deployContract(adminKey: Uint8Array): DappState {
  try {
    contract = new Contract<ShieldedTokenPrivateState>(witnesses);
    const privateState = createShieldedTokenPrivateState(adminKey);
    const origin = "0".repeat(64); // hex-encoded empty coin public key for deploy
    const constructorCtx = createConstructorContext(
      { adminSecretKey: adminKey } as ShieldedTokenPrivateState,
      origin
    );
    const init = contract.initialState(constructorCtx);
    ctx = createCircuitContext(
      sampleContractAddress(),
      init.currentZswapLocalState,
      init.currentContractState,
      init.currentPrivateState
    );
    return { status: "ready", address: "simulator (deploy to testnet for real address)", totalSupply: 0n, error: null };
  } catch (err) {
    return { status: "error", address: null, totalSupply: 0n, error: String(err) };
  }
}

function requireContract() {
  if (!contract || !ctx) throw new Error("Contract not deployed.");
}

export function mintTokens(
  recipientPubKeyBytes: Uint8Array,
  amount: bigint
): DappState {
  try {
    requireContract();
    const result = contract!.impureCircuits.mintShieldedToken(
      ctx!,
      { bytes: recipientPubKeyBytes },
      amount
    );
    ctx = result.context;
    return { status: "ready", address: "simulator", totalSupply: readTotalSupply(), error: null };
  } catch (err) {
    return { status: "error", address: null, totalSupply: 0n, error: String(err) };
  }
}

export function balanceOfHolder(holderPubKeyBytes: Uint8Array): bigint {
  try {
    requireContract();
    const result = contract!.impureCircuits.balanceOf(
      ctx!,
      { bytes: holderPubKeyBytes }
    );
    ctx = result.context;
    return result.result;
  } catch {
    return 0n;
  }
}

export function readTotalSupply(): bigint {
  try {
    requireContract();
    const l: Ledger = ledger(ctx!.currentQueryContext.state);
    return l.totalSupply;
  } catch {
    return 0n;
  }
}
