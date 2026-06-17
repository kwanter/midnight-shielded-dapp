// SPDX-License-Identifier: Apache-2.0
//
// Simulator tests for the ShieldedToken contract. Runs fully in-memory, no
// network and no node. Proves the circuit logic before any deploy.

import { ShieldedTokenSimulator, sampleRecipient } from "./shielded-token-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";

setNetworkId("undeployed");

function freshAdminKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

describe("ShieldedToken contract", () => {
  it("deploys with zero supply", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    expect(sim.getLedger().totalSupply).toEqual(0n);
  });

  it("mints tokens, bumping supply and the recipient balance", () => {
    const sim = new ShieldedTokenSimulator(freshAdminKey());
    sim.mintShieldedToken(sampleRecipient, 1000n);
    const balance = sim.balanceOf(sampleRecipient);
    expect(sim.getLedger().totalSupply).toEqual(1000n);
    expect(balance).toEqual(1000n);
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
});
