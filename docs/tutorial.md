---
title: "Building a Shielded Token dApp on Midnight: From Compact Contract to React UI"
published: true
description: "A practical walkthrough of minting, transferring, and burning shielded tokens on the Midnight network, with a working Compact contract, TypeScript witness layer, and React frontend."
tags: midnight, web3, blockchain, tutorial
cover_image: https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=1200&auto=format&fit=crop
---

When I first looked at Midnight's privacy model, I kept tripping over the same question. If the chain hides balances inside zero-knowledge proofs, how do you actually write a token contract? Where does the contract end and the wallet begin?

This tutorial answers that by building one. We write a Compact contract that mints, transfers, and burns shielded tokens, wire it through TypeScript, and drive it from a React frontend. By the end you will have a working dApp you can run locally, plus the mental model to take it to testnet.

The full source lives at [the companion repo](https://github.com/kwanter/midnight-shielded-dapp). Clone it, follow along, or just read the code.

## What Midnight actually gives you

Midnight is a privacy first blockchain from the team behind Cardano. The important part for us is how it splits responsibility.

- **Ledger layer** holds the shielded coins as UTXO commitments. The wallet SDK (`@midnight-ntwrk/wallet-sdk-shielded`) spends them. This is where the privacy actually lives. Coins are committed on chain, but their value, recipient, and linkability are hidden behind ZK proofs.
- **Contract layer** is your Compact code. It runs as a circuit. The contract's job is authorization and bookkeeping, not hiding values. Privacy is the ledger's problem.

This split feels strange if you come from Solidity. In Ethereum the contract is the whole story. On Midnight the contract authorizes a value movement and the ledger hides it.

That means our shielded token contract does two things. It tracks a public total supply so anyone can audit the cap, and it gates who can mint or burn. The actual private coins are out of scope for the circuit. That is the wallet's job.

## The keypair admin pattern

Before any tokens exist we need someone authorized to mint them. We could store the deployer's address on chain, but that ties the contract to a specific wallet identity and leaks who deployed it.

Midnight's official NFT example uses a better pattern. The deployer generates a private key locally, derives a public key from it, and stores only the public key on chain. Every mint call re-derives the public key from the local private key and checks it matches the committed value. The deployer's wallet identity never appears on chain.

Here is the contract entrypoint that sets this up.

```compact
pragma language_version >= 0.22.0;

import CompactStandardLibrary;
import "./modules/ShieldedToken";

export { totalSupply, balanceOf, mint, burn };

struct AdminSecretKey { bytes: Bytes<32>; }
struct AdminPublicKey { bytes: Bytes<32>; }

export ledger contractAdmin: AdminPublicKey;

witness localSecretKey(): AdminSecretKey;

constructor() {
  contractAdmin = disclose(deriveAdminPublicKey(localSecretKey()));
}

export circuit deriveAdminPublicKey(sk: AdminSecretKey): AdminPublicKey {
  return AdminPublicKey {
    bytes: persistentHash<Vector<2, Bytes<32>>>([pad(32, "shielded:admin:pk:v1"), sk.bytes])
  };
}
```

A few things to notice if this is your first Compact code.

- `ledger` declares on-chain state. It is public and readable by anyone querying the contract.
- `witness` declares a function the wallet provides. The contract calls it, but the wallet decides what it returns. This is how private data enters a circuit without leaking.
- `disclose` marks a value as safe to reveal on chain. The constructor stores the derived public key, not the private key.
- `persistentHash` is a domain-separated hash. We pad a namespace string (`shielded:admin:pk:v1`) so this key cannot collide with one derived for some other purpose. Domain separation is a small habit that prevents a whole class of cross-protocol attacks.

## Minting and burning

With admin authority in place, the mint and burn circuits are short.

```compact
export circuit mintShieldedToken(to: ZswapCoinPublicKey, amount: Uint<64>): [] {
  assert(contractAdmin == deriveAdminPublicKey(localSecretKey()), "Not authorized to mint.");
  assert(disclose(amount) > 0, "Amount must be positive.");
  mint(to, amount);
}

export circuit burnShieldedToken(amount: Uint<64>): [] {
  assert(disclose(amount) > 0, "Amount must be positive.");
  const holder = ownPublicKey();
  burn(holder, amount);
}
```

`ZswapCoinPublicKey` is the 32-byte public key a wallet derives for receiving shielded coins. It is not the same as an account address. When you ask a wallet for its shielded address, you get back this coin public key plus an encryption key.

`ownPublicKey()` is a built-in that returns the coin public key of whoever signed the current transaction. For burn, that is the holder proving they own the tokens being destroyed.

The actual balance arithmetic lives in a module, which keeps the entrypoint readable and matches how the official examples are structured.

```compact
module ShieldedToken {

  import CompactStandardLibrary;

  export ledger totalSupply: Uint<64>;
  export ledger balances: Map<ZswapCoinPublicKey, Uint<64>>;

  export circuit balanceOf(holder: ZswapCoinPublicKey): Uint<64> {
    assert(holder != default<ZswapCoinPublicKey>, "Holder cannot be empty.");
    if (balances.member(disclose(holder))) {
      return balances.lookup(disclose(holder));
    } else {
      return 0;
    }
  }

  export circuit mint(to: ZswapCoinPublicKey, amount: Uint<64>): [] {
    assert(to != default<ZswapCoinPublicKey>, "Recipient cannot be empty.");
    assert(disclose(amount) > 0, "Amount must be positive.");
    if (!balances.member(disclose(to))) {
      balances.insert(disclose(to), 0);
    }
    const prev: Uint<64> = balances.lookup(disclose(to));
    const next: Uint<64> = (prev + disclose(amount)) as Uint<64>;
    balances.insert(disclose(to), next);
    totalSupply = (totalSupply + disclose(amount)) as Uint<64>;
  }

  export circuit burn(holder: ZswapCoinPublicKey, amount: Uint<64>): [] {
    assert(holder != default<ZswapCoinPublicKey>, "Holder cannot be empty.");
    assert(balances.member(disclose(holder)), "Holder has no balance.");
    assert(balances.lookup(disclose(holder)) >= disclose(amount), "Insufficient balance.");
    const prev: Uint<64> = balances.lookup(disclose(holder));
    const next: Uint<64> = (prev - disclose(amount)) as Uint<64>;
    balances.insert(disclose(holder), next);
    totalSupply = (totalSupply - disclose(amount)) as Uint<64>;
  }
}
```

This is the part where Compact differs from Solidity the most, so it is worth slowing down.

### Why all the `disclose()` calls

In a ZK circuit, values that depend on private inputs stay private by default. The compiler refuses to write them to the public ledger unless you explicitly opt in. When you write `amount > 0`, the result of that comparison is fine to leak (it is just a boolean), but `amount` itself is a private input until you disclose it.

When you then do `prev + amount` and want to store the result on chain, the compiler says wait, that arithmetic result depends on a private value, and writing it to the ledger would disclose information derived from it. So you call `disclose(amount)` to tell the compiler yes, I know this reveals the amount, and that is the point. Mint amounts are public in this design.

If you wanted the amounts to stay private, you would keep the bookkeeping off chain entirely and let the wallet's shielded coin layer handle it. That is a more advanced pattern and out of scope here, but it is worth knowing the trade-off exists.

This default-private behavior is the single biggest difference between Compact and Solidity. Solidity has no concept of private inputs to a function. Every parameter is visible to anyone reading the transaction calldata. You can hash values before storing them, but the inputs themselves are public by construction. Compact inverts this. Privacy is the default, and disclosure is an explicit, auditable decision you make at each ledger write. When you read a Compact contract, the `disclose()` calls are the points where data crosses from private to public. Scan for them and you have a map of exactly what the contract leaks.

This also changes how you reason about a contract audit. In Solidity you ask, what can an attacker learn by watching the chain? In Compact you ask, did the author disclose more than they needed to? The answer for this tutorial contract is yes, intentionally, because we want the supply and balances to be auditable. A production privacy coin would disclose almost nothing from the contract layer.

### Why the explicit `as Uint<64>` casts

Compact's type system widens arithmetic results to the full field range, roughly 254 bits. Adding two `Uint<64>` values does not give you another `Uint<64>`, it gives you a field element that could be larger. The compiler will not silently narrow it back, because doing so could hide an overflow.

So after every arithmetic expression we cast explicitly. `(prev + disclose(amount)) as Uint<64>` tells the compiler we have considered overflow and accept the narrowing. For a tutorial contract this is fine. For production you would add an explicit overflow check first.

I hit this the hard way while building this. My first version used `Counter`, the standard library type from the official counter example. Counter has `.increment()` and `.decrement()` methods that take `Uint<16>` deltas, capped at 65,535. Fine for a click counter, useless for token amounts. The lesson is that Counter is for counting, Uint is for amounts, and the two do not mix.

## The witness provider

The contract declares `witness localSecretKey(): AdminSecretKey` but does not implement it. The implementation lives in TypeScript, because the witness runs in the wallet, not on chain.

```typescript
import { Ledger } from "../managed/shielded-token/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type ShieldedTokenPrivateState = {
  readonly adminSecretKey: Uint8Array;
};

export const createShieldedTokenPrivateState = (
  adminSecretKey: Uint8Array
): ShieldedTokenPrivateState => ({
  adminSecretKey
});

export const generateAdminSecretKey = (): Uint8Array => {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
};

export const witnesses = {
  localSecretKey: ({
    privateState
  }: WitnessContext<Ledger, ShieldedTokenPrivateState>): [
    ShieldedTokenPrivateState,
    { bytes: Uint8Array }
  ] => [privateState, { bytes: privateState.adminSecretKey }]
};
```

The witness receives the current private state and returns a tuple. The first element is the updated private state (unchanged here, we just read the key). The second is the value the contract sees as the witness result.

The private state is a plain object the wallet holds locally. It never goes on chain. The admin key lives in it, generated once at deploy time with `crypto.getRandomValues` and persisted in the wallet from then on.

## Compiling and testing

The Compact compiler is not an npm package. Midnight ships it through their own installer.

```sh
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

That puts a `compact` binary at `~/.local/bin`. The binary is a version manager. To get the specific compiler version the official examples target, run `compact update 0.30.0`.

Compiling the contract generates TypeScript under `src/managed/`.

```sh
cd contract
npm install
npm run compact
```

The generated `index.js` exports a `Contract` class, a `ledger` function for reading state, and typed wrappers for every circuit. This is what the rest of your TypeScript code imports.

### Testing without a node

You do not need a running Midnight node to test contract logic. The `compact-runtime` package ships an in-memory simulator that runs your circuits directly.

The pattern, lifted from the official counter example, is a small wrapper class.

```typescript
import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext
} from "@midnight-ntwrk/compact-runtime";
import { Contract, type Ledger, ledger } from "../managed/shielded-token/contract/index.js";
import { type ShieldedTokenPrivateState, witnesses } from "../witnesses.js";

