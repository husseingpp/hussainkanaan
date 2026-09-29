import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from ttf_cmap import FontError, codepoints  # noqa: E402


class CmapTest(unittest.TestCase):
    def test_reads_the_fixture_font(self):
        cps = codepoints((HERE / "fixtures" / "sources" / "qcf-v1" / "p2.ttf").read_bytes())
        self.assertEqual(len(cps), 8)
        self.assertTrue(all(0xF100 <= c < 0xF900 for c in cps))

    def test_reads_the_bundled_amiri_font(self):
        cps = codepoints((HERE.parent.parent.parent / "assets" / "fonts" / "AmiriQuran.ttf").read_bytes())
        self.assertIn(0x0671, cps)  # alef wasla
        self.assertIn(0x06DD, cps)  # end of ayah

    def test_rejects_non_fonts(self):
        with self.assertRaises(FontError):
            codepoints(b"<html></html>")


if __name__ == "__main__":
    unittest.main()
