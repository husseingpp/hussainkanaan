-- Content DB: bundled with the app, built by tool/ingest, read-only at runtime.
--
-- Everything in here is replaceable: a new content pack swaps the whole file.
-- User data never lives here — see user.sql. Bump `schema_version` in
-- tool/ingest/ingest.py and lib/data/content_db.dart together on any change.

PRAGMA foreign_keys = ON;

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

-- ---------------------------------------------------------------- Quran core

CREATE TABLE surahs (
  id                INTEGER PRIMARY KEY,                -- 1..114
  name_ar           TEXT    NOT NULL,
  name_en           TEXT    NOT NULL,                   -- "The Opening"
  name_translit     TEXT    NOT NULL,                   -- "Al-Faatiha"
  revelation_type   TEXT    NOT NULL CHECK (revelation_type IN ('meccan', 'medinan')),
  revelation_order  INTEGER NOT NULL,
  ayah_count        INTEGER NOT NULL,
  page_start        INTEGER NOT NULL
);

CREATE TABLE ayahs (
  id            INTEGER PRIMARY KEY,                    -- global 1..6236
  surah_id      INTEGER NOT NULL REFERENCES surahs (id),
  ayah_no       INTEGER NOT NULL,
  text_uthmani  TEXT    NOT NULL,
  -- Diacritics stripped, alef/hamza/ya forms folded. Computed at ingest,
  -- never at query time. Queries go through the same fold (normalize.py /
  -- lib/core/arabic_normalizer.dart, pinned by shared test vectors).
  search_text   TEXT    NOT NULL,
  text_qcf      TEXT,                                   -- QCF v1 glyphs incl. end marker
  page          INTEGER NOT NULL,                       -- Madani page of the ayah's first word
  juz           INTEGER NOT NULL,
  hizb_quarter  INTEGER NOT NULL,                       -- 1..240
  sajda         TEXT    CHECK (sajda IN ('recommended', 'obligatory')),
  -- Where the end-of-ayah medallion sits in the v1 mus'haf (Page View).
  end_page      INTEGER,
  end_line      INTEGER,
  UNIQUE (surah_id, ayah_no)
);
CREATE INDEX ayahs_page ON ayahs (page);
CREATE INDEX ayahs_juz ON ayahs (juz);

CREATE VIRTUAL TABLE ayahs_fts USING fts5 (
  search_text,
  content = 'ayahs',
  content_rowid = 'id',
  tokenize = 'unicode61 remove_diacritics 0'
);

CREATE TABLE words (
  id              INTEGER PRIMARY KEY,
  ayah_id         INTEGER NOT NULL REFERENCES ayahs (id),
  position        INTEGER NOT NULL,                     -- 1-based, matches ayah_timings.word_position
  text_uthmani    TEXT    NOT NULL,
  text_qcf        TEXT,
  translation_en  TEXT,
  root            TEXT,
  -- Page View layout. Filled in Phase 1 from the QUL mushaf layout; an ayah
  -- can straddle a page boundary, so this is per word, not per ayah.
  page            INTEGER,
  line            INTEGER,
  UNIQUE (ayah_id, position)
);

-- Every line of every page of the v1 (1405H Madani) mus'haf: which lines hold
-- ayat and which hold a surah title or the bismillah. Derived and checked by
-- the ingest, so Page View never has to guess at gaps.
CREATE TABLE page_lines (
  page      INTEGER NOT NULL,
  line      INTEGER NOT NULL,
  kind      TEXT    NOT NULL CHECK (kind IN ('ayat', 'surah_name', 'bismillah')),
  surah_id  INTEGER REFERENCES surahs (id),              -- set for surah_name / bismillah
  PRIMARY KEY (page, line)
) WITHOUT ROWID;

CREATE TABLE reciters (
  id         INTEGER PRIMARY KEY,
  slug       TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  name_ar    TEXT,
  style      TEXT    NOT NULL,                          -- murattal | mujawwad | muallim
  bitrate    INTEGER,                                   -- kbps, when the source states it
  base_url   TEXT    NOT NULL,                          -- per_ayah: {base_url}/{SSS}{AAA}.mp3
  audio      TEXT    NOT NULL CHECK (audio IN ('per_ayah', 'per_surah')),
  -- Derived by the ingest from the data, never hand-set (BLUEPRINT §4):
  --   A  word timing for >= 98% of ayahs; the rest highlight the whole ayah
  --   B  whole-ayah highlight only (per-ayah audio, or ayah spans)
  --   C  audio only
  -- Follow Mode promises exactly what this column says.
  sync_tier  TEXT    NOT NULL CHECK (sync_tier IN ('A', 'B', 'C')),
  word_timed_ayahs INTEGER NOT NULL DEFAULT 0
);