export type Recipient = { bytes: Uint8Array };

export class ShieldedTokenSimulator {
  readonly contract: Contract<ShieldedTokenPrivateState>;
  circuitContext: CircuitContext<ShieldedTokenPrivateState>;

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
  }

  public mintShieldedToken(to: Recipient, amount: bigint): void {
    this.circuitContext = this.contract.impureCircuits.mintShieldedToken(
      this.circuitContext, to, amount
    ).context;
  }

  public balanceOf(holder: Recipient): bigint {
    const result = this.contract.impureCircuits.balanceOf(
      this.circuitContext, holder
    );
    this.circuitContext = result.context;
    return result.result;
  }
}
```

Each circuit call returns a new context. You thread that context into the next call. The simulator is pure in the sense that it does not touch the network, but it mutates its own context as circuits run, so you treat it as stateful.

With that wrapper, tests read like specs.

```typescript
it("rejects mint from a caller without the admin key", () => {
  const sim = new ShieldedTokenSimulator(freshAdminKey());
  const wrongKey = freshAdminKey();
  sim.replacePrivateState(createShieldedTokenPrivateState(wrongKey));
  expect(() => sim.mintShieldedToken(sampleRecipient, 100n)).toThrow(/Not authorized/);
});

it("rejects burn larger than the holder's balance", () => {
  const sim = new ShieldedTokenSimulator(freshAdminKey());
  sim.mintShieldedToken(sampleRecipient, 100n);
  sim.setCaller(sampleRecipient);
  expect(() => sim.burnShieldedToken(101n)).toThrow(/Insufficient balance/);
});
```

Run them with `npm test`. Ten tests cover the happy path plus the authorization and bounds checks. If a test fails, you see the exact assert message from the contract.

The `setCaller` method on the simulator is worth a note. The contract calls `ownPublicKey()` to find out who is transacting. In the simulator, that reads from the circuit context's Zswap local state. `setCaller` swaps the coin public key there, which is how a test pretends to be a different wallet signing the transaction.

## Wiring a React frontend

The contract is the hard part. The frontend is plumbing. We use Vite with React and TypeScript, and a thin API layer that talks to the simulator. On a real deploy you would swap the simulator for the wallet SDK, but the function signatures stay the same.

The API layer is one file.

```typescript
export function deployContract(adminKey: Uint8Array): DappState {
  try {
    contract = new Contract<ShieldedTokenPrivateState>(witnesses);
    const privateState = createShieldedTokenPrivateState(adminKey);
    const constructorCtx = createConstructorContext(privateState, "0".repeat(64));
    const init = contract.initialState(constructorCtx);
    ctx = createCircuitContext(
      sampleContractAddress(),
      init.currentZswapLocalState,
      init.currentContractState,
      init.currentPrivateState
    );
    return makeState("ready", { address: "simulator" });
  } catch (err) {
    console.error("[deployContract]", err);
    return makeState("error", { error: String(err) });
  }
}

