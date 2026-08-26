#!/usr/bin/env python3
from __future__ import annotations

import argparse
import statistics
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np

from common import CORPUS, RuleMiningError, atomic_write_json, read_json, validate_json


MEASUREMENTS = CORPUS / "measurements"
ANNOTATIONS = CORPUS / "annotations"
PROFILE = CORPUS / "profiles" / "product-launch.json"
REPORT = CORPUS / "reports" / "product-launch.md"
MINIMUM_VIDEOS = 5


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Aggregate product-launch measurements")
    result.add_argument("--allow-small-sample", action="store_true", help="emit a draft profile below five videos")
    return result


def percentile(values: list[float], quantile: float) -> float | None:
    return round(float(np.quantile(values, quantile)), 4) if values else None


def distribution(values: list[float]) -> dict[str, Any]:
    return {
        "count": len(values),
        "median": round(statistics.median(values), 4) if values else None,
        "p25": percentile(values, 0.25),
        "p75": percentile(values, 0.75),
        "minimum": round(min(values), 4) if values else None,
        "maximum": round(max(values), 4) if values else None,
    }


def load_measurements() -> list[dict[str, Any]]:
    values = [read_json(path) for path in sorted(MEASUREMENTS.glob("*.json"))]
    for value in values:
        validate_json(value, "measurement.schema.json")
    if not values:
        raise RuleMiningError("no measurements found; run analyze.py first")
    configs = {value["configSha256"] for value in values}
    schemas = {value["schemaVersion"] for value in values}
    if len(configs) != 1 or len(schemas) != 1:
        raise RuleMiningError("measurements use incompatible schema or config versions")
    return values


def load_annotations() -> list[dict[str, Any]]:
    values = [
        read_json(path)
        for path in sorted(ANNOTATIONS.glob("*.json"))
        if path.name != "template.json"
    ]
    for value in values:
        validate_json(value, "annotation.schema.json")
    return values


def aggregate(measurements: list[dict[str, Any]], annotations: list[dict[str, Any]]) -> dict[str, Any]:
    scene_durations = [
        float(scene["durationSeconds"])
        for measurement in measurements
        for scene in measurement["scenes"]
    ]
    transitions = [
        transition
        for measurement in measurements
        for transition in measurement["transitions"]
    ]
    types = Counter(transition["type"] for transition in transitions)
    transition_total = len(transitions) or 1
    motion_kinds = ["static", "camera", "elements", "mixed"]
    motion_shares = {
        kind: round(
            statistics.mean(float(value["motion"]["shares"].get(kind, 0)) for value in measurements),
            4,
        )
        for kind in motion_kinds
    }
    static_runs = [
        float(run)
        for measurement in measurements
        for run in measurement["motion"].get("staticRunsSeconds", [])
    ]
    beat_rates: dict[str, list[float]] = {}
    for measurement in measurements:
        aligned = [
            float(transition["distanceSeconds"]) * 30
            for transition in measurement["transitions"]
            if transition.get("distanceSeconds") is not None
        ]
        for window in (2, 3, 4):
            if aligned:
                beat_rates.setdefault(str(window), []).append(
                    sum(distance <= window for distance in aligned) / len(aligned)
                )
    confidence = statistics.mean(float(value["motion"]["confidence"]) for value in measurements)
    sensitivity = {
        value["videoId"]: value.get("sensitivity", {}).get("cutScoreBoundaryCounts", {})
        for value in measurements
    }
    status = "candidate" if len(measurements) >= MINIMUM_VIDEOS and confidence >= 0.7 else "insufficient-sample"
    rules = [
        {
            "id": "product-launch-scene-duration",
            "status": status,
            "value": distribution(scene_durations),
            "evidence": [value["videoId"] for value in measurements],
        },
        {
            "id": "product-launch-short-accent-share",
            "status": status,
            "value": round(sum(value < 1 for value in scene_durations) / len(scene_durations), 4)
            if scene_durations
            else None,
            "evidence": [value["videoId"] for value in measurements],
        },
        {
            "id": "product-launch-continuous-motion-share",
            "status": status,
            "value": round(1 - motion_shares["static"], 4),
            "evidence": [value["videoId"] for value in measurements],
        },
        {
            "id": "product-launch-static-run",
            "status": status,
            "value": distribution(static_runs),
            "evidence": [value["videoId"] for value in measurements],
        },
    ]
    return {
        "schemaVersion": 1,
        "genre": "product-launch",
        "measurementIds": [value["videoId"] for value in measurements],
        "annotationIds": [value["videoId"] for value in annotations],
        "configSha256": measurements[0]["configSha256"],
        "statistics": {
            "videos": len(measurements),
            "annotatedVideos": len(annotations),
            "scenes": distribution(scene_durations),
            "shorterThanOneSecondShare": round(
                sum(value < 1 for value in scene_durations) / len(scene_durations), 4
            )
            if scene_durations
            else None,
            "transitionTypeShares": {
                kind: round(count / transition_total, 4) for kind, count in sorted(types.items())
            },
            "motionShares": motion_shares,
            "staticRuns": distribution(static_runs),
            "meanMotionConfidence": round(confidence, 4),
            "meanBeatHitRateFrames30": {
                window: round(statistics.mean(values), 4) for window, values in sorted(beat_rates.items())
            },
            "cutScoreSensitivity": sensitivity,
        },
        "rules": rules,
    }


def report(profile: dict[str, Any]) -> str:
    statistics_ = profile["statistics"]
    scene = statistics_["scenes"]
    lines = [
        "# Product-launch rhythm measurements",
        "",
        f"Corpus: **{statistics_['videos']} measured videos**, "
        f"**{statistics_['annotatedVideos']} manually annotated videos**.",
        "",
        "## Scene rhythm",
        "",
        f"Measured {scene['count']} scenes. Median duration: {scene['median']}s "
        f"(p25 {scene['p25']}s, p75 {scene['p75']}s). "
        f"Scenes shorter than 1s: {statistics_['shorterThanOneSecondShare']}.",
        "",
        "## Motion and transitions",
        "",
        f"Mean motion shares: `{statistics_['motionShares']}`.",
        f"Transition shares: `{statistics_['transitionTypeShares']}`.",
        f"Mean beat-hit rates by 30fps-equivalent window: `{statistics_['meanBeatHitRateFrames30']}`.",
        "",
        "## Candidate rules",
        "",
    ]
    for rule in profile["rules"]:
        lines.append(f"- `{rule['id']}` — **{rule['status']}** — `{rule['value']}`; evidence: {', '.join(rule['evidence'])}.")
    lines.extend(
        [
            "",
            "## Cut-threshold sensitivity",
            "",
            "Boundary counts at 0.8×, 1.0×, and 1.2× the configured cut score:",
            "",
            "```json",
            __import__("json").dumps(statistics_["cutScoreSensitivity"], indent=2, sort_keys=True),
            "```",
            "",
            "Rules remain candidates until the minimum video sample and confidence gates pass.",
            "",
        ]
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        measurements = load_measurements()
        if len(measurements) < MINIMUM_VIDEOS and not args.allow_small_sample:
            raise RuleMiningError(
                f"need at least {MINIMUM_VIDEOS} measurements; found {len(measurements)} "
                "(use --allow-small-sample only for a draft)"
            )
        profile = aggregate(measurements, load_annotations())
        validate_json(profile, "profile.schema.json")
        atomic_write_json(PROFILE, profile)
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(report(profile), encoding="utf-8")
        print(f"aggregated {len(measurements)} measurement(s) into {PROFILE.relative_to(CORPUS)}")
        return 0
    except RuleMiningError as error:
        print(f"rule-mining aggregate: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
