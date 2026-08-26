from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "reference-corpus" / "product-launch"
MANIFEST = CORPUS / "manifest.json"
SCHEMAS = CORPUS / "schemas"


class RuleMiningError(RuntimeError):
    """Expected, actionable rule-mining failure."""


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuleMiningError(f"could not read JSON {path}: {error}") from error
    if not isinstance(value, dict):
        raise RuleMiningError(f"expected a JSON object in {path}")
    return value


def validate_json(value: dict[str, Any], schema_name: str) -> None:
    schema = read_json(SCHEMAS / schema_name)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    failures = sorted(validator.iter_errors(value), key=lambda error: list(error.path))
    if not failures:
        return
    lines = []
    for failure in failures:
        location = ".".join(str(part) for part in failure.absolute_path) or "<root>"
        lines.append(f"{location}: {failure.message}")
    raise RuleMiningError("schema validation failed:\n" + "\n".join(lines))


def atomic_write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_json(value: dict[str, Any]) -> str:
    encoded = json.dumps(value, separators=(",", ":"), sort_keys=True).encode()
    return hashlib.sha256(encoded).hexdigest()


def require_command(name: str) -> str:
    executable = shutil.which(name)
    if executable is None:
        raise RuleMiningError(f"missing required command: {name}")
    return executable


def command_version(command: list[str]) -> str:
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    return completed.stdout.splitlines()[0].strip()


def run(command: list[str], *, capture: bool = False) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            command,
            check=True,
            capture_output=capture,
            text=True,
        )
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or "").strip()
        suffix = f": {detail}" if detail else ""
        raise RuleMiningError(f"command failed ({' '.join(command[:2])}){suffix}") from error


def selected_entries(manifest: dict[str, Any], ids: list[str]) -> list[dict[str, Any]]:
    entries = manifest["entries"]
    by_id = {entry["id"]: entry for entry in entries}
    missing = sorted(set(ids) - by_id.keys())
    if missing:
        raise RuleMiningError(f"unknown corpus id(s): {', '.join(missing)}")
    return [by_id[id_] for id_ in ids] if ids else list(entries)


def ensure_disk_space(path: Path, minimum_bytes: int) -> None:
    path.mkdir(parents=True, exist_ok=True)
    free = shutil.disk_usage(path).free
    if free < minimum_bytes:
        need = minimum_bytes / (1024**3)
        have = free / (1024**3)
        raise RuleMiningError(f"need at least {need:.1f} GiB free; only {have:.1f} GiB available")
