// Type definitions extracted from the Midnight DApp Connector API
// specification (SPECIFICATION.md). We declare only the subset we use.

export type NetworkId = string; // e.g. "mainnet" | "testnet"

// The object a wallet injects at window.midnight[id]
export type InitialAPI = {
  readonly rdns: string;
  readonly name: string;
  readonly icon: string;
  readonly apiVersion: string;
  connect(networkId: NetworkId): Promise<ConnectedAPI>;
};

export type TokenType = string;

export type HistoryEntry = {
  readonly txHash: string;
  readonly blockNumber: number;
  readonly timestamp: number;
  readonly status: "pending" | "confirmed" | "failed";
  readonly effects: unknown;
};

export type ConnectedAPI = {
  readonly apiVersion: string;
  getShieldedBalances(): Promise<Record<TokenType, bigint>>;
  getUnshieldedBalances(): Promise<Record<TokenType, bigint>>;
  getDustBalance(): Promise<bigint>;
  getTxHistory(pageNumber: number, pageSize: number): Promise<HistoryEntry[]>;
  getShieldedAddresses(): Promise<{ shieldedAddress: string; shieldedCoinPublicKey: string; shieldedEncryptionPublicKey: string }>;
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>;
  getDustAddress(): Promise<{ dustAddress: string }>;
};

// Augment the global Window so TypeScript knows about window.midnight
declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }
}

// A parsed wallet entry the UI displays before connection.
export type DetectedWallet = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
  apiVersion: string;
};

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

export async function connectWallet(
  uuid: string,
  networkId: NetworkId
): Promise<ConnectedAPI> {
  if (!window.midnight || !window.midnight[uuid]) {
    throw new Error("Wallet not found. Is the wallet extension installed?");
  }
  return window.midnight[uuid].connect(networkId);
}
