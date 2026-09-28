-- User DB: created on the device at first launch, never replaced by a
-- content update. Two kinds of data live here:
--
--   synced (v2)   bookmarks, notes, khatmah, preferences — the only tables a
--                 future sync may touch (BLUEPRINT §5 rule 4). Rows carry a
--                 uuid + updated_at so last-write-wins has something to use.
--   device-local  audio files, download queue, playback position, locations.
--                 Never synced.
--
-- References to Quran content use stable keys (surah/ayah numbers), not
-- content-DB row ids, so a content pack swap can't orphan user data.
-- Statements are split on ";" + newline by the app: no triggers here.

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------- synced (v2)

CREATE TABLE bookmarks (
  uuid        TEXT    PRIMARY KEY,
  surah_id    INTEGER NOT NULL,
  ayah_no     INTEGER NOT NULL,
  label       TEXT,
  color       TEXT,
  created_at  INTEGER NOT NULL,                         -- unix ms
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0                -- tombstone for sync
);

CREATE TABLE favourites (
  uuid        TEXT    PRIMARY KEY,
  surah_id    INTEGER NOT NULL,
  ayah_from   INTEGER NOT NULL,
  ayah_to     INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE notes (
  uuid        TEXT    PRIMARY KEY,
  surah_id    INTEGER NOT NULL,
  ayah_no     INTEGER NOT NULL,
  body        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);

-- Progress merges as max(progress_ayah_id), never last-write (BLUEPRINT §5).
CREATE TABLE khatmah (
  uuid              TEXT    PRIMARY KEY,
  name              TEXT    NOT NULL,
  plan_kind         TEXT    NOT NULL CHECK (plan_kind IN ('daily_amount', 'date_range')),
  daily_ayahs       INTEGER,
  start_date        TEXT    NOT NULL,                   -- ISO yyyy-mm-dd
  end_date          TEXT,
  progress_ayah_id  INTEGER NOT NULL DEFAULT 0,         -- global ayah id, 0..6236
  completed_at      INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE preferences (
  key         TEXT    PRIMARY KEY,
  value       TEXT    NOT NULL,                         -- JSON
  updated_at  INTEGER NOT NULL
);

CREATE TABLE calc_settings (
  id                        INTEGER PRIMARY KEY CHECK (id = 1),
  method_id                 TEXT    NOT NULL DEFAULT 'jafari',
  fajr_angle                REAL,
  isha_angle                REAL,
  maghrib_rule              TEXT    NOT NULL DEFAULT 'angle:4',   -- angle:<deg> | minutes:<n>
  asr_factor                INTEGER NOT NULL DEFAULT 1 CHECK (asr_factor IN (1, 2)),
  high_latitude_rule        TEXT    NOT NULL DEFAULT 'angle_based',
  per_prayer_offsets_json   TEXT    NOT NULL DEFAULT '{}',
  hijri_offset              INTEGER NOT NULL DEFAULT 0 CHECK (hijri_offset BETWEEN -2 AND 2),
  updated_at                INTEGER NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------ device-local

CREATE TABLE audio_files (
  reciter_id  INTEGER NOT NULL,
  surah_id    INTEGER NOT NULL,
  ayah_no     INTEGER NOT NULL,
  local_path  TEXT,
  bytes       INTEGER,
  state       TEXT    NOT NULL CHECK (state IN ('queued', 'downloading', 'done', 'failed')),
  PRIMARY KEY (reciter_id, surah_id, ayah_no)
);

-- Resumable: bytes_received lets dio send a Range header after a kill.
CREATE TABLE download_queue (
  id              INTEGER PRIMARY KEY,
  reciter_id      INTEGER NOT NULL,
  surah_id        INTEGER NOT NULL,
  ayah_no         INTEGER NOT NULL,
  url             TEXT    NOT NULL,
  bytes_received  INTEGER NOT NULL DEFAULT 0,
  attempts        INTEGER NOT NULL DEFAULT 0,
  enqueued_at     INTEGER NOT NULL,
  UNIQUE (reciter_id, surah_id, ayah_no)
);

-- Written every ~10s during playback so an OS kill is recoverable.
CREATE TABLE playback_state (
  mode         TEXT    PRIMARY KEY CHECK (mode IN ('listen', 'follow')),
  reciter_id   INTEGER NOT NULL,
  surah_id     INTEGER NOT NULL,
  ayah_no      INTEGER NOT NULL,
  position_ms  INTEGER NOT NULL,
  queue_json   TEXT,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE reading_position (
  view        TEXT    PRIMARY KEY CHECK (view IN ('page', 'reading')),
  page        INTEGER,
  surah_id    INTEGER,
  ayah_no     INTEGER,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE locations (
  id          INTEGER PRIMARY KEY,
  label       TEXT    NOT NULL,
  lat         REAL    NOT NULL,
  lng         REAL    NOT NULL,
  timezone    TEXT    NOT NULL,                         -- IANA
  is_current  INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1))
);
