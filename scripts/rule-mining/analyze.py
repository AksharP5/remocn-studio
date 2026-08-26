#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import copy
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import librosa
import numpy as np

from common import (
    CORPUS,
    MANIFEST,
    RuleMiningError,
    atomic_write_json,
    command_version,
    read_json,
    require_command,
    run,
    selected_entries,
    sha256_file,
    sha256_json,
    validate_json,
)


CONFIG_PATH = Path(__file__).with_name("config.json")
VIDEOS = CORPUS / "videos"
METADATA = CORPUS / "metadata"
MEASUREMENTS = CORPUS / "measurements"


@dataclass(frozen=True)
class FrameSample:
    index: int
    seconds: float
    gray: np.ndarray
    brightness: float


@dataclass(frozen=True)
class MotionSample:
    seconds: float
    camera_pixels: float
    element_pixels: float
    confidence: float
    kind: str


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Measure product-launch rhythm and motion")
    result.add_argument("--id", action="append", default=[], help="analyse only this corpus id; repeatable")
    result.add_argument("--force", action="store_true", help="replace a compatible existing measurement")
    return result


def probe(path: Path) -> dict[str, Any]:
    completed = run(
        [
            require_command("ffprobe"),
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ],
        capture=True,
    )
    raw = json.loads(completed.stdout)
    streams = raw.get("streams", [])
    video = next((stream for stream in streams if stream.get("codec_type") == "video"), None)
    if video is None:
        raise RuleMiningError(f"{path.name}: no video stream")
    audio = next((stream for stream in streams if stream.get("codec_type") == "audio"), None)
    fps = ratio(video.get("avg_frame_rate") or video.get("r_frame_rate") or "0/1")
    duration = float(raw.get("format", {}).get("duration") or 0)
    if fps <= 0 or duration <= 0:
        raise RuleMiningError(f"{path.name}: invalid fps ({fps}) or duration ({duration})")
    return {
        "durationSeconds": round(duration, 6),
        "fps": round(fps, 6),
        "width": int(video.get("width") or 0),
        "height": int(video.get("height") or 0),
        "videoCodec": video.get("codec_name"),
        "hasAudio": audio is not None,
        "audioCodec": audio.get("codec_name") if audio else None,
        "audioSampleRate": int(audio.get("sample_rate") or 0) if audio else None,
    }


def ratio(value: str) -> float:
    numerator, _, denominator = value.partition("/")
    divisor = float(denominator or 1)
    return float(numerator) / divisor if divisor else 0


def decode_samples(path: Path, media: dict[str, Any], config: dict[str, Any]) -> list[FrameSample]:
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuleMiningError(f"{path.name}: OpenCV could not open video")
    source_fps = float(media["fps"])
    analysis_fps = min(float(config["analysisFps"]), source_fps)
    step = source_fps / analysis_fps
    next_sample = 0.0
    frame_index = 0
    samples: list[FrameSample] = []
    width = int(config["analysisWidth"])
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index + 1e-6 >= next_sample:
                height = max(2, round(frame.shape[0] * width / frame.shape[1]))
                resized = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
                gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
                samples.append(
                    FrameSample(
                        index=frame_index,
                        seconds=frame_index / source_fps,
                        gray=gray,
                        brightness=float(np.mean(gray) / 255.0),
                    )
                )
                next_sample += step
            frame_index += 1
    finally:
        capture.release()
    if len(samples) < 2:
        raise RuleMiningError(f"{path.name}: fewer than two analysis frames")
    return samples


def scene_scores(samples: list[FrameSample]) -> list[float]:
    scores = [0.0]
    for previous, current in zip(samples, samples[1:]):
        difference = cv2.absdiff(previous.gray, current.gray)
        pixel = float(np.mean(difference) / 255.0)
        previous_hist = cv2.calcHist([previous.gray], [0], None, [32], [0, 256])
        current_hist = cv2.calcHist([current.gray], [0], None, [32], [0, 256])
        correlation = cv2.compareHist(previous_hist, current_hist, cv2.HISTCMP_CORREL)
        histogram = max(0.0, min(1.0, 1.0 - float(correlation)))
        scores.append(round(pixel * 0.7 + histogram * 0.3, 6))
    return scores


