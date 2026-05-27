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
    Sends user message + live chain context to OpenAI GPT-4o.
    Returns a structured Action Object or an error dict.

    Success shape (stake):
    {
        "action": "stake",
        "validator_address": "5Xxx...",
        "validator_name": "ValidatorX",
        "amount_pot": 20.0,
        "reasoning": "ValidatorX has the lowest commission at 3% and highest safety score.",
        "raw_intent": "Stake 20 POT to the safest validator"
    }

    Unrecognized intent shape:
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
- Top validators (sorted by safety score, highest = safest):
{json.dumps(validators[:10], indent=2)}

SUPPORTED ACTIONS: {SUPPORTED_ACTIONS}

RESPONSE RULES:
- Respond ONLY with valid JSON. No prose. No markdown. No code fences.
- If the intent is staking, choose the best validator from the list based on the user's words.
  "safest" = highest safety_score. "cheapest" = lowest commission. "best" = highest safety_score.
- If the user specifies an amount in POT, use it exactly. If no amount specified, suggest 10% of free balance.
- If the intent is not in SUPPORTED_ACTIONS, return {{"action": "unknown", "message": "I can currently help with staking and balance checks on Portaldot."}}
- The "reasoning" field must be 1-2 plain English sentences explaining your validator choice.

OUTPUT SCHEMA for stake:
{{
  "action": "stake",
  "validator_address": "<ss58 address from the validators list>",
  "validator_name": "<display_name from the validators list>",
  "amount_pot": <float>,
  "reasoning": "<why this validator was selected>",
  "raw_intent": "<original user message verbatim>"
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
        # Strip accidental markdown fences if the model misbehaves
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)
