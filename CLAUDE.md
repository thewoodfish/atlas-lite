# CLAUDE.md — Atlas Lite: AI Intent Execution Layer for Portaldot

This file is the authoritative project reference for Claude Code.
Read it fully before touching any file. Never guess at chain details, API shapes, or
conventions — they are all specified here. When in doubt, re-read this file.

---

## Project Identity

**Name:** Atlas Lite
**Tagline:** Natural language → verified onchain execution on Portaldot
**Hackathon:** Portaldot Online Hackathon S1 (DoraHacks)
**Submission requirements:** GitHub repo + README + demo video + deployed contract

---

## What We Are Building

A three-layer system:

```
User (natural language)
        ↓
  Next.js Frontend        ← chat UI, confirmation card, tx result
        ↓
  FastAPI Backend         ← chain queries, OpenAI intent parsing, tx submission
        ↓
  Portaldot Chain         ← ink! IntentLog contract + native pallets (staking, balances)
```

The user types a goal in plain English.
The backend queries live chain state (validators, balances, proposals).
OpenAI parses the intent into a structured Action Object using chain context.
The frontend shows a confirmation card.
On confirm, the backend submits the extrinsic via the Portaldot Python SDK.
The ink! IntentLog contract is called to record the intent on-chain.
The frontend shows the tx hash.

**Single supported demo flow (hackathon scope):**
> "Stake 20 POT to the safest validator"
→ AI resolves best validator → user confirms → staking extrinsic + intent log submitted → tx hash shown

Everything else (governance voting, transfers, identity) is stubbed in the UI with
"Coming soon" labels. Do not build what is not listed here.

---

## Repository Structure

```
atlas-lite/
├── CLAUDE.md                  ← this file (repo root)
├── README.md                  ← hackathon submission readme
├── contract/                  ← ink! smart contract (Rust)
│   ├── Cargo.toml
│   ├── Cargo.lock
│   └── lib.rs
├── backend/                   ← FastAPI Python server
│   ├── main.py
│   ├── chain.py               ← all Portaldot SDK calls
│   ├── intent.py              ← OpenAI intent parsing
│   ├── requirements.txt
│   └── .env.example
├── frontend/                  ← Next.js 14 app
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx           ← chat / intent input screen
│   │   ├── confirm/
│   │   │   └── page.tsx       ← confirmation card
│   │   └── result/
│   │       └── page.tsx       ← tx hash + success screen
│   └── lib/
│       └── api.ts             ← typed fetch wrappers for the backend
└── demo/
    └── script.md              ← demo video talking points
```

---

## Chain Details — Read Before Writing Any Chain Code

| Key            | Value                        |
|----------------|------------------------------|
| WebSocket URL  | `wss://mainnet.portaldot.io` |
| SS58 format    | `42`                         |
| Token symbol   | `POT`                        |
| Token decimals | `14`                         |
| Contract pallet| `Contracts` (ink! v4)        |

**POT amount math:**
```python
# Always use this. Never hardcode raw amounts.
POT_DECIMALS = 14
def to_planck(pot_amount: float) -> int:
    return int(pot_amount * 10 ** POT_DECIMALS)

def from_planck(planck: int) -> float:
    return planck / 10 ** POT_DECIMALS
```

**Substrate interface init (use in every chain.py function):**
```python
from substrateinterface import SubstrateInterface

def get_substrate() -> SubstrateInterface:
    return SubstrateInterface(
        url="wss://mainnet.portaldot.io",
        ss58_format=42,
        type_registry_preset="default"
    )
```

---

## Available Pallets (confirmed from docs)

Use ONLY these. Do not invent pallet names.

