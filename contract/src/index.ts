// SPDX-License-Identifier: Apache-2.0
// Barrel export. Consumers of this contract import { Ledger, Contract } from here.

export * from "./managed/shielded-token/contract/index.js";
export { witnesses } from "./witnesses.js";
export type {
  ShieldedTokenPrivateState
} from "./witnesses.js";
export {
  createShieldedTokenPrivateState,
  generateAdminSecretKey
} from "./witnesses.js";
