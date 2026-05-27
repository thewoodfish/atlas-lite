# Atlas Lite — AI Intent Execution Layer for Portaldot

> Natural language → verified onchain execution on Portaldot

## What It Does

Users type a goal in plain English — *"Stake 20 POT to the safest validator"* — and Atlas Lite handles everything: it queries live chain state, resolves the best validator using GPT-4o, presents a confirmation card, and submits the staking extrinsic + records the intent in a deployed ink! contract on Portaldot Mainnet. No ABI knowledge, no manual transaction construction — just intent.

## Demo

> 📹 [Demo video link — add after recording]

## Architecture

```
User (natural language)
        ↓
  Next.js Frontend        ← chat UI, confirmation card, tx result
        ↓
  FastAPI Backend         ← chain queries, OpenAI intent parsing, tx submission
        ↓
  Portaldot Chain         ← ink! IntentLog contract + native pallets (staking, balances)
```

**Single demo flow (hackathon scope):**
> "Stake 20 POT to the safest validator"  
> → AI resolves best validator → user confirms → staking extrinsic + intent log submitted → tx hash shown

Governance voting, transfers, and identity management are stubbed in the UI as "Coming soon."

## Deployed Contract

| Field | Value |
|---|---|
| **Network** | Portaldot Mainnet |
| **Contract address** | `5Xxx...` ← update after deployment |
| **ABI / metadata** | `contract/target/ink/intent_log.json` |

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | ink! v4 (Rust) — IntentLog on Portaldot |
| Backend | FastAPI (Python) + substrateinterface SDK |
| AI parsing | OpenAI GPT-4o — natural language → Action Object |
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Chain SDK | [substrateinterface](https://github.com/polkascan/py-substrate-interface) |

## Local Setup

### Prerequisites

- **Rust** + `cargo-contract`: `cargo install cargo-contract`
- **Python 3.11+**
- **Node.js 18+**

---

### 1. Build and deploy the contract

```bash
cd contract
cargo contract build --release
# Artifacts: contract/target/ink/intent_log.wasm + intent_log.json

# Deploy to Portaldot Mainnet:
cargo contract instantiate \
  --manifest-path Cargo.toml \
  --suri "your mnemonic here" \
  --constructor new \
  --url wss://mainnet.portaldot.io

# Note the deployed contract address → put it in backend/.env as CONTRACT_ADDRESS
```

---

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env: fill in SIGNER_MNEMONIC, CONTRACT_ADDRESS, OPENAI_API_KEY

uvicorn main:app --reload --port 8000
# API at http://localhost:8000  |  Docs at http://localhost:8000/docs
```

---

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
# App at http://localhost:3000
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/chain/balance/{address}` | Get POT balance for an address |
| `GET` | `/chain/validators` | List active validators ranked by safety |
| `POST` | `/intent/parse` | Parse NL intent → Action Object (no execution) |
| `POST` | `/intent/execute` | Execute confirmed action on-chain |

---

## Hackathon Judging Criteria

| Criterion | How we meet it |
|---|---|
| **Portaldot Native Deployment** | ink! IntentLog contract deployed on mainnet; all transactions pay POT gas |
| **Demo Completion** | End-to-end: NL input → AI parse → confirmation card → tx hash + explorer link |
| **Application Value** | UX abstraction layer that every Portaldot dApp needs — users never touch raw extrinsics |
| **Presentation Quality** | Single unbroken flow, live on Portaldot Mainnet, under 90-second demo video |

---

## Environment Variables

| Variable | Used in | Description |
|---|---|---|
| `PORTALDOT_WS` | backend | WebSocket URL, default `wss://mainnet.portaldot.io` |
| `SIGNER_MNEMONIC` | backend | 12-word mnemonic of the demo hot wallet |
| `CONTRACT_ADDRESS` | backend | Deployed IntentLog contract ss58 address |
| `OPENAI_API_KEY` | backend | OpenAI API key (GPT-4o) |
| `NEXT_PUBLIC_API_URL` | frontend | Backend URL, default `http://localhost:8000` |

---

## Security Note

The demo uses a **hot wallet signer on the backend** for simplicity.  
**Production** would use client-side wallet signing (browser extension / WalletConnect) — the backend would never hold private keys.

---

*Built for Portaldot Online Hackathon S1 (DoraHacks) · May 2026*
