#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

from common import (
    CORPUS,
    MANIFEST,
    RuleMiningError,
    atomic_write_json,
    ensure_disk_space,
    read_json,
    require_command,
    run,
    selected_entries,
    sha256_file,
    validate_json,
)


VIDEOS = CORPUS / "videos"
METADATA = CORPUS / "metadata"
WORK = CORPUS / ".work"


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Fetch the local product-launch corpus")
    result.add_argument("--id", action="append", default=[], help="fetch only this corpus id; repeatable")
    result.add_argument("--dry-run", action="store_true", help="validate and print the plan without network access")
    result.add_argument("--force", action="store_true", help="replace an existing local source")
    return result


def download_command(entry: dict[str, Any], output_template: Path) -> list[str]:
    command = [
        require_command("yt-dlp"),
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "--format",
        "bv*[height<=1080]+ba/b[height<=1080]",
        "--merge-output-format",
        "mp4",
        "--remux-video",
        "mp4",
        "--write-info-json",
        "--output",
        str(output_template),
    ]
    segment = entry.get("segment")
    if segment is not None:
        command.extend(
            [
                "--download-sections",
                f"*{segment['startSeconds']}-{segment['endSeconds']}",
                "--force-keyframes-at-cuts",
                "--downloader-args",
                "ffmpeg_i:-loglevel error -nostats",
            ]
        )
    command.append(entry["sourceUrl"])
    return command


def normalized_metadata(
    entry: dict[str, Any], raw: dict[str, Any], video: Path, digest: str
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "videoId": entry["id"],
        "publisher": entry["publisher"],
        "title": raw.get("title") or entry["title"],
        "canonicalUrl": raw.get("webpage_url") or entry["sourceUrl"],
        "sourceId": raw.get("id") or entry["sourceId"],
        "extractor": raw.get("extractor_key") or raw.get("extractor"),
        "channel": raw.get("channel") or raw.get("uploader"),
        "publishedDate": iso_date(raw.get("upload_date")),
        "sourceDurationSeconds": raw.get("duration"),
        "segment": entry.get("segment"),
        "localFile": str(video.relative_to(CORPUS)),
        "sizeBytes": video.stat().st_size,
        "sha256": digest,
    }


def iso_date(value: Any) -> str | None:
    if not isinstance(value, str) or len(value) != 8 or not value.isdigit():
        return None
    return f"{value[:4]}-{value[4:6]}-{value[6:]}"


def find_download(folder: Path, id_: str) -> tuple[Path, Path]:
    media = [
        path
        for path in folder.glob(f"{id_}.*")
        if path.suffix not in {".json", ".part", ".ytdl"}
    ]
    info = list(folder.glob(f"{id_}*.info.json"))
    if len(media) != 1 or len(info) != 1:
        raise RuleMiningError(
            f"{id_}: expected one downloaded media file and one info JSON, got {len(media)} and {len(info)}"
        )
    return media[0], info[0]


def cached(entry: dict[str, Any]) -> bool:
    video = VIDEOS / f"{entry['id']}.mp4"
    metadata_path = METADATA / f"{entry['id']}.json"
    if not video.exists() or not metadata_path.exists():
        return False
    metadata = read_json(metadata_path)
    actual = sha256_file(video)
    expected = entry.get("sha256") or metadata.get("sha256")
    if expected != actual:
        raise RuleMiningError(
            f"{entry['id']}: cached file digest changed; use --force only after reviewing the source"
        )
    return True


def fetch(entry: dict[str, Any], *, force: bool) -> str:
    if not force and cached(entry):
        return "cached"

    with tempfile.TemporaryDirectory(prefix=f"{entry['id']}-", dir=WORK) as temporary:
        folder = Path(temporary)
        template = folder / f"{entry['id']}.%(ext)s"
        run(download_command(entry, template))
        downloaded, info = find_download(folder, entry["id"])
        raw = json.loads(info.read_text(encoding="utf-8"))
        target = VIDEOS / f"{entry['id']}.mp4"
        target.parent.mkdir(parents=True, exist_ok=True)
        staging = target.with_name(f".{target.name}.{os.getpid()}.tmp")
        shutil.move(downloaded, staging)
        digest = sha256_file(staging)
        declared = entry.get("sha256")
        if declared is not None and declared != digest:
            staging.unlink(missing_ok=True)
            raise RuleMiningError(
                f"{entry['id']}: SHA-256 mismatch, expected {declared}, received {digest}"
            )
        os.replace(staging, target)
        atomic_write_json(
            METADATA / f"{entry['id']}.json",
            normalized_metadata(entry, raw, target, digest),
        )
    return "fetched"


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        manifest = read_json(MANIFEST)
        validate_json(manifest, "manifest.schema.json")
        entries = selected_entries(manifest, args.id)
        publishers: dict[str, int] = {}
        for entry in manifest["entries"]:
            publishers[entry["publisher"]] = publishers.get(entry["publisher"], 0) + 1
        crowded = [name for name, count in publishers.items() if count > 3]
        if crowded:
            raise RuleMiningError(f"publisher cap exceeded: {', '.join(crowded)}")

        for entry in entries:
            segment = entry.get("segment")
            suffix = (
                f" [{segment['startSeconds']}s–{segment['endSeconds']}s]"
                if segment is not None
                else ""
            )
            print(f"{entry['id']}: {entry['sourceUrl']}{suffix}")
        if args.dry_run:
            print(f"validated {len(entries)} source(s); no network or files changed")
            return 0

        require_command("ffmpeg")
        require_command("ffprobe")
        require_command("yt-dlp")
        ensure_disk_space(VIDEOS, 2 * 1024**3)
        WORK.mkdir(parents=True, exist_ok=True)
        failures: list[str] = []
        for entry in entries:
            try:
                print(f"{entry['id']}: {fetch(entry, force=args.force)}")
            except RuleMiningError as error:
                failures.append(str(error))
                print(f"{entry['id']}: failed: {error}", file=sys.stderr)
        if failures:
            raise RuleMiningError(f"{len(failures)} source(s) failed")
        return 0
    except RuleMiningError as error:
        print(f"rule-mining fetch: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