def candidate_boundaries(
    scores: list[float], brightness: list[float], config: dict[str, Any]
) -> list[int]:
    cut_score = float(config["scene"]["cutScore"])
    minimum = max(1, round(float(config["scene"]["minimumSceneSeconds"]) * config["analysisFps"]))
    candidates: set[int] = set()
    for index in range(1, len(scores) - 1):
        if scores[index] >= cut_score and scores[index] >= max(scores[index - 1], scores[index + 1]):
            candidates.add(index)

    start = 1
    while start < len(brightness):
        direction = math.copysign(1, brightness[start] - brightness[start - 1]) if brightness[start] != brightness[start - 1] else 0
        end = start
        while end + 1 < len(brightness):
            delta = brightness[end + 1] - brightness[end]
            if direction == 0 or abs(delta) < 0.004 or math.copysign(1, delta) != direction:
                break
            end += 1
        if end - start + 1 >= 3 and abs(brightness[end] - brightness[start - 1]) >= 0.16:
            candidates.add((start + end) // 2)
        start = max(start + 1, end + 1)

    kept: list[int] = []
    for candidate in sorted(candidates, key=lambda index: scores[index], reverse=True):
        if all(abs(candidate - existing) >= minimum for existing in kept):
            kept.append(candidate)
    return sorted(kept)


def camera_displacement(affine: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    height, width = shape
    y, x = np.mgrid[0:height, 0:width].astype(np.float32)
    predicted_x = affine[0, 0] * x + affine[0, 1] * y + affine[0, 2]
    predicted_y = affine[1, 0] * x + affine[1, 1] * y + affine[1, 2]
    return np.dstack((predicted_x - x, predicted_y - y))


def measure_motion(previous: FrameSample, current: FrameSample, config: dict[str, Any]) -> MotionSample:
    motion_config = config["motion"]
    points = cv2.goodFeaturesToTrack(previous.gray, maxCorners=300, qualityLevel=0.01, minDistance=6)
    affine = np.array([[1, 0, 0], [0, 1, 0]], dtype=np.float32)
    confidence = 0.15
    if points is not None and len(points) >= int(motion_config["minimumTrackedPoints"]):
        tracked, status, _ = cv2.calcOpticalFlowPyrLK(previous.gray, current.gray, points, None)
        if tracked is not None and status is not None:
            mask = status.reshape(-1).astype(bool)
            source = points.reshape(-1, 2)[mask]
            target = tracked.reshape(-1, 2)[mask]
            if len(source) >= int(motion_config["minimumTrackedPoints"]):
                estimated, inliers = cv2.estimateAffinePartial2D(
                    source,
                    target,
                    method=cv2.RANSAC,
                    ransacReprojThreshold=float(motion_config["ransacReprojectionThreshold"]),
                )
                if estimated is not None:
                    affine = estimated.astype(np.float32)
                    confidence = float(np.mean(inliers)) if inliers is not None else 0.5

    dense = cv2.calcOpticalFlowFarneback(
        previous.gray,
        current.gray,
        None,
        pyr_scale=0.5,
        levels=3,
        winsize=15,
        iterations=3,
        poly_n=5,
        poly_sigma=1.2,
        flags=0,
    )
    global_flow = camera_displacement(affine, previous.gray.shape)
    camera_pixels = float(np.median(np.linalg.norm(global_flow, axis=2)))
    residual_pixels = float(np.percentile(np.linalg.norm(dense - global_flow, axis=2), 75))
    camera_active = camera_pixels >= float(motion_config["cameraPixels"])
    element_active = residual_pixels >= float(motion_config["elementPixels"])
    if camera_active and element_active:
        kind = "mixed"
    elif camera_active:
        kind = "camera"
    elif element_active:
        kind = "elements"
    else:
        kind = "static"
    return MotionSample(
        seconds=current.seconds,
        camera_pixels=round(camera_pixels, 5),
        element_pixels=round(residual_pixels, 5),
        confidence=round(max(0.0, min(1.0, confidence)), 4),
        kind=kind,
    )


def classify_transition(
    index: int,
    scores: list[float],
    brightness: list[float],
    motion: list[MotionSample],
    config: dict[str, Any],
) -> tuple[str, float]:
    radius = int(config["scene"]["fadeWindowFrames"])
    left = max(1, index - radius // 2)
    right = min(len(scores), index + radius // 2 + 1)
    window_scores = scores[left:right]
    window_brightness = brightness[max(0, left - 1) : right]
    deltas = np.diff(window_brightness)
    directed = 0.0
    if len(deltas):
        positive = float(np.mean(deltas > 0.004))
        negative = float(np.mean(deltas < -0.004))
        directed = max(positive, negative)
    brightness_span = max(window_brightness) - min(window_brightness) if window_brightness else 0
    peak = scores[index]
    neighbour_energy = sum(window_scores) - peak
    if directed >= 0.6 and brightness_span >= 0.16:
        return "fade", round(min(1.0, 0.55 + directed * 0.35), 4)
    if peak >= float(config["scene"]["cutScore"]) and neighbour_energy <= peak * 1.4:
        return "cut", round(min(1.0, 0.55 + peak), 4)
    motion_window = motion[max(0, left - 1) : min(len(motion), right)]
    active = sum(sample.kind in {"camera", "mixed"} for sample in motion_window)
    if motion_window and active / len(motion_window) >= 0.5:
        confidence = float(np.mean([sample.confidence for sample in motion_window]))
        return "motion-transition", round(confidence, 4)
    return "unknown", round(min(0.49, peak + 0.1), 4)


def detect_beats(path: Path, has_audio: bool) -> tuple[list[float], list[str]]:
    if not has_audio:
        return [], ["source has no audio track; beat alignment is unavailable"]
    with tempfile.TemporaryDirectory(prefix="remocn-beats-") as temporary:
        wav = Path(temporary) / "audio.wav"
        run(
            [
                require_command("ffmpeg"),
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(path),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "22050",
                "-y",
                str(wav),
            ]
        )
        audio, sample_rate = librosa.load(wav, sr=22050, mono=True)
    if audio.size == 0 or float(np.max(np.abs(audio))) < 1e-5:
        return [], ["audio track is silent; beat alignment is unavailable"]
    _, beat_times = librosa.beat.beat_track(y=audio, sr=sample_rate, units="time")
    beats = [round(float(value), 6) for value in np.asarray(beat_times).reshape(-1)]
    warnings = [] if beats else ["no stable musical beat was detected"]
    return beats, warnings


def nearest_beat(seconds: float, beats: list[float], fps: float) -> dict[str, Any]:
    if not beats:
        return {"nearestBeatSeconds": None, "distanceSeconds": None, "distanceFrames": None}
    beat = min(beats, key=lambda value: abs(value - seconds))
    distance = abs(beat - seconds)
    return {
        "nearestBeatSeconds": beat,
        "distanceSeconds": round(distance, 6),
        "distanceFrames": round(distance * fps, 3),
    }


def static_runs(motion: list[MotionSample], interval_seconds: float) -> list[float]:
    runs: list[float] = []
    length = 0
    for sample in motion:
        if sample.kind == "static":
            length += 1
        elif length:
            runs.append(round(length * interval_seconds, 6))
            length = 0
    if length:
        runs.append(round(length * interval_seconds, 6))
    return runs


def analyse(entry: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    path = VIDEOS / f"{entry['id']}.mp4"
    if not path.exists():
        raise RuleMiningError(f"{entry['id']}: missing {path.relative_to(CORPUS)}; run fetch.py first")
    media = probe(path)
    samples = decode_samples(path, media, config)
    scores = scene_scores(samples)
    brightness = [sample.brightness for sample in samples]
    motion = [
        measure_motion(previous, current, config)
        for previous, current in zip(samples, samples[1:])
    ]
    boundaries = candidate_boundaries(scores, brightness, config)
    cut_score = float(config["scene"]["cutScore"])
    sensitivity = {}
    for multiplier in (0.8, 1.0, 1.2):
        threshold = round(cut_score * multiplier, 4)
        alternate = copy.deepcopy(config)
        alternate["scene"]["cutScore"] = threshold
        sensitivity[f"{threshold:.4f}"] = len(
            candidate_boundaries(scores, brightness, alternate)
        )
    beats, warnings = detect_beats(path, bool(media["hasAudio"]))
    transitions = []
    for number, index in enumerate(boundaries, start=1):
        kind, confidence = classify_transition(index, scores, brightness, motion, config)
        seconds = samples[index].seconds
        transitions.append(
            {
                "id": f"T{number:03d}",
                "sampleIndex": index,
                "seconds": round(seconds, 6),
                "score": scores[index],
                "type": kind,
                "confidence": confidence,
                **nearest_beat(seconds, beats, float(media["fps"])),
            }
        )

    edges = [0.0, *[transition["seconds"] for transition in transitions], float(media["durationSeconds"])]
    scenes = [
        {
            "id": f"S{index + 1:03d}",
            "startSeconds": round(start, 6),
            "endSeconds": round(end, 6),
            "durationSeconds": round(end - start, 6),
        }
        for index, (start, end) in enumerate(zip(edges, edges[1:]))
        if end > start
    ]
    interval_seconds = 1 / float(config["analysisFps"])
    static_run_seconds = static_runs(motion, interval_seconds)
    durations: dict[str, float] = {kind: 0.0 for kind in ["static", "camera", "elements", "mixed"]}
    confidences: list[float] = []
    for sample in motion:
        durations[sample.kind] += interval_seconds
        confidences.append(sample.confidence)
    total = sum(durations.values()) or 1
    windows = {
        str(window): round(
            sum(
                transition["distanceFrames"] is not None and transition["distanceFrames"] <= window
                for transition in transitions
            )
            / len(transitions),
            4,
        )
        if transitions
        else None
        for window in config["beatWindowsFrames"]
    }
    source_sha = sha256_file(path)
    metadata_path = METADATA / f"{entry['id']}.json"
    if metadata_path.exists():
        declared = read_json(metadata_path).get("sha256")
        if declared is not None and declared != source_sha:
            raise RuleMiningError(f"{entry['id']}: video digest differs from fetch metadata")
    return {
        "schemaVersion": 1,
        "videoId": entry["id"],
        "sourceSha256": source_sha,
        "configSha256": sha256_json(config),
        "tools": {
            "python": sys.version.split()[0],
            "ffmpeg": command_version([require_command("ffmpeg"), "-version"]),
            "ffprobe": command_version([require_command("ffprobe"), "-version"]),
            "opencv": cv2.__version__,
            "numpy": np.__version__,
            "librosa": librosa.__version__,
        },
        "media": media,
        "scenes": scenes,
        "transitions": transitions,
        "motion": {
            "analysisFps": config["analysisFps"],
            "shares": {kind: round(value / total, 4) for kind, value in durations.items()},
            "medianCameraPixels": round(float(np.median([sample.camera_pixels for sample in motion])), 5),
            "medianElementPixels": round(float(np.median([sample.element_pixels for sample in motion])), 5),
            "confidence": round(float(np.mean(confidences)), 4) if confidences else 0,
            "staticRunsSeconds": static_run_seconds,
        },
        "beats": {"timesSeconds": beats, "transitionHitRateFrames": windows},
        "sensitivity": {"cutScoreBoundaryCounts": sensitivity},
        "warnings": warnings,
    }


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        manifest = read_json(MANIFEST)
        validate_json(manifest, "manifest.schema.json")
        config = read_json(CONFIG_PATH)
        entries = selected_entries(manifest, args.id)
        failures = []
        for entry in entries:
            output = MEASUREMENTS / f"{entry['id']}.json"
            if output.exists() and not args.force:
                existing = read_json(output)
                if existing.get("configSha256") == sha256_json(config):
                    print(f"{entry['id']}: compatible measurement exists")
                    continue
            try:
                result = analyse(entry, config)
                validate_json(result, "measurement.schema.json")
                atomic_write_json(output, result)
                print(f"{entry['id']}: measured {len(result['scenes'])} scenes")
            except RuleMiningError as error:
                failures.append(str(error))
                print(str(error), file=sys.stderr)
        if failures:
            raise RuleMiningError(f"{len(failures)} video(s) failed")
        return 0
    except RuleMiningError as error:
        print(f"rule-mining analyse: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
