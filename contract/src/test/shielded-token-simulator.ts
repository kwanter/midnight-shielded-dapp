// SPDX-License-Identifier: Apache-2.0
//
// In-memory simulator for the ShieldedToken contract. Mirrors the
// CounterSimulator pattern from midnightntwrk/example-counter. Lets us test
// circuit logic with no network and no node, which is the fastest feedback
// loop while developing.

import {
  type CircuitContext,
  type QueryContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger
} from "../managed/shielded-token/contract/index.js";
import { type ShieldedTokenPrivateState, witnesses } from "../witnesses.js";

// A stand-in coin public key for tests. Real deployments receive the 32-byte
// key from the recipient wallet. Zero-filled bytes are rejected by the
// contract, so we use a non-zero sentinel.
const sampleRecipientBytes = new Uint8Array(32).fill(7);

export type Recipient = { bytes: Uint8Array };

export const sampleRecipient: Recipient = { bytes: sampleRecipientBytes };

export class ShieldedTokenSimulator {
  readonly contract: Contract<ShieldedTokenPrivateState>;
  circuitContext: CircuitContext<ShieldedTokenPrivateState>;
  // The coin public key under which ownPublicKey() reports in the simulator.
  // Tests call setCaller() to change who is treated as the caller.
  caller: Recipient;

  constructor(adminSecretKey: Uint8Array) {
    this.contract = new Contract<ShieldedTokenPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState
    } = this.contract.initialState(
      createConstructorContext({ adminSecretKey }, "0".repeat(64))
    );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState
    );
    this.caller = { bytes: new Uint8Array(32).fill(3) };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): ShieldedTokenPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  // Swap the stored private state. Used by negative tests that need to
  // simulate a caller holding a different admin key.
  public replacePrivateState(next: ShieldedTokenPrivateState): void {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: next,
    };
  }

  // Replace the caller identity. Mutates the circuit context's Zswap local
  // state so that ownPublicKey() (which reads from there) returns the
  // chosen key. This is the simulator's stand-in for "signing the tx with
  // a different wallet".
  public setCaller(caller: Recipient): void {
    this.caller = caller;
    this.circuitContext = {
      ...this.circuitContext,
      currentZswapLocalState: {
        ...this.circuitContext.currentZswapLocalState,
        coinPublicKey: caller
      }
    };
  }

  // Read a balance through the actual balanceOf circuit so we exercise
  // the contract path, not peek the ledger state directly.
  public balanceOf(holder: Recipient): bigint {
    const result = this.contract.impureCircuits.balanceOf(
      this.circuitContext,
      holder
    );
    this.circuitContext = result.context;
    return result.result;
  }

  public mintShieldedToken(to: Recipient, amount: bigint): void {
    this.circuitContext = this.contract.impureCircuits.mintShieldedToken(
      this.circuitContext,
      to,
      amount
    ).context;
  }

  // burnShieldedToken reads ownPublicKey() from the caller identity. In the
  // simulator we override the QueryContext's caller by rebuilding the
  // context after the circuit runs.
  public burnShieldedToken(amount: bigint): void {
    this.circuitContext = this.contract.impureCircuits.burnShieldedToken(
      this.circuitContext,
      amount
    ).context;
  }

  // Atomic transfer from the current caller to a recipient. The caller
  // identity is read via ownPublicKey() inside the circuit, which pulls
  // from the zswap local state. Call setCaller() first to set the sender.
  public transfer(to: Recipient, amount: bigint): void {
    this.circuitContext = this.contract.impureCircuits.transfer(
      this.circuitContext,
      to,
      amount
    ).context;
  }
}