| Pallet          | What we use it for                          |
|-----------------|---------------------------------------------|
| `Balances`      | Query user balance, transfer_keep_alive     |
| `Staking`       | Query validators, nominate                  |
| `Contracts`     | Deploy + call the IntentLog ink! contract   |
| `Identity`      | Query on-chain identity (display name)      |
| `Assets`        | Query asset balances (future use, stub now) |
| `Multisig`      | Not used in hackathon scope                 |
| `Proxy`         | Not used in hackathon scope                 |
| `System`        | Account info, block number                  |
| `Utility`       | Batch calls                                 |

---

## ink! Contract — `contract/lib.rs`

**Purpose:** Record every executed intent on-chain. This gives us a native deployed
contract paying POT gas, which satisfies the mandatory judging criterion.

**Contract spec:**

```rust
#[ink::contract]
mod intent_log {
    use ink::prelude::string::String;
    use ink::prelude::vec::Vec;

    #[derive(scale::Decode, scale::Encode, Clone)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct IntentEntry {
        pub caller: AccountId,
        pub intent: String,       // raw user input text
        pub action: String,       // resolved action type e.g. "stake"
        pub timestamp: u64,       // block timestamp
    }

    #[ink(storage)]
    pub struct IntentLog {
        entries: Vec<IntentEntry>,
        owner: AccountId,
    }

    impl IntentLog {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                entries: Vec::new(),
                owner: Self::env().caller(),
            }
        }

        /// Called by backend after every successful execution.
        /// Payable so POT gas is consumed — satisfies native gas requirement.
        #[ink(message)]
        pub fn log_intent(
            &mut self,
            intent: String,
            action: String,
        ) {
            let entry = IntentEntry {
                caller: self.env().caller(),
                intent,
                action,
                timestamp: self.env().block_timestamp(),
            };
            self.entries.push(entry);
        }

        #[ink(message)]
        pub fn get_all(&self) -> Vec<IntentEntry> {
            self.entries.clone()
        }

        #[ink(message)]
        pub fn get_by_caller(&self, caller: AccountId) -> Vec<IntentEntry> {
            self.entries
                .iter()
                .filter(|e| e.caller == caller)
                .cloned()
                .collect()
        }

        #[ink(message)]
        pub fn count(&self) -> u32 {
            self.entries.len() as u32
        }
    }
}
```

**Cargo.toml dependencies:**
```toml
[dependencies]
ink = { version = "4", default-features = false }
scale = { package = "parity-scale-codec", version = "3", default-features = false, features = ["derive"] }
scale-info = { version = "2", default-features = false, features = ["derive"] }
```

**Build command:**
```bash
cd contract
cargo contract build --release
```

Output artifacts needed: `intent_log.wasm` and `intent_log.json` (metadata).
Store deployed contract address in `backend/.env` as `CONTRACT_ADDRESS`.

---

## Backend — FastAPI (`backend/`)

### `requirements.txt`
```
fastapi
uvicorn[standard]
substrateinterface
openai
python-dotenv
pydantic
```

### `.env.example`
```
PORTALDOT_WS=wss://mainnet.portaldot.io
SIGNER_MNEMONIC=your twelve word mnemonic phrase here for the hot wallet
CONTRACT_ADDRESS=5Xxxx...
OPENAI_API_KEY=sk-...
```

**Important:** The signer keypair is a HOT WALLET used only for demo.
In README, clearly note this is for hackathon demo only — production would use
client-side signing (wallet extension).

### `chain.py` — All chain interaction

