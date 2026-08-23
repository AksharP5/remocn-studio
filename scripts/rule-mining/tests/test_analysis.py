from __future__ import annotations

import sys
import subprocess
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np


RULE_MINING = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RULE_MINING))

import analyze
from analyze import (
    FrameSample,
    candidate_boundaries,
    classify_transition,
    measure_motion,
    nearest_beat,
    static_runs,
)
from common import read_json


CONFIG = read_json(RULE_MINING / "config.json")


class SceneAnalysisTest(unittest.TestCase):
    def test_isolated_large_change_is_a_cut(self) -> None:
        scores = [0.0, 0.01, 0.02, 0.72, 0.02, 0.01]
        brightness = [0.2, 0.2, 0.21, 0.7, 0.7, 0.7]
        boundaries = candidate_boundaries(scores, brightness, CONFIG)
        self.assertEqual(boundaries, [3])
        kind, confidence = classify_transition(3, scores, brightness, [], CONFIG)
        self.assertEqual(kind, "cut")
        self.assertGreaterEqual(confidence, 0.7)

    def test_sustained_brightness_ramp_is_a_fade_candidate(self) -> None:
        brightness = [0.1, 0.12, 0.18, 0.27, 0.38, 0.5, 0.51]
        scores = [0.0, 0.03, 0.04, 0.05, 0.05, 0.04, 0.01]
        boundaries = candidate_boundaries(scores, brightness, CONFIG)
        self.assertEqual(len(boundaries), 1)
        kind, _ = classify_transition(boundaries[0], scores, brightness, [], CONFIG)
        self.assertEqual(kind, "fade")

    def test_nearest_beat_reports_seconds_and_source_frames(self) -> None:
        result = nearest_beat(1.1, [0.5, 1.0, 1.5], 30)
        self.assertEqual(result["nearestBeatSeconds"], 1.0)
        self.assertAlmostEqual(result["distanceFrames"], 3)

    def test_static_runs_keep_only_consecutive_static_intervals(self) -> None:
        samples = [
            analyze.MotionSample(index, 0, 0, 1, kind)
            for index, kind in enumerate(["static", "static", "camera", "static"])
        ]
        self.assertEqual(static_runs(samples, 0.1), [0.2, 0.1])


class MotionAnalysisTest(unittest.TestCase):
    def textured(self) -> np.ndarray:
        image = np.zeros((160, 240), dtype=np.uint8)
        for y in range(10, 160, 20):
            for x in range(10, 240, 20):
                cv2.circle(image, (x, y), 3, 255 if (x + y) % 40 else 130, -1)
        return image

    def sample(self, index: int, image: np.ndarray) -> FrameSample:
        return FrameSample(index=index, seconds=index / 12, gray=image, brightness=float(np.mean(image) / 255))

    def test_global_translation_is_camera_motion(self) -> None:
        first = self.textured()
        matrix = np.float32([[1, 0, 4], [0, 1, 0]])
        second = cv2.warpAffine(first, matrix, (first.shape[1], first.shape[0]))
        result = measure_motion(self.sample(0, first), self.sample(1, second), CONFIG)
        self.assertIn(result.kind, {"camera", "mixed"})
        self.assertGreater(result.camera_pixels, 2)

    def test_identical_frames_are_static(self) -> None:
        image = self.textured()
        result = measure_motion(self.sample(0, image), self.sample(1, image.copy()), CONFIG)
        self.assertEqual(result.kind, "static")
        self.assertLess(result.element_pixels, 0.1)


class EndToEndAnalysisTest(unittest.TestCase):
    def test_synthetic_video_produces_a_valid_measurement(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            videos = root / "videos"
            metadata = root / "metadata"
            videos.mkdir()
            metadata.mkdir()
            video = videos / "synthetic-launch.mp4"
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    "testsrc2=size=320x180:rate=30:duration=2",
                    "-f",
                    "lavfi",
                    "-i",
                    "color=c=0x2458ff:size=320x180:rate=30:duration=2",
                    "-f",
                    "lavfi",
                    "-i",
                    "color=c=black:size=320x180:rate=30:duration=2",
                    "-f",
                    "lavfi",
                    "-i",
                    "sine=frequency=440:sample_rate=22050:duration=6",
                    "-filter_complex",
                    "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]",
                    "-map",
                    "[v]",
                    "-map",
                    "3:a",
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-c:a",
                    "aac",
                    "-shortest",
                    "-y",
                    str(video),
                ],
                check=True,
            )
            entry = {"id": "synthetic-launch"}
            with patch.object(analyze, "VIDEOS", videos), patch.object(
                analyze, "METADATA", metadata
            ):
                result = analyze.analyse(entry, CONFIG)
            self.assertEqual(result["schemaVersion"], 1)
            self.assertEqual(result["videoId"], "synthetic-launch")
            self.assertGreaterEqual(len(result["scenes"]), 2)
            self.assertAlmostEqual(result["media"]["durationSeconds"], 6, delta=0.2)
            self.assertAlmostEqual(sum(result["motion"]["shares"].values()), 1, delta=0.001)


if __name__ == "__main__":
    unittest.main()
