"""Import café/bakery data from a Google Maps scraper Excel export.

A second data source alongside src/ingest.py: instead of calling the
Places API, take an .xlsx export (one row per place — columns like
place_id, name, rating, reviews, link, query…) and convert each row
into the exact raw-JSON payload shape ingest.py produces. Everything
downstream (load.py → sentiment.py → analyse.py → export.py) then works
unchanged, and load.py's place_id dedup applies across both sources.

What the importer does per row:
  * area        — parsed from the `query` column ("patisseries in
                  antelias, beirut, lebanon" → "Antelias"), or forced
                  with --area
  * lat/lng     — extracted from the Google Maps `link` URL
                  (the !3d<lat>!4d<lng> segment)
  * rating      — kept, but nulled when the place has 0 reviews
                  (scrapers emit rating=0.0 for unrated places, which
                  would poison area averages)
  * 24/7 places — `workday_timing` mentioning "24" becomes Google's
                  single open-period-without-close signal, which
                  load.py already understands
  * extras      — phone, website, address, categories, review keywords
                  are preserved under details["source_extras"] so no
                  scraped data is lost, even though the current schema
                  doesn't load them

Note: these exports carry review *counts* but no review texts, so the
reviews table gets no rows from this source and sentiment charts stay
empty unless combined with API data.

The original workbook is archived to data/imports/ (gitignored).

Run:  python src/import_excel.py path/to/export.xlsx [--area "Hamra"]
"""

from __future__ import annotations

import argparse
import logging
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import json

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
IMPORTS_DIR = PROJECT_ROOT / "data" / "imports"

REQUIRED_COLUMNS = {"place_id", "name", "rating", "reviews", "link", "query"}

# Extra scraped fields worth preserving inside the raw payload.
EXTRA_COLUMNS = [
    "description", "website", "phone", "main_category", "categories",
    "address", "review_keywords", "is_temporarily_closed",
]

_LATLNG = re.compile(r"!3d(-?[\d.]+)!4d(-?[\d.]+)")
_QUERY_AREA = re.compile(r"\bin\s+([^,]+)", re.IGNORECASE)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("import_excel")


def _safe_slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", value)


def parse_area(query: str | None) -> str | None:
    """'patisseries in jal el dib, beirut, lebanon' -> 'Jal El Dib'."""
    if not query or not isinstance(query, str):
        return None
    match = _QUERY_AREA.search(query)
    return match.group(1).strip().title() if match else None


def parse_latlng(link: str | None) -> tuple[float | None, float | None]:
    if not link or not isinstance(link, str):
        return None, None
    match = _LATLNG.search(link)
    if not match:
        return None, None
    return float(match.group(1)), float(match.group(2))


def _value(row: pd.Series, column: str):
    """A cell value with NaN normalised to None."""
    if column not in row or pd.isna(row[column]):
        return None
    return row[column]


def row_to_payload(row: pd.Series, area_override: str | None) -> dict | None:
    """Convert one spreadsheet row into the ingest.py raw-payload shape."""
    place_id = _value(row, "place_id")
    name = _value(row, "name")
    if not place_id or not name:
        return None

    area = area_override or parse_area(_value(row, "query")) or "Unknown"
    lat, lng = parse_latlng(_value(row, "link"))

    review_count = int(_value(row, "reviews") or 0)
    rating = _value(row, "rating")
    # rating 0.0 with no reviews means "unrated", not "terrible".
    if not review_count or not rating:
        rating = None

    details: dict = {
        "place_id": place_id,
        "name": str(name),
        "geometry": {"location": {"lat": lat, "lng": lng}},
        "rating": float(rating) if rating is not None else None,
        "user_ratings_total": review_count,
        "price_level": None,          # not present in scraper exports
        "reviews": [],                # exports carry counts, not texts
        "source_extras": {
            col: _value(row, col) for col in EXTRA_COLUMNS if _value(row, col) is not None
        },
    }

    timing = _value(row, "workday_timing")
    if timing and "24" in str(timing):
        # Google's 24/7 signal: one open period with no close.
        details["opening_hours"] = {"periods": [{"open": {"day": 0, "time": "0000"}}]}

    return {
        "area": area,
        "place_id": place_id,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "details": details,
        "source": "excel_import",
    }


def import_file(xlsx_path: Path, area_override: str | None = None) -> int:
    df = pd.read_excel(xlsx_path)
    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(
            f"{xlsx_path.name} is missing required columns: {sorted(missing)}. "
            f"Expected a Google Maps scraper export."
        )

    before = df["place_id"].notna().sum()
    df = df.drop_duplicates(subset="place_id")
    if before != len(df):
        log.info("Dropped %d duplicate place_id rows within the file", before - len(df))

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    written = skipped = 0
    areas: set[str] = set()
    for _, row in df.iterrows():
        payload = row_to_payload(row, area_override)
        if payload is None:
            skipped += 1
            continue
        areas.add(payload["area"])
        path = RAW_DIR / f"{_safe_slug(payload['area'])}_{_safe_slug(payload['place_id'])}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        written += 1

    # Archive the source workbook so imports are reproducible.
    IMPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive = IMPORTS_DIR / f"{stamp}_{_safe_slug(xlsx_path.stem)}{xlsx_path.suffix}"
    shutil.copy2(xlsx_path, archive)

    log.info(
        "Imported %d places (%d skipped) across areas: %s",
        written, skipped, ", ".join(sorted(areas)) or "none",
    )
    log.info("Source archived to %s", archive.relative_to(PROJECT_ROOT))
    log.info("Next: python src/load.py && python src/sentiment.py && python src/export.py")
    return written


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("xlsx", type=Path, help="Path to the .xlsx export")
    parser.add_argument(
        "--area",
        help="Force one area name for every row (default: parse from the 'query' column)",
    )
    args = parser.parse_args()
    if not args.xlsx.exists():
        log.error("File not found: %s", args.xlsx)
        return 1
    import_file(args.xlsx, args.area)
    return 0


if __name__ == "__main__":
    sys.exit(main())