```python
import os
from substrateinterface import SubstrateInterface, Keypair
from substrateinterface.contracts import ContractInstance

PORTALDOT_WS = os.getenv("PORTALDOT_WS", "wss://mainnet.portaldot.io")
POT_DECIMALS = 14

def get_substrate() -> SubstrateInterface:
    return SubstrateInterface(
        url=PORTALDOT_WS,
        ss58_format=42,
        type_registry_preset="default"
    )

def get_signer() -> Keypair:
    mnemonic = os.getenv("SIGNER_MNEMONIC")
    return Keypair.create_from_mnemonic(mnemonic, ss58_format=42)

def to_planck(pot: float) -> int:
    return int(pot * 10 ** POT_DECIMALS)

def from_planck(planck: int) -> float:
    return round(planck / 10 ** POT_DECIMALS, 4)


def get_balance(address: str) -> dict:
    """Returns free and reserved balance in POT (human-readable)."""
    sub = get_substrate()
    result = sub.query("System", "Account", [address])
    data = result.value["data"]
    return {
        "free": from_planck(data["free"]),
        "reserved": from_planck(data["reserved"]),
        "address": address
    }


def get_validators() -> list[dict]:
    """
    Returns list of active validators with identity and basic info.
    We use staking.validators() + staking.erasRewardPoints() for ranking.
    Safe/risky heuristic: prefer validators with non-zero commission < 20%
    and no slashing history (we approximate with commission for the demo).
    """
    sub = get_substrate()

    # Get active era
    active_era = sub.query("Staking", "ActiveEra").value
    era_index = active_era["index"] if active_era else 0

    # Get all validators
    validators_result = sub.query_map("Staking", "Validators", max_results=50)
    validators = []

    for address, prefs in validators_result:
        addr_str = address.value
        commission_perbill = prefs.value.get("commission", 0)
        commission_pct = round(commission_perbill / 10_000_000, 2)  # perbill → %

        # Try to get identity display name
        identity = sub.query("Identity", "IdentityOf", [addr_str])
        display_name = None
        if identity.value:
            info = identity.value.get("info", {})
            raw = info.get("display", {})
            if isinstance(raw, dict):
                display_name = raw.get("Raw") or raw.get("raw")

        validators.append({
            "address": addr_str,
            "commission_pct": commission_pct,
            "display_name": display_name or addr_str[:12] + "...",
            # Safety score: lower commission = safer for demo purposes
            "safety_score": max(0, 100 - int(commission_pct * 5))
        })

    # Sort by safety score descending
    validators.sort(key=lambda v: v["safety_score"], reverse=True)
    return validators


def submit_nomination(validator_address: str, keypair: Keypair) -> dict:
    """
    Submits a staking.nominate extrinsic.
    Returns receipt info.
    """
    sub = get_substrate()
    call = sub.compose_call(
        call_module="Staking",
        call_function="nominate",
        call_params={"targets": [validator_address]}
    )
    extrinsic = sub.create_signed_extrinsic(call=call, keypair=keypair)
    receipt = sub.submit_extrinsic(extrinsic, wait_for_inclusion=True)
    return {
        "success": receipt.is_success,
        "extrinsic_hash": receipt.extrinsic_hash,
        "block_hash": receipt.block_hash,
        "error": receipt.error_message if not receipt.is_success else None
    }


def log_intent_on_chain(intent_text: str, action: str, keypair: Keypair) -> dict:
    """
    Calls the IntentLog ink! contract to record the executed intent on-chain.
    This is what makes the project Portaldot-native with POT gas.
    """
    import os
    from substrateinterface.contracts import ContractInstance

    sub = get_substrate()
    contract_address = os.getenv("CONTRACT_ADDRESS")

    # Load contract metadata from local file
    metadata_path = os.path.join(
        os.path.dirname(__file__), "..", "contract", "target",
        "ink", "intent_log.json"
    )

    contract = ContractInstance.create_from_address(
        contract_address=contract_address,
        metadata_file=metadata_path,
        substrate=sub
    )

    # Dry run for gas estimation
    gas_estimate = contract.read(keypair, "log_intent",
                                 args={"intent": intent_text, "action": action})

    # Execute
    receipt = contract.exec(
        keypair, "log_intent",
        args={"intent": intent_text, "action": action},
        gas_limit=gas_estimate.gas_required
    )

    return {
        "success": receipt.is_success,
        "contract_events": str(receipt.contract_events) if receipt.is_success else None,
        "error": receipt.error_message if not receipt.is_success else None
    }
```

