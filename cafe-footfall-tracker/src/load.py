"""Load raw Google Places JSON dumps into PostgreSQL.

Reads every data/raw/*.json produced by src/ingest.py, deduplicates on
place_id, detects review language with langdetect, converts Google's
opening-hours periods into per-day rows, and bulk-inserts everything
via SQLAlchemy Core (one executemany per table — not row-by-row).

Re-running is safe: places already in the cafes table are skipped
entirely, so reviews and hours are never duplicated.

Run:  python src/load.py
"""

from __future__ import annotations

import json
import logging
import sys
import uuid
from datetime import datetime, time as dtime, timezone

from langdetect import DetectorFactory, detect
from langdetect.lang_detect_exception import LangDetectException
from sqlalchemy import insert, select

from db import PROJECT_ROOT, cafes, get_engine, opening_hours, reviews

RAW_DIR = PROJECT_ROOT / "data" / "raw"

# langdetect is non-deterministic by default; seed it for reproducible runs.
DetectorFactory.seed = 0

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("load")


def read_raw_files() -> list[dict]:
    """Load every raw JSON dump, deduplicated on place_id (first file wins)."""
    seen: dict[str, dict] = {}
    files = sorted(RAW_DIR.glob("*.json"))
    if not files:
        log.warning("No JSON files in %s — run src/ingest.py first.", RAW_DIR)
    for path in files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            log.error("Skipping unreadable file %s: %s", path.name, exc)
            continue
        place_id = payload.get("place_id") or payload.get("details", {}).get("place_id")
        if not place_id:
            log.error("Skipping %s: no place_id", path.name)
            continue
        if place_id in seen:
            log.info("Duplicate place_id %s in %s — skipped", place_id, path.name)
            continue
        seen[place_id] = payload
    log.info("Read %d files, %d unique place_ids", len(files), len(seen))
    return list(seen.values())


def detect_language(text: str | None, api_language: str | None) -> str | None:
    """Detect a review's language, falling back to Google's own field."""
    if text and text.strip():
        try:
            return detect(text)
        except LangDetectException:
            pass
    return api_language


def _parse_hhmm(value: str) -> dtime:
    return dtime(hour=int(value[:2]), minute=int(value[2:4]))


def _google_day_to_iso(google_day: int) -> int:
    """Google uses 0=Sunday…6=Saturday; our schema uses 0=Monday…6=Sunday."""
    return (google_day + 6) % 7


def build_hour_rows(cafe_id: uuid.UUID, opening: dict | None) -> list[dict]:
    """Flatten Google's opening_hours.periods into per-day table rows."""
    if not opening:
        return []
    periods = opening.get("periods") or []

    # A single period with open day/time 0/"0000" and no close means 24/7.
    if len(periods) == 1 and "close" not in periods[0]:
        open_info = periods[0].get("open", {})
        if open_info.get("time") == "0000":
            return [
                {
                    "cafe_id": cafe_id,
                    "day_of_week": day,
                    "open_time": dtime(0, 0),
                    "close_time": None,
                    "is_open_24h": True,
                }
                for day in range(7)
            ]

    rows = []
    for period in periods:
        open_info = period.get("open")
        if not open_info or "time" not in open_info:
            continue
        close_info = period.get("close") or {}
        # Overnight closings keep close_time < open_time on the same row;
        # the SQL in sql/peak_hours.sql handles the wraparound.
        rows.append(
            {
                "cafe_id": cafe_id,
                "day_of_week": _google_day_to_iso(open_info.get("day", 0)),
                "open_time": _parse_hhmm(open_info["time"]),
                "close_time": _parse_hhmm(close_info["time"]) if close_info.get("time") else None,
                "is_open_24h": False,
            }
        )
    return rows


def build_review_rows(cafe_id: uuid.UUID, raw_reviews: list[dict]) -> list[dict]:
    rows = []
    for rv in raw_reviews:
        text = rv.get("text") or ""
        posted = rv.get("time")  # unix seconds
        rows.append(
            {
                "cafe_id": cafe_id,
                "rating": rv.get("rating"),
                "text": text,
                "language": detect_language(text, rv.get("language")),
                "time_posted": (
                    datetime.fromtimestamp(posted, tz=timezone.utc) if posted else None
                ),
                # sentiment_score / sentiment_label stay NULL here;
                # src/sentiment.py fills them in.
            }
        )
    return rows


def main() -> int:
    payloads = read_raw_files()
    if not payloads:
        return 1

    engine = get_engine()
    with engine.begin() as conn:
        existing = {row[0] for row in conn.execute(select(cafes.c.place_id))}
        if existing:
            log.info("%d places already loaded — they will be skipped", len(existing))

        cafe_rows: list[dict] = []
        hour_rows: list[dict] = []
        review_rows: list[dict] = []

        for payload in payloads:
            place_id = payload.get("place_id") or payload["details"].get("place_id")
            if place_id in existing:
                continue
            details = payload.get("details", {})
            cafe_id = uuid.uuid4()
            location = (details.get("geometry") or {}).get("location") or {}

            cafe_rows.append(
                {
                    "cafe_id": cafe_id,
                    "name": details.get("name", "Unknown"),
                    "area": payload.get("area", "Unknown"),
                    "lat": location.get("lat"),
                    "lng": location.get("lng"),
                    "price_level": details.get("price_level"),
                    "rating": details.get("rating"),
                    "total_reviews": details.get("user_ratings_total"),
                    "place_id": place_id,
                    "fetched_at": payload.get("fetched_at")
                    or datetime.now(timezone.utc).isoformat(),
                }
            )
            hour_rows.extend(build_hour_rows(cafe_id, details.get("opening_hours")))
            review_rows.extend(build_review_rows(cafe_id, details.get("reviews") or []))

        if not cafe_rows:
            log.info("Nothing new to load.")
            return 0

        # Bulk inserts: one executemany per table.
        conn.execute(insert(cafes), cafe_rows)
        if hour_rows:
            conn.execute(insert(opening_hours), hour_rows)
        if review_rows:
            conn.execute(insert(reviews), review_rows)

    log.info(
        "Loaded %d cafés, %d opening-hour rows, %d reviews",
        len(cafe_rows),
        len(hour_rows),
        len(review_rows),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
