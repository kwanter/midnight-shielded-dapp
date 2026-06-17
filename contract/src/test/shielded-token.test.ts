// SPDX-License-Identifier: Apache-2.0
// Simulator tests for the ShieldedToken contract.

import { ShieldedTokenSimulator, sampleRecipient } from "./shielded-token-simulator.js";
import {
  createShieldedTokenPrivateState,
  generateAdminSecretKey
} from "../witnesses.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";

setNetworkId("undeployed");

function freshAdminKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

const otherHolder = { bytes: new Uint8Array(32).fill(11) };

describe("ShieldedToken contract", () => {
  it("deploys with zero supply", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    expect(sim.getLedger().totalSupply).toEqual(0n);
  });

  it("mints tokens, bumping supply and the recipient balance", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.mintShieldedToken(sampleRecipient, 1000n);
    expect(sim.getLedger().totalSupply).toEqual(1000n);
    expect(sim.balanceOf(sampleRecipient)).toEqual(1000n);
  });

  it("accumulates mints across calls", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.mintShieldedToken(sampleRecipient, 300n);
    sim.mintShieldedToken(sampleRecipient, 250n);
    expect(sim.getLedger().totalSupply).toEqual(550n);
    expect(sim.balanceOf(sampleRecipient)).toEqual(550n);
  });

  it("burns tokens and reduces supply and balance", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.mintShieldedToken(sampleRecipient, 1000n);
    sim.setCaller(sampleRecipient);
    sim.burnShieldedToken(400n);
    expect(sim.getLedger().totalSupply).toEqual(600n);
    expect(sim.balanceOf(sampleRecipient)).toEqual(600n);
  });

  // --- Negative / authorization tests (added by code review) ---

  it("rejects mint from a caller without the admin key", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    // Swap the private state so the witness returns a different key.
    // deriveAdminPublicKey(localSecretKey()) now mismatches the ledger-stored
    // contractAdmin, and the assert fires.
    const wrongKey = freshAdminKey();
    sim.replacePrivateState(createShieldedTokenPrivateState(wrongKey));
    expect(() => sim.mintShieldedToken(sampleRecipient, 100n)).toThrow(
      /Not authorized/
    );
  });

  it("rejects zero-amount mint", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    expect(() => sim.mintShieldedToken(sampleRecipient, 0n)).toThrow(
      /positive/
    );
  });

  it("rejects mint to the zero coin public key", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    const zeroHolder = { bytes: new Uint8Array(32) };
    expect(() => sim.mintShieldedToken(zeroHolder, 50n)).toThrow(
      /Recipient cannot be empty/
    );
  });

  it("rejects burn from a holder with no recorded balance", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.setCaller(otherHolder);
    expect(() => sim.burnShieldedToken(1n)).toThrow(/Holder has no balance/);
  });

  it("rejects burn larger than the holder's balance", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.mintShieldedToken(sampleRecipient, 100n);
    sim.setCaller(sampleRecipient);
    expect(() => sim.burnShieldedToken(101n)).toThrow(/Insufficient balance/);
  });

  it("isolates per-holder balances in the public ledger", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.mintShieldedToken(sampleRecipient, 500n);
    sim.mintShieldedToken(otherHolder, 250n);
    expect(sim.balanceOf(sampleRecipient)).toEqual(500n);
    expect(sim.balanceOf(otherHolder)).toEqual(250n);
    expect(sim.getLedger().totalSupply).toEqual(750n);
  });

  // --- Atomic transfer (mint_and_send pattern) tests ---

  it("transfers tokens between holders atomically, supply unchanged", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.mintShieldedToken(sampleRecipient, 1000n);
    // Pretend the recipient is the caller, sending to otherHolder.
    sim.setCaller(sampleRecipient);
    sim.transfer(otherHolder, 300n);
    expect(sim.balanceOf(sampleRecipient)).toEqual(700n);
    expect(sim.balanceOf(otherHolder)).toEqual(300n);
    expect(sim.getLedger().totalSupply).toEqual(1000n);
  });

  it("creates a balance entry for a first-time recipient on transfer", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.mintShieldedToken(sampleRecipient, 100n);
    sim.setCaller(sampleRecipient);
    sim.transfer(otherHolder, 40n);
    expect(sim.balanceOf(otherHolder)).toEqual(40n);
  });

  it("rejects transfer of more than the sender owns", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.mintShieldedToken(sampleRecipient, 100n);
    sim.setCaller(sampleRecipient);
    expect(() => sim.transfer(otherHolder, 101n)).toThrow(/Insufficient balance/);
  });

  it("rejects transfer from a sender with no balance", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.setCaller(otherHolder);
    expect(() => sim.transfer(sampleRecipient, 10n)).toThrow(/Sender has no balance/);
  });

  it("rejects transfer to yourself", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.mintShieldedToken(sampleRecipient, 100n);
    sim.setCaller(sampleRecipient);
    expect(() => sim.transfer(sampleRecipient, 10n)).toThrow(/yourself/);
  });
});
