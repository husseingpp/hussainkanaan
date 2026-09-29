"""python3 -m unittest discover -s tool/ingest/tests"""

import json
import shutil
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import ingest  # noqa: E402
from normalize import normalize  # noqa: E402

FIXTURES = HERE / "fixtures" / "sources"
RECITERS = HERE / "fixtures" / "reciters.json"
NO_OVERRIDES = HERE / "fixtures" / "overrides.json"
VECTORS = HERE.parent.parent.parent / "schema" / "search_normalization_vectors.json"


class NormalizeTest(unittest.TestCase):
    def test_shared_vectors(self):
        for v in json.loads(VECTORS.read_text(encoding="utf-8"))["vectors"]:
            with self.subTest(v["why"]):
                self.assertEqual(normalize(v["in"]), v["out"])


class IngestTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.sources = self.tmp / "sources"
        shutil.copytree(FIXTURES, self.sources)
        self.out = self.tmp / "content.db"

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def build(self, *extra):
        with _capture_stderr() as out:
            code = ingest.main(["--sources", str(self.sources), "--out", str(self.out), "--no-lock",
                                "--reciters", str(RECITERS), "--overrides", str(NO_OVERRIDES), "--partial", "--allow-unreviewed-calendar", *extra])
        self.output = out.getvalue()
        return code

    def db(self):
        return sqlite3.connect(self.out)

    def edit_json(self, rel, fn):
        p = self.sources / rel
        data = json.loads(p.read_text(encoding="utf-8"))
        fn(data)
        p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    def assertBuildFails(self, *extra, contains=""):
        self.assertEqual(self.build(*extra), 1)
        self.assertIn(contains, self.output)
        self.assertFalse(self.out.exists(), "a failed build must not leave a DB behind")

    # ---- happy path

    def test_builds_fixture(self):
        self.assertEqual(self.build(), 0)
        db = self.db()
        self.assertEqual(db.execute("SELECT count(*) FROM ayahs").fetchone()[0], 11)
        self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], ingest.SCHEMA_VERSION)
        # Global ayah ids come from Tanzil's start offsets, so a partial build still uses real ids.
        self.assertEqual(db.execute("SELECT id FROM ayahs WHERE surah_id=112 AND ayah_no=1").fetchone()[0], 6222)

    def test_is_byte_reproducible(self):
        self.assertEqual(self.build(), 0)
        first = self.out.read_bytes()
        self.out.unlink()
        self.assertEqual(self.build(), 0)
        self.assertEqual(first, self.out.read_bytes())

    def test_page_juz_quarter_sajda_assignment(self):
        self.build()
        rows = dict(((s, a), (p, j, q, sj)) for s, a, p, j, q, sj in self.db().execute(
            "SELECT surah_id, ayah_no, page, juz, hizb_quarter, sajda FROM ayahs"))
        self.assertEqual(rows[(1, 4)], (1, 1, 1, None))
        self.assertEqual(rows[(1, 5)], (1, 1, 2, None))
        self.assertEqual(rows[(112, 2)], (2, 2, 3, "recommended"))
        self.assertEqual(rows[(112, 3)][0], 3)
        self.assertEqual(self.db().execute("SELECT page_start FROM surahs WHERE id=112").fetchone()[0], 2)

    def test_search_is_undiacritized_and_folded(self):
        self.build()
        hits = self.db().execute(
            "SELECT a.surah_id, a.ayah_no FROM ayahs_fts f JOIN ayahs a ON a.id = f.rowid "
            "WHERE ayahs_fts MATCH ? ORDER BY a.id", (normalize("إياك"),)).fetchall()
        self.assertEqual(hits, [(1, 5)])
        hits = self.db().execute("SELECT rowid FROM ayahs_fts WHERE ayahs_fts MATCH ?",
                                 (normalize("ٱلصَّمَدُ"),)).fetchall()
        self.assertEqual(hits, [(6223,)])

    def test_words_and_qcf_end_marker(self):
        self.build()
        db = self.db()
        n = db.execute("SELECT count(*) FROM words w JOIN ayahs a ON a.id=w.ayah_id "
                       "WHERE a.surah_id=1 AND a.ayah_no=1").fetchone()[0]
        self.assertEqual(n, 4)
        qcf = db.execute("SELECT text_qcf FROM ayahs WHERE id=1").fetchone()[0]
        self.assertEqual(len(qcf), 5, "4 word glyphs + the ayah-number medallion")
        self.assertEqual(db.execute("SELECT root FROM words WHERE ayah_id=1 AND position=2").fetchone()[0], "أ ل ه")

    def test_sync_tier_is_derived_from_data(self):
        self.build()
        rows = {r[0]: r[1:] for r in self.db().execute("SELECT slug, sync_tier, word_timed_ayahs FROM reciters")}
        self.assertEqual(rows["alafasy"], ("A", 11))
        self.assertEqual(rows["husary"], ("B", 0), "ayah spans only")
        self.assertEqual(rows["no-data"], ("B", 0), "a per-ayah file is its own ayah timing")
        self.assertEqual(rows["surah-files"], ("C", 0))

    def test_word_layout_is_imported(self):
        self.build()
        self.assertEqual(self.db().execute(
            "SELECT page, line FROM words WHERE ayah_id = 6222 AND position = 1").fetchone(), (2, 2))

    def test_calendar_multi_date_and_amaal_links(self):
        self.build()
        db = self.db()
        dates = db.execute("SELECT d.hijri_month, d.hijri_day, d.variant_label, d.is_primary FROM event_dates d "
                           "JOIN calendar_events e ON e.id=d.event_id WHERE e.slug='test-variants' "
                           "ORDER BY d.hijri_month").fetchall()
        self.assertEqual(dates, [(5, 13, "narration A", 0), (6, 3, "narration B", 1)])
        self.assertEqual(db.execute("SELECT span_days FROM event_dates d JOIN calendar_events e "
                                    "ON e.id=d.event_id WHERE e.slug='test-range'").fetchone()[0], 10)
        self.assertEqual(db.execute("SELECT surah_id, ayah_from, ayah_to FROM event_amaal_ayahs").fetchall(),
                         [(112, 1, 4)])
        self.assertEqual(dict(db.execute("SELECT key, value FROM meta"))["calendar_reviewed"], "0")

    # ---- the build refuses bad data

    def test_strict_mode_requires_the_whole_mushaf(self):
        with _capture_stderr() as err:
            code = ingest.main(["--sources", str(self.sources), "--out", str(self.out), "--no-lock",
                                "--reciters", str(RECITERS), "--overrides", str(NO_OVERRIDES), "--allow-unreviewed-calendar"])
        self.assertEqual(code, 1)
        self.assertIn("expected 114 surahs", err.getvalue())

    def test_missing_ayah_text_fails(self):
        p = self.sources / "tanzil" / "quran-simple-clean.txt"
        p.write_text("\n".join(l for l in p.read_text(encoding="utf-8").splitlines() if not l.startswith("112|3|")),
                     encoding="utf-8")
        self.assertBuildFails(contains="simple-clean text: 1 ayahs missing")

    def test_word_gap_fails(self):
        self.edit_json("qul/words-uthmani.json", lambda d: d.pop("1:7:3"))
        self.assertBuildFails(contains="words for 1:7")

    def test_overlapping_word_segments_fail(self):
        self.edit_json("segments/alafasy.json", lambda d: d["1:2"].__setitem__(1, [2, 100, 900]))
        self.assertBuildFails(contains="starts before word 1 ends")

    def test_dropped_ayahs_lower_the_tier_below_coverage_threshold(self):
        # 10/11 word-timed is under 98%: the reciter can't promise word highlight.
        self.edit_json("segments/alafasy.json", lambda d: d.pop("112:4"))
        self.assertEqual(self.build(), 0)
        self.assertEqual(self.db().execute(
            "SELECT sync_tier, word_timed_ayahs FROM reciters WHERE slug='alafasy'").fetchone(), ("B", 10))

    def test_sajda_override_moves_the_sajda(self):
        ov = self.tmp / "overrides.json"
        ov.write_text(json.dumps({"sajdas": [
            {"from": "112:2", "to": "112:3", "type": "obligatory", "reason": "test"}]}), encoding="utf-8")
        self.assertEqual(self.build("--overrides", str(ov)), 0)
        self.assertEqual(self.db().execute(
            "SELECT surah_id, ayah_no, sajda FROM ayahs WHERE sajda IS NOT NULL").fetchall(), [(112, 3, "obligatory")])

    def test_sajda_override_fails_when_upstream_moved(self):
        ov = self.tmp / "overrides.json"
        ov.write_text(json.dumps({"sajdas": [
            {"from": "112:4", "to": "112:3", "type": "obligatory", "reason": "test"}]}), encoding="utf-8")
        self.assertBuildFails("--overrides", str(ov), contains="no sajda at 112:4")

    def test_half_timed_ayah_fails(self):
        self.edit_json("segments/alafasy.json", lambda d: d.__setitem__("1:7", d["1:7"][:-1]))
        self.assertBuildFails(contains="word timings cover 8/9 words")

    def test_bismillah_glued_to_ayah_one_fails(self):
        p = self.sources / "tanzil" / "quran-uthmani.xml"
        p.write_text(p.read_text(encoding="utf-8").replace(
            'text="قُلْ هُوَ', 'text="بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ قُلْ هُوَ'), encoding="utf-8")
        self.assertBuildFails(contains="bismillah inside ayah 1 of surahs [112]")

    def test_unknown_reciter_segments_fail(self):
        shutil.copy(self.sources / "segments" / "husary.json", self.sources / "segments" / "nobody.json")
        self.assertBuildFails(contains="no reciter 'nobody'")

    def test_unreviewed_calendar_needs_explicit_flag(self):
        with _capture_stderr() as err:
            code = ingest.main(["--sources", str(self.sources), "--out", str(self.out), "--no-lock",
                                "--reciters", str(RECITERS), "--overrides", str(NO_OVERRIDES), "--partial"])
        self.assertEqual(code, 1)
        self.assertIn("not marked reviewed", err.getvalue())

    def test_multi_date_event_needs_variant_labels(self):
        self.edit_json("calendar/events.json", lambda d: d["events"][1]["dates"][0].pop("variant"))
        self.assertBuildFails(contains="variant label")

    def test_amaal_range_must_exist(self):
        self.edit_json("calendar/events.json",
                       lambda d: d["events"][0]["amaal"][0]["ayahs"][0].__setitem__("to", 9))
        self.assertBuildFails(contains="bad ayah range")

    def test_lock_detects_changed_source(self):
        lock = self.tmp / "sources.lock.json"
        base = ["--sources", str(self.sources), "--out", str(self.out), "--lock", str(lock),
                "--reciters", str(RECITERS), "--overrides", str(NO_OVERRIDES), "--partial", "--allow-unreviewed-calendar"]
        with _capture_stderr():
            self.assertEqual(ingest.main(base + ["--update-lock"]), 0)
        with _capture_stderr():
            self.assertEqual(ingest.main(base), 0)
        self.out.unlink()
        self.edit_json("qul/words-root.json", lambda d: d.__setitem__("1:2:1", "ح م د"))
        with _capture_stderr() as err:
            self.assertEqual(ingest.main(base), 1)
        self.assertIn("qul/words-root.json", err.getvalue())


class _capture_stderr:
    """Collect stderr/stdout so failing-build tests stay quiet."""

    def __enter__(self):
        import io
        self._old = sys.stderr, sys.stdout
        self._buf = io.StringIO()
        sys.stderr = sys.stdout = self._buf
        return self._buf

    def __exit__(self, *exc):
        sys.stderr, sys.stdout = self._old


if __name__ == "__main__":
    unittest.main()