### `intent.py` — OpenAI Intent Parser

```python
import os
import json
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SUPPORTED_ACTIONS = ["stake", "transfer", "check_balance"]

def parse_intent(
    user_message: str,
    validators: list[dict],
    user_balance: dict
) -> dict:
    """
    Sends user message + chain context to OpenAI.
    Returns a structured Action Object or an error.

    Return shape (success):
    {
        "action": "stake",
        "validator_address": "5Xxx...",
        "validator_name": "ValidatorX",
        "amount_pot": 20.0,
        "reasoning": "ValidatorX has the lowest commission at 3% and highest safety score.",
        "raw_intent": "Stake 20 POT to the safest validator"
    }

    Return shape (unrecognized):
    {
        "action": "unknown",
        "message": "I can currently help with staking and balance checks on Portaldot."
    }
    """
    system_prompt = f"""
You are an onchain assistant for the Portaldot blockchain.
Your job is to parse a user's natural language intent into a structured JSON action.

CURRENT CHAIN STATE:
- User balance: {user_balance["free"]} POT (free), {user_balance["reserved"]} POT (reserved)
- Top validators (sorted by safety score):
{json.dumps(validators[:10], indent=2)}

SUPPORTED ACTIONS: {SUPPORTED_ACTIONS}

RESPONSE RULES:
- Respond ONLY with valid JSON. No prose. No markdown. No code fences.
- If the intent is staking, choose the best validator from the list based on the user's words.
  "safest" = highest safety_score. "cheapest" = lowest commission. "best" = highest safety_score.
- If the user specifies an amount, use it. If not, suggest staking 10% of free balance.
- If the intent is not in SUPPORTED_ACTIONS, return {{"action": "unknown", "message": "..."}}
- The "reasoning" field must be 1-2 plain English sentences explaining your choice.

OUTPUT SCHEMA for stake:
{{
  "action": "stake",
  "validator_address": "<ss58 address>",
  "validator_name": "<display name>",
  "amount_pot": <float>,
  "reasoning": "<why this validator>",
  "raw_intent": "<original user message>"
}}
""".strip()

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        temperature=0,
        max_tokens=400
    )

    raw = response.choices[0].message.content.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Strip accidental markdown fences if model misbehaves
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)
```

### `main.py` — FastAPI routes

```python
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from chain import get_balance, get_validators, submit_nomination, log_intent_on_chain, get_signer
from intent import parse_intent

app = FastAPI(title="Atlas Lite API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://atlas-lite.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request / Response models ──────────────────────────────────────────

class IntentRequest(BaseModel):
    message: str
    user_address: str       # ss58 address of the user (from frontend)

class ExecuteRequest(BaseModel):
    action_object: dict     # the full parsed intent from /intent/parse
    user_address: str

# ── Routes ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/chain/balance/{address}")
def chain_balance(address: str):
    try:
        return get_balance(address)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/chain/validators")
def chain_validators():
    try:
        return {"validators": get_validators()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intent/parse")
def intent_parse(req: IntentRequest):
    """
    Step 1: Parse user message into a structured Action Object.
    Does NOT execute anything. Returns action for frontend confirmation.
    """
    try:
        validators = get_validators()
        balance = get_balance(req.user_address)
        action_obj = parse_intent(req.message, validators, balance)
        return {"action_object": action_obj, "balance": balance}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intent/execute")
def intent_execute(req: ExecuteRequest):
    """
    Step 2: User confirmed. Execute the action on-chain.
    - Submits the staking nomination extrinsic
    - Logs the intent in the IntentLog ink! contract
    Both use POT as gas.
    """
    try:
        action = req.action_object
        keypair = get_signer()

        if action["action"] == "stake":
            # Submit nomination
            nom_result = submit_nomination(action["validator_address"], keypair)
            if not nom_result["success"]:
                raise HTTPException(status_code=400, detail=nom_result["error"])

            # Log intent on-chain (ink! contract call)
            log_result = log_intent_on_chain(
                intent_text=action.get("raw_intent", "stake"),
                action="stake",
                keypair=keypair
            )

            return {
                "success": True,
                "extrinsic_hash": nom_result["extrinsic_hash"],
                "block_hash": nom_result["block_hash"],
                "contract_logged": log_result["success"],
                "action": action
            }

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported action: {action['action']}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Run: uvicorn main:app --reload --port 8000
```