-- Times are relative to the start of that ayah's own audio file.
-- word_position 0 is the whole-ayah span; 1..n are words. An ayah is either
-- fully word-timed or absent/span-only, never half-timed.
CREATE TABLE ayah_timings (
  reciter_id     INTEGER NOT NULL REFERENCES reciters (id),
  ayah_id        INTEGER NOT NULL REFERENCES ayahs (id),
  word_position  INTEGER NOT NULL,
  start_ms       INTEGER NOT NULL,
  end_ms         INTEGER NOT NULL CHECK (end_ms > start_ms),
  PRIMARY KEY (reciter_id, ayah_id, word_position)
) WITHOUT ROWID;

-- One translation is bundled; more (and all tafsirs) arrive as versioned
-- content packs in Phase 4, each its own attached SQLite file.
CREATE TABLE translations (
  id        INTEGER PRIMARY KEY,
  slug      TEXT NOT NULL UNIQUE,                       -- tanzil id, e.g. "en.sahih"
  language  TEXT NOT NULL,
  name      TEXT NOT NULL,
  source    TEXT NOT NULL                               -- provenance + license note
);

CREATE TABLE translation_ayahs (
  translation_id  INTEGER NOT NULL REFERENCES translations (id),
  ayah_id         INTEGER NOT NULL REFERENCES ayahs (id),
  text            TEXT    NOT NULL,
  PRIMARY KEY (translation_id, ayah_id)
) WITHOUT ROWID;

-- ---------------------------------------------------------------- Calendar
-- Also a versioned pack (BLUEPRINT §9): the dataset must be compiled from a
-- scholarly source and reviewed before release. The ingest refuses a pack
-- that isn't marked reviewed unless --allow-unreviewed-calendar is passed.

CREATE TABLE calendar_events (
  id                 INTEGER PRIMARY KEY,
  slug               TEXT    NOT NULL UNIQUE,
  name_ar            TEXT    NOT NULL,
  name_en            TEXT    NOT NULL,
  category           TEXT    NOT NULL CHECK (category IN
                       ('mourning', 'birth', 'martyrdom', 'eid', 'blessed_night', 'fast', 'other')),
  importance         INTEGER NOT NULL CHECK (importance BETWEEN 1 AND 3),
  significance_text  TEXT,
  -- Ramadan start, Fitr, Adha: shown with "subject to local sighting".
  sighting_dependent INTEGER NOT NULL DEFAULT 0 CHECK (sighting_dependent IN (0, 1))
);

-- An event can have several dates (differing narrations / traditions), and a
-- date can be a range (Muharram 1–10), so dates are rows, not columns.
CREATE TABLE event_dates (
  id             INTEGER PRIMARY KEY,
  event_id       INTEGER NOT NULL REFERENCES calendar_events (id),
  hijri_month    INTEGER NOT NULL CHECK (hijri_month BETWEEN 1 AND 12),
  hijri_day      INTEGER NOT NULL CHECK (hijri_day BETWEEN 1 AND 30),
  span_days      INTEGER NOT NULL DEFAULT 1 CHECK (span_days >= 1),
  variant_label  TEXT,
  is_primary     INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1))
);
CREATE INDEX event_dates_md ON event_dates (hijri_month, hijri_day);

CREATE TABLE event_amaal (
  id           INTEGER PRIMARY KEY,
  event_id     INTEGER NOT NULL REFERENCES calendar_events (id),
  kind         TEXT    NOT NULL,                        -- recitation | dua | ziyara | prayer | fast | other
  title_ar     TEXT    NOT NULL,
  body_ar      TEXT,
  source_note  TEXT    NOT NULL
);

-- Links an a'maal to Quran ranges so the calendar can build a reader
-- position or a Listen Mode queue directly.
CREATE TABLE event_amaal_ayahs (
  amaal_id   INTEGER NOT NULL REFERENCES event_amaal (id),
  surah_id   INTEGER NOT NULL REFERENCES surahs (id),
  ayah_from  INTEGER NOT NULL,
  ayah_to    INTEGER NOT NULL CHECK (ayah_to >= ayah_from),
  PRIMARY KEY (amaal_id, surah_id, ayah_from)
) WITHOUT ROWID;
