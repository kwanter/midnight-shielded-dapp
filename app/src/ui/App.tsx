import { useState, useCallback } from "react";
import type { DappState } from "../api/contract";
import {
  deployContract,
  createFreshAdminKey,
  mintTokens,
  balanceOfHolder,
  readTotalSupply
} from "../api/contract";

// Stand-in coin public key for the test recipient. A real deployment
// reads this from the user's wallet via getShieldedAddresses().
const DEMO_RECIPIENT = new Uint8Array(32).fill(7);

export default function App() {
  const [state, setState] = useState<DappState>({
    status: "none",
    address: null,
    totalSupply: 0n,
    error: null,
  });
  const [adminKey, setAdminKey] = useState<Uint8Array | null>(null);
  const [mintAmount, setMintAmount] = useState("100");
  const [recipientBalance, setRecipientBalance] = useState<bigint>(0n);

  const handleDeploy = useCallback(() => {
    const key = createFreshAdminKey();
    setAdminKey(key);
    const s = deployContract(key);
    setState(s);
    if (s.status === "ready") {
      setRecipientBalance(balanceOfHolder(DEMO_RECIPIENT));
    }
  }, []);

  const handleMint = useCallback(() => {
    const amount = BigInt(mintAmount);
    if (amount <= 0n) return;
    const s = mintTokens(DEMO_RECIPIENT, amount);
    setState(s);
    setRecipientBalance(balanceOfHolder(DEMO_RECIPIENT));
  }, [mintAmount]);

  return (
    <div style={styles.container}>
      <Header />
      <div style={styles.panel}>
        <ConnectionPanel state={state} adminKey={adminKey} />
        <MintPanel
          state={state}
          mintAmount={mintAmount}
          setMintAmount={setMintAmount}
          onDeploy={handleDeploy}
          onMint={handleMint}
          totalSupply={readTotalSupply()}
          recipientBalance={recipientBalance}
        />
        <BalancePanel totalSupply={readTotalSupply()} recipientBalance={recipientBalance} />
      </div>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header style={styles.header}>
      <h1 style={styles.title}>Shielded Token dApp</h1>
      <p style={styles.subtitle}>Midnight Network — Bounty #326</p>
    </header>
  );
}

function ConnectionPanel({ state, adminKey }: { state: DappState; adminKey: Uint8Array | null }) {
  const statusLabel = {
    none: "Not deployed",
    deploying: "Deploying...",
    ready: "Ready",
    error: "Error"
  }[state.status];
  const statusColor = {
    none: "#999",
    deploying: "#f0ad4e",
    ready: "#5cb85c",
    error: "#d9534f"
  }[state.status];

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Contract</h2>
      <div style={styles.row}>
        <span>Status:</span>
        <span style={{ color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
      </div>
      {state.address && (
        <div style={styles.row}>
          <span>Address:</span>
          <code style={styles.code}>{state.address}</code>
        </div>
      )}
      {adminKey && (
        <div style={styles.row}>
          <span>Admin key:</span>
          <code style={styles.code}>{hexEncode(adminKey.slice(0, 8))}...</code>
        </div>
      )}
      {state.error && (
        <div style={styles.errorRow}>{state.error}</div>
      )}
    </div>
  );
}

function MintPanel({
  state,
  mintAmount,
  setMintAmount,
  onDeploy,
  onMint
}: {
  state: DappState;
  mintAmount: string;
  setMintAmount: (v: string) => void;
  onDeploy: () => void;
  onMint: () => void;
  totalSupply: bigint;
  recipientBalance: bigint;
}) {
  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Actions</h2>
      <button
        onClick={onDeploy}
        disabled={state.status === "ready"}
        style={{
          ...styles.button,
          backgroundColor: state.status === "ready" ? "#333" : "#5cb85c"
        }}
      >
        Deploy Contract
      </button>

      {state.status === "ready" && (
        <>
          <div style={{ ...styles.row, marginTop: 16 }}>
            <span>Recipient:</span>
            <code style={styles.code}>{hexEncode(DEMO_RECIPIENT)}</code>
          </div>
          <div style={{ ...styles.row, marginTop: 8 }}>
            <span>Amount:</span>
            <input
              type="number"
              min="1"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              style={styles.input}
            />
          </div>
          <button onClick={onMint} style={{ ...styles.button, backgroundColor: "#337ab7" }}>
            Mint Tokens
          </button>
        </>
      )}
    </div>
  );
}

function BalancePanel({ totalSupply, recipientBalance }: { totalSupply: bigint; recipientBalance: bigint }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Balances</h2>
      <div style={styles.row}>
        <span>Total Supply:</span>
        <span style={{ fontWeight: 600 }}>{String(totalSupply)}</span>
      </div>
      <div style={styles.row}>
        <span>Recipient Balance:</span>
        <span style={{ fontWeight: 600 }}>{String(recipientBalance)}</span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer style={styles.footer}>
      <p>Built on Midnight Network — Compact contract, TypeScript API, React frontend</p>
      <p>
        <a href="https://github.com/midnightntwrk/contributor-hub/issues/326" target="_blank" rel="noreferrer" style={{ color: "#5ea" }}>
          View bounty #326 on GitHub
        </a>
      </p>
    </footer>
  );
}

function hexEncode(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Inline styles (no CSS build step; keeps the tutorial bundle minimal)
// ---------------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "24px 16px",
    minHeight: "100vh"
  },
  header: {
    textAlign: "center",
    padding: "32px 0 24px"
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "#fff"
  },
  subtitle: {
    fontSize: 14,
    color: "#7a8a9e",
    marginTop: 4
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: 16
  },
  card: {
    background: "#151a22",
    borderRadius: 10,
    padding: 20,
    border: "1px solid #2a3040"
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
    color: "#a0b5cc"
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    fontSize: 14,
    color: "#c8d6e5"
  },
  code: {
    fontFamily: "SF Mono, Fira Code, monospace",
    fontSize: 12,
    color: "#8be9fd",
    background: "#0f1419",
    padding: "2px 6px",
    borderRadius: 4,
    maxWidth: 320,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const
  },
  errorRow: {
    color: "#d9534f",
    fontSize: 13,
    marginTop: 8,
    padding: 8,
    background: "rgba(217,83,79,0.1)",
    borderRadius: 4
  },
  button: {
    display: "block",
    width: "100%",
    marginTop: 12,
    padding: "10px 0",
    border: "none",
    borderRadius: 6,
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer"
  },
  input: {
    width: "120px",
    padding: "6px 8px",
    borderRadius: 4,
    border: "1px solid #2a3040",
    background: "#0f1419",
    color: "#e2e5ea",
    fontSize: 14,
    textAlign: "right" as const
  },
  footer: {
    textAlign: "center",
    marginTop: 40,
    paddingTop: 16,
    borderTop: "1px solid #1e2530",
    color: "#5a6a7e",
    fontSize: 12,
    lineHeight: 1.8
  }
};