**Start backend:**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in values
uvicorn main:app --reload --port 8000
```

---

## Frontend — Next.js 14 (`frontend/`)

### Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- No UI library — plain Tailwind only

### State flow between pages

```
/  (page.tsx)
  User types intent + wallet address
  POST /intent/parse
  → Receives action_object
  → Stores in sessionStorage as "pendingAction"
  → Navigates to /confirm

/confirm (page.tsx)
  Reads "pendingAction" from sessionStorage
  Displays confirmation card:
    - Action type
    - Validator name + address (truncated)
    - Reasoning from AI
    - Estimated gas: "~0.001 POT"
  On "Confirm & Execute": POST /intent/execute
  → Navigates to /result

/result (page.tsx)
  Reads result from sessionStorage as "lastResult"
  Shows:
    - ✅ Success banner
    - Extrinsic hash (copyable)
    - Block hash (copyable)
    - "View on Explorer" link → https://portaldot.world (or their explorer URL)
    - Intent logged on-chain: ✅
  "Try another" button → back to /
```

### `lib/api.ts`

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ActionObject {
  action: string;
  validator_address?: string;
  validator_name?: string;
  amount_pot?: number;
  reasoning?: string;
  raw_intent?: string;
  message?: string;
}

export interface ParseResponse {
  action_object: ActionObject;
  balance: { free: number; reserved: number; address: string };
}

export interface ExecuteResponse {
  success: boolean;
  extrinsic_hash: string;
  block_hash: string;
  contract_logged: boolean;
  action: ActionObject;
}

export async function parseIntent(
  message: string,
  userAddress: string
): Promise<ParseResponse> {
  const res = await fetch(`${API_BASE}/intent/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, user_address: userAddress }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function executeIntent(
  actionObject: ActionObject,
  userAddress: string
): Promise<ExecuteResponse> {
  const res = await fetch(`${API_BASE}/intent/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action_object: actionObject, user_address: userAddress }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### UI Design conventions

- Background: dark (`#0f0f0f` or Tailwind `bg-zinc-950`)
- Accent: electric purple (`#7c3aed`, Tailwind `violet-600`)
- Text: `zinc-100` primary, `zinc-400` secondary
- Cards: `bg-zinc-900 border border-zinc-800 rounded-2xl`
- Buttons: `bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-6 py-3`
- Font: system-ui, no Google Fonts (keeps it fast)
- Monospace for addresses: `font-mono text-sm text-zinc-400`
- No animations beyond `transition-colors`

---

## README.md — Hackathon Submission Template

The README must contain (Claude Code should generate this last):

```markdown
# Atlas Lite — AI Intent Execution Layer for Portaldot

> Natural language → verified onchain execution on Portaldot

## What It Does
[2-3 sentences. Start with the user problem, end with the solution.]

## Demo
[Embed demo video link here]

## Architecture
[Paste the three-layer diagram from CLAUDE.md]

## Deployed Contract
- **Network:** Portaldot Mainnet
- **Contract address:** `5Xxx...`
- **ABI / metadata:** `contract/target/ink/intent_log.json`

## Tech Stack
- ink! smart contract (Rust) — IntentLog on Portaldot
- FastAPI (Python) — chain queries + intent execution
- OpenAI GPT-4o — natural language → Action Object
- Next.js 14 + Tailwind — frontend
- Portaldot Python SDK (substrateinterface)

## Local Setup
### Prerequisites
- Rust + cargo-contract (`cargo install cargo-contract`)
- Python 3.11+
- Node.js 18+

### 1. Deploy the contract
[steps]

### 2. Start the backend
[steps]

### 3. Start the frontend
[steps]

## Hackathon Judging Criteria
| Criterion | How we meet it |
|---|---|
| Portaldot Native Deployment | ink! contract deployed on mainnet, all txs pay POT gas |
| Demo Completion | End-to-end: NL input → AI parse → confirm → tx hash |
| Application Value | UX abstraction layer every Portaldot dApp needs |
| Presentation Quality | Single unbroken flow, live on mainnet |

## Security Note
The demo uses a hot wallet signer on the backend for simplicity.
Production would use client-side wallet signing (browser extension).
```

---

## Environment Variables Reference

| Variable           | Used in  | Description                                      |
|--------------------|----------|--------------------------------------------------|
| `PORTALDOT_WS`     | backend  | WebSocket URL, default `wss://mainnet.portaldot.io` |
| `SIGNER_MNEMONIC`  | backend  | 12-word mnemonic of the demo hot wallet          |
| `CONTRACT_ADDRESS` | backend  | Deployed IntentLog contract ss58 address         |
| `OPENAI_API_KEY`   | backend  | OpenAI API key (GPT-4o)                          |
| `NEXT_PUBLIC_API_URL` | frontend | Backend URL, default `http://localhost:8000`  |

---

## Build Order for Claude Code

Execute in this order. Do not skip steps.

1. **Write `contract/lib.rs`** — exact spec above. Build with `cargo contract build --release`.
2. **Write `backend/chain.py`** — exact spec above.
3. **Write `backend/intent.py`** — exact spec above.
4. **Write `backend/main.py`** — exact spec above.
5. **Write `backend/requirements.txt`** and **`.env.example`**.
6. **Write `frontend/lib/api.ts`** — exact spec above.
7. **Write `frontend/app/page.tsx`** — intent input screen.
8. **Write `frontend/app/confirm/page.tsx`** — confirmation card.
9. **Write `frontend/app/result/page.tsx`** — success screen.
10. **Write `frontend/app/layout.tsx`** — dark theme wrapper.
11. **Write `README.md`** — fill in the template above after contract is deployed.
12. **Write `demo/script.md`** — step-by-step demo video talking points.

---

## Common Mistakes to Avoid

- **Never use `10 ** 18` for POT amounts.** Decimals are `14`, not 18.
- **Never call pallets that aren't in the confirmed list** above. The chain has a specific set.
- **Never use EVM/Solidity patterns.** This is Substrate + ink!. Everything is extrinsics and pallets.
- **Never build the governance or transfer flows for the hackathon.** Stub them in UI only.
- **Never store the mnemonic in code.** Always `.env` only, `.env` in `.gitignore`.
- **Never make the frontend call the chain directly.** All chain calls go through the FastAPI backend.
- **Always dry-run ink! contract calls before executing** to get accurate gas estimates.
- **The `substrateinterface` package is the SDK.** Import from it, not from some other library.

---

## Demo Video Script (`demo/script.md`)

Claude Code should generate this file with the following structure:

```
00:00 — Show the home screen. Type: "Stake 20 POT to the safest validator"
00:10 — Loading state while backend queries validators + calls OpenAI
00:18 — Confirmation card appears. Read out: validator name, reasoning, gas estimate
00:25 — Click "Confirm & Execute"
00:28 — Loading state while extrinsics submit
00:35 — Success screen. Show extrinsic hash. Show "Intent logged on-chain: ✅"
00:45 — Open Portaldot explorer. Paste extrinsic hash. Show confirmed block.
00:55 — Wrap up: "One sentence. Natural language. Live on Portaldot mainnet."
```

Total demo video target: under 90 seconds.

---

*Last updated: May 2026. Built for Portaldot Online Hackathon S1.*