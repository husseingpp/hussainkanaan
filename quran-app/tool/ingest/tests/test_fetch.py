"""Offline tests for the pure parts of fetch_sources.py."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fetch_sources import audio_base, clean_segments  # noqa: E402


class CleanSegmentsTest(unittest.TestCase):
    def test_keeps_clean_ayahs_and_drops_defective_ones_whole(self):
        counts = {"1:1": 2, "1:2": 2, "1:3": 2, "1:4": 2, "1:5": 2, "1:6": 2}
        raw = {
            "1:1": {"segments": [[0, 1, 0, 500], [1, 2, 510, 900]]},
            "1:2": {"segments": [["0", "1", "0", "500"], ["1", "2", "510", "900"]]},  # strings upstream
            "1:3": {"segments": [[0, 1, 0, 500], [1, 3, 510, 900]]},                  # word 3 of 2
            "1:4": {"segments": [[0, 1, 0, 500], [1, 2, 700, 700]]},                  # zero-length
            "1:5": {"segments": [[0, 1, 0, 600], [1, 2, 500, 900]]},                  # overlap
            "1:6": {"segments": []},
        }
        kept, dropped = clean_segments(raw, counts)
        self.assertEqual(kept, {"1:1": [[1, 0, 500], [2, 510, 900]], "1:2": [[1, 0, 500], [2, 510, 900]]})
        self.assertEqual(sorted(dropped), ["1:3", "1:4", "1:5", "1:6"])

    def test_audio_base_normalizes_the_everyayah_mirror(self):
        self.assertEqual(audio_base("Alafasy/mp3/001001.mp3"), "Alafasy/mp3")
        self.assertEqual(audio_base("//mirrors.quranicaudio.com/everyayah/Husary_64kbps/001001.mp3"), "Husary_64kbps")


if __name__ == "__main__":
    unittest.main()
