"""Fetch Lebanese café data from the Google Places API.

For each configured Beirut area:
  1. Places Text Search ("cafes in <area>, Beirut") -> place_ids
     (follows next_page_token pagination, max 60 results per area)
  2. Place Details for each place_id (name, geometry, rating,
     user_ratings_total, price_level, opening_hours, reviews)
  3. Raw responses saved to data/raw/{area}_{place_id}.json

Run:  python src/ingest.py
Needs GOOGLE_PLACES_API_KEY in .env. Makes real (billable) API calls.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw"

TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

DETAIL_FIELDS = ",".join(
    [
        "place_id",
        "name",
        "geometry",
        "rating",
        "user_ratings_total",
        "price_level",
        "opening_hours",
        "reviews",
    ]
)

AREAS = ["Hamra", "Achrafieh", "Gemmayzeh", "Mar Mikhael", "Verdun"]

# Free-tier Place Details returns at most a handful of reviews; cap what we
# persist so the pipeline never depends on more than 10 per place.
MAX_REVIEWS_PER_PLACE = 10

MAX_RETRIES = 5          # for 429 / OVER_QUERY_LIMIT backoff
BASE_BACKOFF_SECONDS = 2  # 2, 4, 8, 16, 32
PAGE_TOKEN_DELAY = 2.0    # Google needs ~2s before a next_page_token is valid

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("ingest")


class PlacesApiError(RuntimeError):
    """Raised for non-retryable Places API errors (bad key, bad request…)."""


def _get_with_backoff(session: requests.Session, url: str, params: dict) -> dict:
    """GET a Places endpoint, retrying with exponential backoff on rate limits.

    Retries on HTTP 429, transient network errors, and the API-level
    OVER_QUERY_LIMIT status. Raises PlacesApiError for permanent failures.
    """
    for attempt in range(MAX_RETRIES + 1):
        wait = BASE_BACKOFF_SECONDS * (2**attempt)
        try:
            resp = session.get(url, params=params, timeout=30)
        except requests.RequestException as exc:
            if attempt == MAX_RETRIES:
                raise
            log.warning("Network error (%s); retrying in %ss", exc, wait)
            time.sleep(wait)
            continue

        if resp.status_code == 429:
            if attempt == MAX_RETRIES:
                raise PlacesApiError("Rate limited (429) after all retries")
            log.warning("HTTP 429 rate limit; backing off %ss", wait)
            time.sleep(wait)
            continue
        resp.raise_for_status()

        body = resp.json()
        status = body.get("status", "")
        if status in ("OK", "ZERO_RESULTS"):
            return body
        if status == "OVER_QUERY_LIMIT":
            if attempt == MAX_RETRIES:
                raise PlacesApiError("OVER_QUERY_LIMIT after all retries")
            log.warning("OVER_QUERY_LIMIT; backing off %ss", wait)
            time.sleep(wait)
            continue
        raise PlacesApiError(
            f"Places API error: {status} — {body.get('error_message', 'no detail')}"
        )
    raise PlacesApiError("unreachable")  # pragma: no cover


def search_area(session: requests.Session, api_key: str, area: str) -> list[str]:
    """Text Search for cafés in one area; returns deduplicated place_ids."""
    place_ids: list[str] = []
    params = {"query": f"cafes in {area}, Beirut, Lebanon", "key": api_key}
    page = 1
    while True:
        body = _get_with_backoff(session, TEXT_SEARCH_URL, params)
        results = body.get("results", [])
        place_ids.extend(r["place_id"] for r in results if r.get("place_id"))
        log.info("%s: page %d returned %d results", area, page, len(results))

        token = body.get("next_page_token")
        if not token:
            break
        time.sleep(PAGE_TOKEN_DELAY)  # token is not valid immediately
        params = {"pagetoken": token, "key": api_key}
        page += 1

    # Preserve order while removing duplicates within the area.
    return list(dict.fromkeys(place_ids))


def fetch_details(session: requests.Session, api_key: str, place_id: str) -> dict | None:
    """Place Details for one place_id, trimmed to MAX_REVIEWS_PER_PLACE reviews."""
    params = {"place_id": place_id, "fields": DETAIL_FIELDS, "key": api_key}
    body = _get_with_backoff(session, DETAILS_URL, params)
    result = body.get("result")
    if not result:
        log.warning("No details returned for %s", place_id)
        return None
    if "reviews" in result:
        result["reviews"] = result["reviews"][:MAX_REVIEWS_PER_PLACE]
    return result


def _safe_slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", value)


def save_raw(area: str, place_id: str, details: dict) -> Path:
    """Write one raw API response, wrapped with ingest metadata."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"{_safe_slug(area)}_{_safe_slug(place_id)}.json"
    payload = {
        "area": area,
        "place_id": place_id,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "details": details,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def main() -> int:
    load_dotenv(PROJECT_ROOT / ".env")
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key or api_key == "your_key_here":
        log.error("GOOGLE_PLACES_API_KEY missing. Copy .env.example to .env first.")
        return 1

    session = requests.Session()
    total_saved = 0
    for area in AREAS:
        log.info("=== Searching area: %s ===", area)
        try:
            place_ids = search_area(session, api_key, area)
        except PlacesApiError as exc:
            log.error("Search failed for %s: %s", area, exc)
            continue
        log.info("%s: %d unique places found", area, len(place_ids))

        for place_id in place_ids:
            try:
                details = fetch_details(session, api_key, place_id)
            except PlacesApiError as exc:
                log.error("Details failed for %s (%s): %s", place_id, area, exc)
                continue
            if details is None:
                continue
            path = save_raw(area, place_id, details)
            total_saved += 1
            log.info("Saved %s", path.relative_to(PROJECT_ROOT))

    log.info("Done: %d raw place files in %s", total_saved, RAW_DIR)
    return 0


if __name__ == "__main__":
    sys.exit(main())
