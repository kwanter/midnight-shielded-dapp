# Shielded Token dApp on Midnight

Bounty submission for [midnightntwrk/contributor-hub#326](https://github.com/midnightntwrk/contributor-hub/issues/326).

A shielded token contract, TypeScript API layer, and React UI for the
Midnight network. Tokens are minted by an admin keypair, held privately via
Midnight ledger commitments, and spent or burned through the wallet SDK.

## Layout

```
.
├── contract/                 Compact contract + simulator tests
│   └── src/
│       ├── shielded-token.compact   contract entrypoint + admin authority
│       ├── modules/ShieldedToken.compact   supply + balance bookkeeping
│       ├── witnesses.ts             admin private state provider
│       ├── index.ts                 barrel export
│       └── test/                    in-memory simulator tests
└── app/                      React frontend + wallet integration
```

## Status

- [x] Compact contract authored against language 0.22+ syntax
- [x] Module structure mirrors example-nft-contracts
- [x] Witness provider for admin keypair
- [x] Simulator test harness (real compact-runtime API)
- [ ] Compact compiler installed and contract compiled
- [ ] Tests passing
- [ ] React UI (mint / balance / transfer / burn flows)
- [ ] Wallet connector (Lace or 1AM via dapp-connector-api)
- [ ] Tutorial written (3,000 to 4,500 words)

## Toolchain (pending local install)

The Compact compiler is distributed by Midnight, not via npm. Install it with
the canonical installer:

```sh
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
```

Then, from `contract/`:

```sh
npm install
npm run compact      # compile src/shielded-token.compact -> src/managed/
npm run test         # in-memory simulator tests
npm run build
```

## License

Apache-2.0
