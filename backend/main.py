import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from chain import get_balance, get_validators, submit_nomination, log_intent_on_chain, get_signer
from intent import parse_intent

app = FastAPI(
    title="Atlas Lite API",
    description="AI Intent Execution Layer for Portaldot — natural language → verified onchain execution",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://atlas-lite.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ──────────────────────────────────────────────────

class IntentRequest(BaseModel):
    message: str            # raw natural language from the user
    user_address: str       # ss58 address of the user (provided by frontend)

class ExecuteRequest(BaseModel):
    action_object: dict     # the full parsed intent returned by /intent/parse
    user_address: str       # ss58 address (used for context only; signing uses hot wallet)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Liveness check."""
    return {"status": "ok"}


@app.get("/chain/balance/{address}")
def chain_balance(address: str):
    """Returns free and reserved POT balance for the given ss58 address."""
    try:
        return get_balance(address)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/chain/validators")
def chain_validators():
    """Returns active validators sorted by safety score (highest = safest)."""
    try:
        return {"validators": get_validators()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intent/parse")
def intent_parse(req: IntentRequest):
    """
    Step 1: Parse user message into a structured Action Object.

    Fetches live chain state (validators, balance), sends to OpenAI,
    returns the action for frontend confirmation — does NOT execute anything.
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

    For 'stake':
      1. Submits staking.nominate extrinsic (pays POT gas)
      2. Calls IntentLog ink! contract to record the intent on-chain (pays POT gas)

    Returns extrinsic hash, block hash, and contract log status.
    """
    try:
        action = req.action_object
        keypair = get_signer()

        if action["action"] == "stake":
            # 1. Submit the staking nomination
            nom_result = submit_nomination(action["validator_address"], keypair)
            if not nom_result["success"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Nomination failed: {nom_result['error']}"
                )

            # 2. Log the intent in the IntentLog ink! contract
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
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported action: {action['action']}"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Run with: uvicorn main:app --reload --port 8000
