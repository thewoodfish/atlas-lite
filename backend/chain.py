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
    if not mnemonic:
        raise EnvironmentError("SIGNER_MNEMONIC is not set in environment")
    return Keypair.create_from_mnemonic(mnemonic, ss58_format=42)


def to_planck(pot: float) -> int:
    """Convert human-readable POT to planck (smallest unit). Decimals = 14."""
    return int(pot * 10 ** POT_DECIMALS)


def from_planck(planck: int) -> float:
    """Convert planck to human-readable POT."""
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
    We use staking.validators() for commission data and rank by safety heuristic.

    Safety/risk heuristic:
      - Prefer validators with commission < 20%
      - safety_score = max(0, 100 - commission_pct * 5)
      - Sorted descending by safety_score
    """
    sub = get_substrate()

    # Get all validators (cap at 50 for demo performance)
    validators_result = sub.query_map("Staking", "Validators", max_results=50)
    validators = []

    for address, prefs in validators_result:
        addr_str = address.value
        commission_perbill = prefs.value.get("commission", 0)
        # perbill → percentage: 1_000_000_000 = 100%
        commission_pct = round(commission_perbill / 10_000_000, 2)

        # Try to get on-chain identity display name
        display_name = None
        try:
            identity = sub.query("Identity", "IdentityOf", [addr_str])
            if identity.value:
                info = identity.value.get("info", {})
                raw = info.get("display", {})
                if isinstance(raw, dict):
                    display_name = raw.get("Raw") or raw.get("raw")
        except Exception:
            pass  # identity pallet may not have an entry — that's fine

        validators.append({
            "address": addr_str,
            "commission_pct": commission_pct,
            "display_name": display_name or addr_str[:12] + "...",
            # Safety score: lower commission = safer for demo purposes
            "safety_score": max(0, 100 - int(commission_pct * 5))
        })

    # Sort by safety score descending so the "safest" validator is first
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

    Requires CONTRACT_ADDRESS env var to be set to the deployed contract address.
    Requires contract/target/ink/intent_log.json to exist (built artifact).
    """
    sub = get_substrate()
    contract_address = os.getenv("CONTRACT_ADDRESS")
    if not contract_address:
        raise EnvironmentError("CONTRACT_ADDRESS is not set in environment")

    # Load contract metadata from the build artifact
    metadata_path = os.path.join(
        os.path.dirname(__file__), "..", "contract", "target",
        "ink", "intent_log.json"
    )

    contract = ContractInstance.create_from_address(
        contract_address=contract_address,
        metadata_file=metadata_path,
        substrate=sub
    )

    # Dry run to estimate gas before executing
    gas_estimate = contract.read(
        keypair,
        "log_intent",
        args={"intent": intent_text, "action": action}
    )

    # Execute with estimated gas
    receipt = contract.exec(
        keypair,
        "log_intent",
        args={"intent": intent_text, "action": action},
        gas_limit=gas_estimate.gas_required
    )

    return {
        "success": receipt.is_success,
        "contract_events": str(receipt.contract_events) if receipt.is_success else None,
        "error": receipt.error_message if not receipt.is_success else None
    }
