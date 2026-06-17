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
    const constructorCtx = createConstructorContext(privateState, origin);
    const init = contract.initialState(constructorCtx);
    ctx = createCircuitContext(
      sampleContractAddress(),
      init.currentZswapLocalState,
      init.currentContractState,
      init.currentPrivateState
    );
    return makeState("ready", {
      address: "simulator (deploy to testnet for real address)",
      totalSupply: 0n,
    });
  } catch (err) {
    console.error("[deployContract]", err);
    return makeState("error", { error: String(err) });
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
    return makeState("ready", { address: "simulator", totalSupply: readTotalSupply() });
  } catch (err) {
    console.error("[mintTokens]", err);
    return makeState("error", {
      address: "simulator",
      totalSupply: safeTotalSupply(),
      error: String(err),
    });
  }
}

// Atomic transfer from the caller to a recipient. The caller identity is
// read via ownPublicKey() inside the circuit, so we do not pass a sender.
// The recipient gets credited; supply is unchanged.
export function transferTokens(
  recipientPubKeyBytes: Uint8Array,
  amount: bigint
): DappState {
  try {
    requireContract();
    const result = contract!.impureCircuits.transfer(
      ctx!,
      { bytes: recipientPubKeyBytes },
      amount
    );
    ctx = result.context;
    return makeState("ready", { address: "simulator", totalSupply: readTotalSupply() });
  } catch (err) {
    console.error("[transferTokens]", err);
    return makeState("error", {
      address: "simulator",
      totalSupply: safeTotalSupply(),
      error: String(err),
    });
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
  } catch (err) {
    console.error("[balanceOfHolder]", err);
    throw err;
  }
}

export function readTotalSupply(): bigint {
  try {
    requireContract();
    const l: Ledger = ledger(ctx!.currentQueryContext.state);
    return l.totalSupply;
  } catch (err) {
    console.error("[readTotalSupply]", err);
    throw err;
  }
}

// Like readTotalSupply but returns 0n instead of throwing. Used in error
// states where the UI needs a number, not a crash.
function safeTotalSupply(): bigint {
  try {
    return readTotalSupply();
  } catch {
    return 0n;
  }
}

// Single source of truth for building DappState objects.
function makeState(
  status: ContractStatus,
  overrides: Partial<Omit<DappState, "status">> = {}
): DappState {
  return {
    status,
    address: null,
    totalSupply: 0n,
    error: null,
    ...overrides,
  };
}
