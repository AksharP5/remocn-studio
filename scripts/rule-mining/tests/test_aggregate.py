from __future__ import annotations

import sys
import unittest
from pathlib import Path


RULE_MINING = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RULE_MINING))

from aggregate import aggregate


def measurement(id_: str, duration: float, static: float = 0.2) -> dict:
    return {
        "videoId": id_,
        "configSha256": "a" * 64,
        "scenes": [{"durationSeconds": duration}],
        "transitions": [
            {"type": "cut", "distanceFrames": 2, "distanceSeconds": 2 / 30},
        ],
        "motion": {
            "shares": {
                "static": static,
                "camera": 0.2,
                "elements": 0.4,
                "mixed": 0.2,
            },
            "confidence": 0.9,
            "staticRunsSeconds": [0.25, 0.5],
        },
        "beats": {"transitionHitRateFrames": {"2": 1.0, "3": 1.0, "4": 1.0}},
        "sensitivity": {"cutScoreBoundaryCounts": {"0.0640": 2, "0.0800": 1, "0.0960": 1}},
    }


class AggregateTest(unittest.TestCase):
    def test_five_confident_videos_produce_candidate_rules(self) -> None:
        profile = aggregate([measurement(str(index), index + 0.5) for index in range(5)], [])
        self.assertEqual(profile["statistics"]["videos"], 5)
        self.assertTrue(all(rule["status"] == "candidate" for rule in profile["rules"]))
        self.assertEqual(profile["statistics"]["scenes"]["median"], 2.5)

    def test_small_sample_is_never_promoted(self) -> None:
        profile = aggregate([measurement("only", 0.8)], [])
        self.assertTrue(all(rule["status"] == "insufficient-sample" for rule in profile["rules"]))
        self.assertEqual(profile["statistics"]["shorterThanOneSecondShare"], 1)


if __name__ == "__main__":
    unittest.main()
