# Aegis Protocol

**The OP_NET Trust Layer** — Token vesting infrastructure for Bitcoin L1.

Aegis Protocol brings institutional-grade token vesting to Bitcoin through OP_NET smart contracts. Lock any OP_20 token with enforceable LINEAR or CLIFF vesting schedules, while a 1% protocol fee automatically routes to the Aegis Vault treasury.

**Live Demo:** [aegis-protocol-green.vercel.app](https://aegis-protocol-green.vercel.app)

---

## What It Does

Aegis Protocol solves the trust problem in Bitcoin-native token launches. Instead of relying on promises, teams can lock tokens on-chain with provable, time-locked vesting — directly on Bitcoin L1 via OP_NET.

**For Token Creators:**
- Lock OP_20 tokens with LINEAR (continuous streaming) or CLIFF (all-at-once) vesting
- Set custom durations from 3 to 24+ months
- Transparent 1% fee funds protocol development

**For Token Holders:**
- View all vesting schedules in a searchable explorer
- Track real-time vesting progress with visual indicators
- Claim unlocked tokens directly from the dashboard

**For the Ecosystem:**
- Protocol fees accumulate in AegisVault — a transparent, on-chain treasury
- Per-token fee tracking enables future governance and revenue sharing
- All vesting data is fully on-chain and verifiable

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React Frontend                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Vesting  │  │    Vault     │  │   Stats      │  │
│  │ Explorer │  │   Creator    │  │   Dashboard  │  │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘  │
│       │               │                 │           │
│  ┌────┴───────────────┴─────────────────┴───────┐   │
│  │         OP_NET SDK + WalletConnect           │   │
│  └──────────────────────┬───────────────────────┘   │
└─────────────────────────┼───────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │    Bitcoin L1 (OP_NET) │
              │                       │
              │  ┌─────────────────┐  │
              │  │  AegisVesting   │  │
              │  │  ─────────────  │  │
              │  │  lockTokens()   │  │
              │  │  claim()        │  │
              │  │  getLockInfo()   │  │
              │  │  getVestingProg… │  │
              │  └────────┬────────┘  │
              │           │ 1% fee    │
              │  ┌────────▼────────┐  │
              │  │   AegisVault    │  │
              │  │  ─────────────  │  │
              │  │  depositFee()   │  │
              │  │  withdrawFees() │  │
              │  │  getAccumFees() │  │
              │  └─────────────────┘  │
              └───────────────────────┘
```

---

## Smart Contracts

Built with **AssemblyScript** targeting the OP_NET `btc-runtime`.

### AegisVesting
The core vesting engine. Manages token locks with two vesting modes:

| Method | Description |
|--------|-------------|
| `lockTokens(token, beneficiary, amount, duration, cliffDuration, mode)` | Create a new vesting lock (1% fee deducted) |
| `claim(lockId)` | Claim all unlocked tokens for a given lock |
| `getLockInfo(lockId)` | Read full lock details |
| `getUnlockedAmount(lockId)` | Calculate currently unlocked tokens |
| `getVestingProgress(lockId)` | Get percentage vested |
| `getNextUnlockTime(lockId)` | When the next tokens unlock |
| `getTokenTVL(token)` | Total value locked per token |
| `getGlobalTVL()` | Total value locked across all tokens |
| `getLockCount()` | Total number of locks created |

**Vesting Modes:**
- **LINEAR** — Tokens unlock continuously: `unlocked = total * (elapsed / duration)`
- **CLIFF** — All tokens unlock at once after the cliff period ends

### AegisVault
The protocol treasury that accumulates fees:

| Method | Description |
|--------|-------------|
| `depositFee(token, amount)` | Called by AegisVesting on each lock creation |
| `getAccumulatedFees(token)` | Read accumulated fees for a specific token |
| `withdrawFees(token, recipient)` | Owner-only fee withdrawal |
| `setAuthorizedDepositor(address)` | Configure which contract can deposit |

---

## Frontend

Built with **React + TypeScript + Vite + Tailwind CSS**.

### Vesting Explorer
- Searchable dashboard of all on-chain vesting schedules
- Filter by status (Active / Completed)
- Real-time circular progress rings and neon progress bars
- Claim button for unlocked tokens

### Vault Creator
- 3-step guided flow: Select Token → Configure Vesting → Review & Execute
- Duration presets (3, 6, 12, 24 months)
- LINEAR / CLIFF mode toggle
- Fee breakdown with net amount calculation
- Wallet-integrated transaction signing

### Design
- Glassmorphic dark UI with backdrop blur effects
- Animated counters, staggered page transitions, and glow effects
- Fully responsive (mobile + desktop)
- Framer Motion animations throughout

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | AssemblyScript + `@btc-vision/btc-runtime` |
| Contract Compilation | OP_NET WASM toolchain |
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| Blockchain SDK | `opnet` + `@btc-vision/transaction` |
| Wallet | `@btc-vision/walletconnect` (OP_WALLET) |
| Deployment | Vercel |
| Network | OP_NET Bitcoin L1 (regtest) |

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/mktrades29/aegis-protocol.git
cd aegis-protocol

# Install frontend dependencies
cd frontend
npm install --legacy-peer-deps

# Configure environment
cp .env.example .env
# Add your deployed contract addresses to .env

# Start development server
npm run dev
```

### Contract Development

```bash
cd contracts
npm install
# Edit contracts in contracts/src/
# Build WASM with OP_NET toolchain
```

---

## Mainnet Viability

Aegis Protocol is designed for production deployment on Bitcoin mainnet via OP_NET:

- **No external dependencies** — All logic runs on Bitcoin L1 through OP_NET smart contracts
- **Gas efficient** — Minimal storage operations, batch-friendly lock creation
- **Upgradeable treasury** — Vault owner can be transferred to a multisig or DAO
- **Per-token accounting** — Fee ledger tracks every token independently for transparent governance
- **Standard SDK integration** — Uses official OP_NET SDK and wallet infrastructure

The transition from regtest to mainnet requires only updating the RPC endpoint and redeploying contracts — no code changes needed.

---

## Project Structure

```
aegis-protocol/
├── contracts/
│   ├── AegisVesting.ts          # Vesting engine contract
│   ├── AegisVault.ts            # Revenue vault contract
│   └── src/
│       ├── vesting/AegisVesting.ts
│       └── vault/AegisVault.ts
├── frontend/
│   ├── src/
│   │   ├── components/          # React UI components
│   │   │   ├── Header.tsx       # Branding + wallet connect
│   │   │   ├── StatsBar.tsx     # TVL + protocol metrics
│   │   │   ├── VestingExplorer.tsx  # Lock search + filter
│   │   │   ├── VestingCard.tsx  # Individual lock display
│   │   │   ├── VaultCreator.tsx # 3-step lock creation
│   │   │   ├── ProgressRing.tsx # Circular SVG progress
│   │   │   └── NeonProgressBar.tsx  # Horizontal progress
│   │   ├── services/            # OP_NET RPC integration
│   │   ├── hooks/               # Transaction hooks
│   │   ├── context/             # Wallet state management
│   │   ├── config/              # ABIs + environment config
│   │   └── mock/                # Demo data for showcase
│   └── api/                     # Vercel serverless proxy
└── README.md
```

---

## Hackathon

Built for the **OP_NET Vibecoding Challenge — Week 2: The DeFi Signal**.

Category: **Market Infrastructure** (Token vesting + revenue vault)

`#opnetvibecode` `@opnetbtc`

---

## License

MIT
