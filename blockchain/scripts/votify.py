#!/usr/bin/env python3
"""Votify blockchain automation for MultiChain running inside Docker.

This tool intentionally operates only on the blockchain layer: MultiChain CLI,
streams, assets, permissions, filters, votes and audit reports.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FILTERS_DIR = ROOT / "filters"
REPORTS_DIR = ROOT / "reports"

DEFAULT_CHAIN = "votifychain"
DEFAULT_MASTER = "votify-master"
DEFAULT_SLAVE = "votify-slave"
DEFAULT_ASSET = "VOTE_ELEICAO_001"
IDENTITIES_STREAM = "identidades"
CREDENTIALS_STREAM = "credenciais_emitidas"
BALLOT_STREAM = "urna"
URNA_STREAM_FILTER = "votify_urna_schema_v1"
VOTE_TX_FILTER = "votify_vote_tx_v3"
LEGACY_TX_FILTERS = ["votify_vote_tx_v1", "votify_vote_tx_v2"]


class VotifyError(RuntimeError):
    pass


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def parse_cli_output(output: str) -> Any:
    text = output.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def run_process(args: list[str], cwd: Path | None = None, check: bool = True) -> Any:
    completed = subprocess.run(
        args,
        cwd=str(cwd) if cwd else None,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    if check and completed.returncode != 0:
        command = " ".join(args)
        raise VotifyError(
            f"Command failed ({completed.returncode}): {command}\n"
            f"STDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}"
        )

    return parse_cli_output(completed.stdout)


class MultiChain:
    def __init__(self, chain: str, master: str, slave: str | None = None) -> None:
        self.chain = chain
        self.master = master
        self.slave = slave

    def cli(self, cli_args: list[Any], container: str | None = None, check: bool = True) -> Any:
        target = container or self.master
        args = ["docker", "exec", target, "multichain-cli", self.chain]
        args.extend(str(arg) for arg in cli_args)
        return run_process(args, check=check)

    def compose(self, compose_args: list[str]) -> Any:
        return run_process(["docker", "compose", *compose_args], cwd=ROOT)


def first_address_with_permission(mc: MultiChain, permission: str) -> str:
    rows = mc.cli(["listpermissions", permission])
    if not rows:
        raise VotifyError(f"No address has the '{permission}' permission")
    address = rows[0].get("address")
    if not address:
        raise VotifyError(f"Unexpected listpermissions {permission} result: {rows}")
    return address


def list_by_name(mc: MultiChain, command: str, name: str) -> list[dict[str, Any]]:
    result = mc.cli([command, name], check=False)
    if isinstance(result, list):
        return result
    return []


def stream_exists(mc: MultiChain, name: str) -> bool:
    return bool(list_by_name(mc, "liststreams", name))


def asset_exists(mc: MultiChain, name: str) -> bool:
    return bool(list_by_name(mc, "listassets", name))


def filter_exists(mc: MultiChain, command: str, name: str) -> bool:
    return bool(list_by_name(mc, command, name))


def wait_until(label: str, predicate, timeout_seconds: int = 75) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if predicate():
            return
        time.sleep(3)
    raise VotifyError(f"Timed out waiting for {label}")


def ensure_stream(mc: MultiChain, name: str, open_to_all_writers: bool = False) -> None:
    if stream_exists(mc, name):
        print(f"stream ok: {name}")
        return
    mc.cli(["create", "stream", name, "true" if open_to_all_writers else "false"])
    wait_until(f"stream {name}", lambda: stream_exists(mc, name))
    print(f"stream created: {name}")


def subscribe_streams(mc: MultiChain, container: str, streams: list[str]) -> None:
    for stream in streams:
        mc.cli(["subscribe", stream], container=container, check=False)
        print(f"subscribed {container}: {stream}")


def ensure_asset(mc: MultiChain, asset: str, initial_supply: int) -> None:
    if asset_exists(mc, asset):
        print(f"asset ok: {asset}")
        return

    admin = first_address_with_permission(mc, "admin")
    params = {
        "name": asset,
        "open": True,
        "restrict": "send",
    }
    mc.cli(["issue", admin, compact_json(params), str(initial_supply), "1"])
    wait_until(f"asset {asset}", lambda: asset_exists(mc, asset))
    print(f"asset created: {asset} supply={initial_supply}")


def get_burn_address(mc: MultiChain) -> str:
    info = mc.cli(["getinfo"])
    burn = info.get("burnaddress") if isinstance(info, dict) else None
    if not burn:
        raise VotifyError("Could not read burnaddress from getinfo")
    return burn


def grant_global(mc: MultiChain, address: str, permissions: str) -> None:
    mc.cli(["grant", address, permissions], check=False)


def grant_stream_write(mc: MultiChain, address: str, stream: str) -> None:
    mc.cli(["grant", address, f"{stream}.write"], check=False)


def grant_asset_send(mc: MultiChain, address: str, asset: str) -> None:
    mc.cli(["grant", address, f"{asset}.send"], check=False)


def admin_asset_balance(mc: MultiChain, admin: str, asset: str) -> float:
    balances = mc.cli(["getaddressbalances", admin, "0"], check=False)
    if not isinstance(balances, list):
        return 0
    total = 0.0
    for item in balances:
        if item.get("name") == asset:
            total += float(item.get("qty", 0))
    return total


def extract_asset_qty(value: Any, asset: str) -> float:
    if isinstance(value, dict):
        qty = 0.0
        if value.get("name") == asset or value.get("asset") == asset:
            try:
                qty += float(value.get("qty", 0))
            except (TypeError, ValueError):
                pass
        for nested in value.values():
            qty += extract_asset_qty(nested, asset)
        return qty
    if isinstance(value, list):
        return sum(extract_asset_qty(item, asset) for item in value)
    return 0.0


def ensure_admin_token_balance(mc: MultiChain, asset: str, minimum: int) -> None:
    admin = first_address_with_permission(mc, "admin")
    current = admin_asset_balance(mc, admin, asset)
    if current >= minimum:
        return
    missing = minimum - int(current)
    mc.cli(["issuemore", admin, asset, str(missing)])
    print(f"asset topped up: {asset} +{missing}")


def test_and_create_stream_filter(mc: MultiChain) -> None:
    code = (FILTERS_DIR / "urna_stream_filter.js").read_text(encoding="utf-8")
    mc.cli(["teststreamfilter", "{}", code])

    if not filter_exists(mc, "liststreamfilters", URNA_STREAM_FILTER):
        mc.cli(["create", "streamfilter", URNA_STREAM_FILTER, "{}", code])
        wait_until(
            f"stream filter {URNA_STREAM_FILTER}",
            lambda: filter_exists(mc, "liststreamfilters", URNA_STREAM_FILTER),
        )
        print(f"stream filter created: {URNA_STREAM_FILTER}")
    else:
        print(f"stream filter ok: {URNA_STREAM_FILTER}")

    admin = first_address_with_permission(mc, "admin")
    approval = {"for": BALLOT_STREAM, "approve": True}
    mc.cli(["approvefrom", admin, URNA_STREAM_FILTER, compact_json(approval)], check=False)
    print(f"stream filter approved for: {BALLOT_STREAM}")


def render_vote_tx_filter(asset: str, burn_address: str) -> str:
    template = (FILTERS_DIR / "vote_tx_filter.template.js").read_text(encoding="utf-8")
    return (
        template.replace("__VOTE_ASSET__", asset)
        .replace("__BALLOT_STREAM__", BALLOT_STREAM)
        .replace("__BURN_ADDRESS__", burn_address)
    )


def test_and_create_tx_filter(mc: MultiChain, asset: str, burn_address: str) -> None:
    admin = first_address_with_permission(mc, "admin")

    for legacy_filter in LEGACY_TX_FILTERS:
        if filter_exists(mc, "listtxfilters", legacy_filter):
            mc.cli(["approvefrom", admin, legacy_filter, "false"], check=False)
            print(f"legacy transaction filter deactivated: {legacy_filter}")

    code = render_vote_tx_filter(asset, burn_address)
    options = {"for": BALLOT_STREAM}
    mc.cli(["testtxfilter", compact_json(options), code])

    if not filter_exists(mc, "listtxfilters", VOTE_TX_FILTER):
        mc.cli(["create", "txfilter", VOTE_TX_FILTER, compact_json(options), code])
        wait_until(
            f"transaction filter {VOTE_TX_FILTER}",
            lambda: filter_exists(mc, "listtxfilters", VOTE_TX_FILTER),
        )
        print(f"transaction filter created: {VOTE_TX_FILTER}")
    else:
        print(f"transaction filter ok: {VOTE_TX_FILTER}")

    mc.cli(["approvefrom", admin, VOTE_TX_FILTER, "true"], check=False)
    print(f"transaction filter approved: {VOTE_TX_FILTER}")


def wait_for_node(mc: MultiChain, timeout_seconds: int = 60) -> None:
    deadline = time.time() + timeout_seconds
    last_error = ""
    while time.time() < deadline:
        try:
            info = mc.cli(["getinfo"])
            if isinstance(info, dict) and info.get("chainname") == mc.chain:
                return
        except Exception as exc:  # noqa: BLE001 - used for polling readiness
            last_error = str(exc)
        time.sleep(2)
    raise VotifyError(f"MultiChain node did not become ready: {last_error}")


def normalize_cpf(cpf: str) -> str:
    digits = "".join(ch for ch in cpf if ch.isdigit())
    if len(digits) != 11:
        raise VotifyError("CPF must contain exactly 11 digits after normalization")
    return digits


def hmac_cpf(cpf: str, secret: str, election_id: str) -> str:
    message = f"{election_id}:{normalize_cpf(cpf)}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def publish_json(mc: MultiChain, stream: str, key: str, payload: dict[str, Any]) -> str:
    return mc.cli(["publish", stream, key, compact_json({"json": payload})])


def register_voter(mc: MultiChain, election_id: str, voter_id_hash: str, public_key: str) -> str:
    payload = {
        "schema_version": 1,
        "election_id": election_id,
        "voter_id_hash": voter_id_hash,
        "public_key": public_key,
        "status": "eligible",
    }
    key = f"identity:{election_id}:{voter_id_hash}"
    return publish_json(mc, IDENTITIES_STREAM, key, payload)


def credential_already_issued(mc: MultiChain, election_id: str, voter_id_hash: str) -> bool:
    key = f"credential:{election_id}:{voter_id_hash}"
    items = mc.cli(["liststreamkeyitems", CREDENTIALS_STREAM, key, "false", "1"], check=False)
    return isinstance(items, list) and len(items) > 0


def issue_credential(
    mc: MultiChain,
    election_id: str,
    voter_id_hash: str,
    voter_address: str | None,
    asset: str,
    force: bool = False,
) -> dict[str, Any]:
    if credential_already_issued(mc, election_id, voter_id_hash) and not force:
        raise VotifyError(
            f"Credential already issued for election={election_id} voter={voter_id_hash}"
        )

    admin = first_address_with_permission(mc, "admin")
    if not voter_address:
        voter_address = mc.cli(["getnewaddress"])

    grant_global(mc, voter_address, "send,receive")
    grant_asset_send(mc, voter_address, asset)
    grant_stream_write(mc, voter_address, BALLOT_STREAM)
    ensure_admin_token_balance(mc, asset, 1)

    token_txid = mc.cli(["sendassetfrom", admin, voter_address, asset, "1"])
    credential_payload = {
        "schema_version": 1,
        "election_id": election_id,
        "voter_id_hash": voter_id_hash,
        "credential_status": "issued",
    }
    key = f"credential:{election_id}:{voter_id_hash}"
    credential_txid = publish_json(mc, CREDENTIALS_STREAM, key, credential_payload)

    return {
        "election_id": election_id,
        "voter_id_hash": voter_id_hash,
        "voter_address": voter_address,
        "asset": asset,
        "token_transfer_txid": token_txid,
        "credential_record_txid": credential_txid,
    }


def cast_vote(mc: MultiChain, election_id: str, choice: str, voter_address: str, asset: str) -> dict[str, Any]:
    burn_address = get_burn_address(mc)
    grant_global(mc, burn_address, "receive")

    vote_payload = {
        "schema_version": 1,
        "election_id": election_id,
        "choice": choice,
    }
    outputs = {
        burn_address: {
            asset: 1,
        }
    }
    data = [
        {
            "for": BALLOT_STREAM,
            "keys": [f"election:{election_id}", f"choice:{choice}"],
            "data": {"json": vote_payload},
        }
    ]

    txid = mc.cli(["createrawsendfrom", voter_address, compact_json(outputs), compact_json(data), "send"])
    receipt = build_receipt(mc, txid, election_id=election_id, allow_pending=True)
    return {
        "txid": txid,
        "burn_address": burn_address,
        "receipt": receipt,
    }


def stream_items_for_tx(mc: MultiChain, txid: str) -> list[dict[str, Any]]:
    direct = mc.cli(["liststreamtxitems", BALLOT_STREAM, txid, "true"], check=False)
    if isinstance(direct, list):
        return direct

    items = mc.cli(["liststreamitems", BALLOT_STREAM, "true", "100000", "0"], check=False)
    if not isinstance(items, list):
        return []
    return [item for item in items if item.get("txid") == txid]


def build_receipt(
    mc: MultiChain,
    txid: str,
    election_id: str | None = None,
    allow_pending: bool = False,
) -> dict[str, Any]:
    items = stream_items_for_tx(mc, txid)
    if not items:
        if allow_pending:
            return {
                "status": "pending_stream_index",
                "txid": txid,
                "message": "Transaction sent; stream item is not indexed yet.",
            }
        raise VotifyError(f"No urna stream item found for txid={txid}")

    item = items[0]
    blockhash = item.get("blockhash")
    blocktime = item.get("blocktime")
    confirmations = item.get("confirmations", 0)
    vout = item.get("vout")
    stream_item_id = f"{txid}:{vout}"

    blockheight = None
    if blockhash:
        block = mc.cli(["getblock", blockhash], check=False)
        if isinstance(block, dict):
            blockheight = block.get("height")

    receipt_hash_source = f"{txid}|{blockhash or 'pending'}|{stream_item_id}"
    receipt_hash = hashlib.sha256(receipt_hash_source.encode("utf-8")).hexdigest()

    receipt = {
        "status": "confirmed" if blockhash else "pending_block",
        "election_id": election_id,
        "txid": txid,
        "stream": BALLOT_STREAM,
        "stream_item_id": stream_item_id,
        "blockhash": blockhash,
        "blockheight": blockheight,
        "blocktime": blocktime,
        "confirmations": confirmations,
        "receipt_hash": receipt_hash,
    }
    return receipt


def data_json(item: dict[str, Any]) -> dict[str, Any] | None:
    data = item.get("data")
    if isinstance(data, dict) and isinstance(data.get("json"), dict):
        return data["json"]
    return None


def asset_sent_to_address_in_tx(mc: MultiChain, txid: str, address: str, asset: str) -> float:
    tx = mc.cli(["getrawtransaction", txid, "1"], check=False)
    if not isinstance(tx, dict):
        return 0.0

    total = 0.0
    for output in tx.get("vout", []):
        script = output.get("scriptPubKey", {})
        addresses = script.get("addresses", [])
        if address not in addresses:
            continue
        for asset_item in output.get("assets", []):
            if asset_item.get("name") == asset:
                total += float(asset_item.get("qty", 0))
    return total


def audit(mc: MultiChain, election_id: str | None, asset: str) -> dict[str, Any]:
    info = mc.cli(["getinfo"])
    burn_address = get_burn_address(mc)

    votes = mc.cli(["liststreamitems", BALLOT_STREAM, "true", "100000", "0"], check=False)
    if not isinstance(votes, list):
        votes = []

    credentials = mc.cli(["liststreamitems", CREDENTIALS_STREAM, "true", "100000", "0"], check=False)
    if not isinstance(credentials, list):
        credentials = []

    filtered_votes = []
    counts: Counter[str] = Counter()
    min_confirmations = None
    tokens_burned_by_vote_transactions = 0.0

    for item in votes:
        payload = data_json(item)
        if not payload:
            continue
        if election_id and payload.get("election_id") != election_id:
            continue
        filtered_votes.append(item)
        counts[str(payload.get("choice"))] += 1
        confirmations = item.get("confirmations")
        if isinstance(confirmations, int):
            min_confirmations = confirmations if min_confirmations is None else min(min_confirmations, confirmations)
        txid = item.get("txid")
        if txid:
            tokens_burned_by_vote_transactions += asset_sent_to_address_in_tx(
                mc, txid, burn_address, asset
            )

    filtered_credentials = []
    for item in credentials:
        payload = data_json(item)
        if not payload:
            continue
        if election_id and payload.get("election_id") != election_id:
            continue
        filtered_credentials.append(item)

    asset_info = list_by_name(mc, "listassets", asset)
    chain_height = info.get("blocks") if isinstance(info, dict) else None

    report = {
        "chain": mc.chain,
        "chain_height": chain_height,
        "election_id": election_id,
        "asset": asset,
        "burn_address": burn_address,
        "tokens_burned_by_vote_transactions": tokens_burned_by_vote_transactions,
        "votes_total": len(filtered_votes),
        "votes_by_choice": dict(sorted(counts.items())),
        "credentials_issued": len(filtered_credentials),
        "votes_match_burned_tokens": tokens_burned_by_vote_transactions == len(filtered_votes),
        "min_vote_confirmations": min_confirmations,
        "asset_info": asset_info[0] if asset_info else None,
    }
    return report


def save_report(report: dict[str, Any], name: str) -> Path:
    REPORTS_DIR.mkdir(exist_ok=True)
    path = REPORTS_DIR / name
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def cmd_up(args: argparse.Namespace) -> None:
    mc = MultiChain(args.chain, args.master, args.slave)
    mc.compose(["up", "-d", "--build"])
    wait_for_node(mc, args.timeout)
    print("network is up")


def cmd_setup(args: argparse.Namespace) -> None:
    mc = MultiChain(args.chain, args.master, args.slave)
    wait_for_node(mc, args.timeout)

    ensure_stream(mc, IDENTITIES_STREAM, open_to_all_writers=False)
    ensure_stream(mc, CREDENTIALS_STREAM, open_to_all_writers=False)
    ensure_stream(mc, BALLOT_STREAM, open_to_all_writers=False)
    subscribe_streams(mc, args.master, [IDENTITIES_STREAM, CREDENTIALS_STREAM, BALLOT_STREAM])
    if args.slave:
        subscribe_streams(mc, args.slave, [IDENTITIES_STREAM, CREDENTIALS_STREAM, BALLOT_STREAM])

    ensure_asset(mc, args.asset, args.initial_supply)
    burn_address = get_burn_address(mc)
    grant_global(mc, burn_address, "receive")
    print(f"burn address: {burn_address}")

    if not args.skip_filters:
        test_and_create_stream_filter(mc)
        test_and_create_tx_filter(mc, args.asset, burn_address)

    print("setup complete")


def cmd_hash_cpf(args: argparse.Namespace) -> None:
    print(hmac_cpf(args.cpf, args.secret, args.election_id))


def cmd_register_voter(args: argparse.Namespace) -> None:
    mc = MultiChain(args.chain, args.master, args.slave)
    txid = register_voter(mc, args.election_id, args.voter_id_hash, args.public_key)
    print(json.dumps({"identity_txid": txid}, ensure_ascii=False, indent=2))


def cmd_issue_credential(args: argparse.Namespace) -> None:
    mc = MultiChain(args.chain, args.master, args.slave)
    result = issue_credential(
        mc,
        election_id=args.election_id,
        voter_id_hash=args.voter_id_hash,
        voter_address=args.voter_address,
        asset=args.asset,
        force=args.force,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_cast_vote(args: argparse.Namespace) -> None:
    mc = MultiChain(args.chain, args.master, args.slave)
    result = cast_vote(mc, args.election_id, args.choice, args.voter_address, args.asset)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_receipt(args: argparse.Namespace) -> None:
    mc = MultiChain(args.chain, args.master, args.slave)
    receipt = build_receipt(mc, args.txid, election_id=args.election_id)
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


def cmd_audit(args: argparse.Namespace) -> None:
    mc = MultiChain(args.chain, args.master, args.slave)
    report = audit(mc, args.election_id, args.asset)
    if args.output:
        path = save_report(report, args.output)
        report["report_file"] = str(path)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def cmd_status(args: argparse.Namespace) -> None:
    mc = MultiChain(args.chain, args.master, args.slave)
    status = {
        "info": mc.cli(["getinfo"]),
        "streams": mc.cli(["liststreams"]),
        "assets": mc.cli(["listassets"]),
        "stream_filters": mc.cli(["liststreamfilters"], check=False),
        "tx_filters": mc.cli(["listtxfilters"], check=False),
        "peers": mc.cli(["getpeerinfo"], check=False),
    }
    print(json.dumps(status, ensure_ascii=False, indent=2))


def cmd_grant_address(args: argparse.Namespace) -> None:
    mc = MultiChain(args.chain, args.master, args.slave)
    grant_global(mc, args.address, args.permissions)
    if args.stream_write:
        grant_stream_write(mc, args.address, args.stream_write)
    print("grant complete")


def cmd_authorize_slave(args: argparse.Namespace) -> None:
    mc = MultiChain(args.chain, args.master, args.slave)
    logs = run_process(["docker", "logs", args.slave], check=False)
    logs_text = logs if isinstance(logs, str) else json.dumps(logs)
    match = re.search(r"grant\s+([A-Za-z0-9]+)\s+connect(?:,send,receive)?", logs_text)
    if not match:
        raise VotifyError(f"Could not find pending slave address in docker logs for {args.slave}")

    address = match.group(1)
    grant_global(mc, address, "connect,send,receive")
    print(json.dumps({"slave_container": args.slave, "authorized_address": address}, indent=2))


def add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--chain", default=os.getenv("VOTIFY_CHAIN", DEFAULT_CHAIN))
    parser.add_argument("--master", default=os.getenv("VOTIFY_MASTER_CONTAINER", DEFAULT_MASTER))
    parser.add_argument("--slave", default=os.getenv("VOTIFY_SLAVE_CONTAINER", DEFAULT_SLAVE))
    parser.add_argument("--asset", default=os.getenv("VOTIFY_ASSET", DEFAULT_ASSET))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Votify MultiChain automation")
    sub = parser.add_subparsers(dest="command", required=True)

    up = sub.add_parser("up", help="build and start the Docker MultiChain network")
    add_common(up)
    up.add_argument("--timeout", type=int, default=90)
    up.set_defaults(func=cmd_up)

    setup = sub.add_parser("setup", help="create streams, asset, subscriptions and filters")
    add_common(setup)
    setup.add_argument("--initial-supply", type=int, default=100)
    setup.add_argument("--skip-filters", action="store_true")
    setup.add_argument("--timeout", type=int, default=90)
    setup.set_defaults(func=cmd_setup)

    hash_cpf_cmd = sub.add_parser("hash-cpf", help="calculate HMAC-SHA256 voter id hash")
    hash_cpf_cmd.add_argument("--cpf", required=True)
    hash_cpf_cmd.add_argument("--secret", required=True)
    hash_cpf_cmd.add_argument("--election-id", required=True)
    hash_cpf_cmd.set_defaults(func=cmd_hash_cpf)

    register = sub.add_parser("register-voter", help="publish an eligible voter in identidades")
    add_common(register)
    register.add_argument("--election-id", required=True)
    register.add_argument("--voter-id-hash", required=True)
    register.add_argument("--public-key", required=True)
    register.set_defaults(func=cmd_register_voter)

    issue = sub.add_parser("issue-credential", help="send one voting token to a voter address")
    add_common(issue)
    issue.add_argument("--election-id", required=True)
    issue.add_argument("--voter-id-hash", required=True)
    issue.add_argument("--voter-address")
    issue.add_argument("--force", action="store_true")
    issue.set_defaults(func=cmd_issue_credential)

    vote = sub.add_parser("cast-vote", help="publish a vote and burn exactly one voting token")
    add_common(vote)
    vote.add_argument("--election-id", required=True)
    vote.add_argument("--choice", required=True)
    vote.add_argument("--voter-address", required=True)
    vote.set_defaults(func=cmd_cast_vote)

    receipt = sub.add_parser("receipt", help="build inclusion receipt for a vote txid")
    add_common(receipt)
    receipt.add_argument("--txid", required=True)
    receipt.add_argument("--election-id")
    receipt.set_defaults(func=cmd_receipt)

    audit_cmd = sub.add_parser("audit", help="audit votes, credentials and confirmations")
    add_common(audit_cmd)
    audit_cmd.add_argument("--election-id")
    audit_cmd.add_argument("--output")
    audit_cmd.set_defaults(func=cmd_audit)

    status = sub.add_parser("status", help="print chain status, streams, assets, filters and peers")
    add_common(status)
    status.set_defaults(func=cmd_status)

    grant = sub.add_parser("grant-address", help="grant permissions to a blockchain address")
    add_common(grant)
    grant.add_argument("--address", required=True)
    grant.add_argument("--permissions", default="connect,send,receive")
    grant.add_argument("--stream-write")
    grant.set_defaults(func=cmd_grant_address)

    slave = sub.add_parser("authorize-slave", help="authorize the pending slave node from its logs")
    add_common(slave)
    slave.set_defaults(func=cmd_authorize_slave)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        args.func(args)
        return 0
    except VotifyError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
