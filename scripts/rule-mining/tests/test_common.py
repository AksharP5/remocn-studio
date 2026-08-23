from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


RULE_MINING = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RULE_MINING))

from common import RuleMiningError, atomic_write_json, selected_entries, sha256_file
from fetch import download_command, iso_date


class CommonTest(unittest.TestCase):
    def test_atomic_json_is_complete_and_hashable(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "nested" / "value.json"
            atomic_write_json(path, {"answer": 42})
            self.assertEqual(json.loads(path.read_text()), {"answer": 42})
            self.assertEqual(len(sha256_file(path)), 64)
            self.assertEqual(list(path.parent.glob(".value.json.*")), [])

    def test_selection_preserves_requested_order(self) -> None:
        manifest = {"entries": [{"id": "a"}, {"id": "b"}]}
        self.assertEqual(
            [entry["id"] for entry in selected_entries(manifest, ["b", "a"])],
            ["b", "a"],
        )

    def test_unknown_selection_is_actionable(self) -> None:
        with self.assertRaisesRegex(RuleMiningError, "unknown corpus id.*missing"):
            selected_entries({"entries": []}, ["missing"])


class FetchCommandTest(unittest.TestCase):
    def entry(self) -> dict[str, object]:
        return {
            "id": "launch",
            "sourceUrl": "https://www.youtube.com/watch?v=abc",
            "sourceId": "abc",
        }

    def test_download_never_supplies_cookies_or_credentials(self) -> None:
        command = download_command(self.entry(), Path("launch.%(ext)s"))
        flattened = " ".join(command)
        self.assertNotIn("cookie", flattened)
        self.assertNotIn("username", flattened)
        self.assertIn("--no-playlist", command)

    def test_segment_becomes_an_explicit_download_section(self) -> None:
        entry = self.entry()
        entry["segment"] = {"startSeconds": 4, "endSeconds": 20}
        command = download_command(entry, Path("launch.%(ext)s"))
        index = command.index("--download-sections")
        self.assertEqual(command[index + 1], "*4-20")

    def test_downloader_date_is_normalized(self) -> None:
        self.assertEqual(iso_date("20260823"), "2026-08-23")
        self.assertIsNone(iso_date("unknown"))


if __name__ == "__main__":
    unittest.main()