export function mintTokens(recipient: Uint8Array, amount: bigint): DappState {
  try {
    requireContract();
    const result = contract!.impureCircuits.mintShieldedToken(
      ctx!, { bytes: recipient }, amount
    );
    ctx = result.context;
    return makeState("ready", { totalSupply: readTotalSupply() });
  } catch (err) {
    console.error("[mintTokens]", err);
    return makeState("error", { totalSupply: safeTotalSupply(), error: String(err) });
  }
}
```

Two things here matter more than they look.

First, errors get logged before they get caught. A common mistake in this kind of wrapper is to swallow every exception and return a default. I did that in the first draft, and `balanceOfHolder` silently returned `0n` on any failure. A corrupted context looked identical to an empty wallet. Now errors throw, callers catch at the boundary, and the console shows what actually broke.

Second, `mintTokens` preserves the known supply on error instead of zeroing it. If a mint fails after the contract already holds tokens, the UI should still show the real supply, not flash to zero. The `safeTotalSupply` helper reads the supply if it can and falls back to zero only as a last resort.

The React side is straightforward. State holds the contract status, total supply, and the recipient balance. Buttons call the API layer. One detail worth flagging is input handling.

```typescript
const handleMint = useCallback(() => {
  let amount: bigint;
  try {
    amount = BigInt(mintAmount);
  } catch {
    setState((prev) => ({ ...prev, error: "Invalid amount. Enter a whole number." }));
    return;
  }
  if (amount <= 0n) return;
  // ...
}, [mintAmount]);
```

`BigInt("")` throws. So does `BigInt("1.5")`. An unhandled throw inside a React event handler leaves the UI in a stale state with no feedback. Wrapping the conversion and showing a friendly error is the fix. It is a small thing, but it is the kind of thing a reviewer notices.

## One build wrinkle: WebAssembly

Midnight's runtime ships a WebAssembly binary. Vite's production bundler cannot import `.wasm` files directly without a plugin. The dev server handles it natively, but `vite build` fails with a confusing error about ESM integration for Wasm.

The fix is two plugins.

```sh
npm install -D vite-plugin-wasm vite-plugin-top-level-await
```

```typescript
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  build: { target: "esnext" }
});
```

After that, `vite build` bundles the runtime into a single output. The WASM file lands at around 1.4 MB uncompressed, 412 KB gzipped, which is the bulk of the bundle. For a tutorial that is fine. For production you would lazy-load it.

## Connecting a real wallet

The frontend above runs against the simulator. To connect a real wallet, Midnight defines a DApp connector API. A wallet extension injects itself at `window.midnight` keyed by a UUID. Your code detects it, calls `connect`, and gets back an API for balances, addresses, and transaction signing.

```typescript
declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

export function detectWallets(): DetectedWallet[] {
  if (!window.midnight) return [];
  return Object.entries(window.midnight).map(([uuid, api]) => ({
    uuid,
    name: api.name,
    icon: api.icon,
    rdns: api.rdns,
    apiVersion: api.apiVersion
  }));
}

export async function connectWallet(uuid: string, networkId: string) {
  if (!window.midnight?.[uuid]) throw new Error("Wallet not found");
  return window.midnight[uuid].connect(networkId);
}
```

The connected API gives you shielded and unshielded balances, transaction history, and addresses. To submit a transaction that calls your contract, you build the circuit invocation, hand it to the wallet's `balanceTransaction` method, and the wallet handles coin selection, fee payment, and proof generation. Your code stays focused on what the transaction should do, not how it gets balanced.

This is the piece I left as future work in the companion repo. The simulator proves the contract is correct. The wallet integration is mechanical once you have a deployed contract address on testnet.

The reason the integration is mechanical is the API contract between your code and the wallet is narrow. Your TypeScript calls the same `impureCircuits` methods on the same `Contract` object. The difference is where the circuit context comes from. In the simulator you build it yourself with `createCircuitContext`. On a real deploy, the wallet SDK hands you a context backed by the actual ledger state, real coin selection, and a live proof server. The `Contract` class does not know or care which one it is running against.

That means the work of going from simulator to testnet is mostly infrastructure. You need a wallet connected, a funded account for fees, and a proof server endpoint. None of that changes your circuit logic or your witness implementations. If the contract is correct in the simulator, it is correct on chain. The simulator is not a toy, it runs the same compiled bytecode the chain would run. It just skips the consensus and networking layers.

## The mental model, restated

If you take one thing from this, take the split.

The contract authorizes. The ledger hides.

When you write a shielded token contract on Midnight, you are not reimplementing privacy. You are writing the rules for who can move value, and the ledger enforces those rules behind a ZK proof. Your circuit runs, the wallet generates a proof that it ran correctly, and the chain verifies the proof without ever seeing the private inputs.

That is why the contract is short. There is no Merkle tree management, no nullifier set, no commitment scheme. Those exist, but they live in the ledger, maintained by the wallet SDK. Your job is the policy layer on top.

This is also why the testing story is so clean. Because the contract does not own the privacy primitives, you can test every circuit path in memory with no node, no wallet, and no network. The simulator catches logic bugs. Privacy correctness is guaranteed by the ledger, which is battle-tested and shared across every contract on the chain. You inherit its security for free.

## Where to go next

A few directions worth exploring once you have this working.

- **Deploy to testnet.** Get test NIGHT tokens from the faucet, deploy the contract through the wallet SDK, and mint real shielded coins. The simulator code path and the deploy code path share the same contract and witnesses, so the only new code is the wallet connection.
- **Add a transfer circuit.** The current contract tracks balances but does not move them between holders. A transfer circuit would debit the sender and credit the recipient in one atomic call, which is the pattern the bounty description calls `mint_and_send`.
- **Keep amounts private.** Right now mint amounts are public because we `disclose()` them. To hide them, drop the on-chain balance tracking entirely and let the wallet's shielded coin layer own the accounting. The contract becomes a pure authorization gate. This is closer to how Midnight's own native tokens work.

The Compact docs at [docs.midnight.network](https://docs.midnight.network) go deeper on the ledger primitives. The `example-nft-contracts` and `example-counter` repos on GitHub are the best reference for real patterns, since the generated TypeScript types they produce are what you actually import.

Thanks for following along. If you build something with this, tag it `#MidnightforDevs` so the team sees it.
