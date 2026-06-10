"""Generate mock Google Places dumps for an offline dry-run.

Writes 5 fictional cafés (10 reviews total, English + Arabic) into
data/raw/ in exactly the JSON shape src/ingest.py produces, so the
rest of the pipeline (load → sentiment → analyse → export) can be
tested end-to-end without an API key.

The fixtures deliberately cover the analytical edge cases:
  * a 24/7 café and an overnight (18:00–02:00) closer
  * an underperformer rated well below its area average
  * a "contradiction" café (high stars, sour review text)

Run:  python src/mock_data.py
Stdlib only — no third-party imports.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw"


def _hours(spec: list[tuple[int, str, int, str]]) -> dict:
    """Build a Places-style opening_hours dict.

    spec rows: (google_open_day, "HHMM", google_close_day, "HHMM").
    Google days are 0=Sunday … 6=Saturday.
    """
    return {
        "periods": [
            {
                "open": {"day": od, "time": ot},
                "close": {"day": cd, "time": ct},
            }
            for od, ot, cd, ct in spec
        ]
    }


# Mon–Sat 08:00–22:00 in Google day numbering (1=Mon … 6=Sat).
_STANDARD_WEEK = [(d, "0800", d, "2200") for d in range(1, 7)]

MOCK_CAFES = [
    {
        "area": "Hamra",
        "place_id": "mock_hamra_001",
        "details": {
            "place_id": "mock_hamra_001",
            "name": "Café Younes (Mock)",
            "geometry": {"location": {"lat": 33.8959, "lng": 35.4786}},
            "rating": 4.6,
            "user_ratings_total": 1240,
            "price_level": 2,
            # Open every day including Sunday morning.
            "opening_hours": _hours(_STANDARD_WEEK + [(0, "0900", 0, "2100")]),
            "reviews": [
                {
                    "rating": 5,
                    "text": "Fantastic coffee and a wonderful, cosy atmosphere. Best café in Hamra!",
                    "time": 1717000000,
                    "language": "en",
                },
                {
                    "rating": 5,
                    "text": "القهوة لذيذة والمكان مريح وهادئ، أنصح الجميع بزيارته",
                    "time": 1717100000,
                    "language": "ar",
                },
                {
                    "rating": 4,
                    "text": "Great espresso, though it gets crowded in the afternoon.",
                    "time": 1717200000,
                    "language": "en",
                },
            ],
        },
    },
    {
        "area": "Hamra",
        "place_id": "mock_hamra_002",
        "details": {
            "place_id": "mock_hamra_002",
            "name": "Drowsy Beans (Mock)",
            "geometry": {"location": {"lat": 33.8949, "lng": 35.4801}},
            # Deliberate underperformer: far below Hamra's average.
            "rating": 3.2,
            "user_ratings_total": 210,
            "price_level": 1,
            "opening_hours": _hours(_STANDARD_WEEK),
            "reviews": [
                {
                    "rating": 2,
                    "text": "Slow service and the coffee was cold. Disappointing.",
                    "time": 1716800000,
                    "language": "en",
                },
                {
                    "rating": 3,
                    "text": "المكان وسخ والخدمة بطيئة للأسف",
                    "time": 1716900000,
                    "language": "ar",
                },
            ],
        },
    },
    {
        "area": "Gemmayzeh",
        "place_id": "mock_gemmayzeh_001",
        "details": {
            "place_id": "mock_gemmayzeh_001",
            "name": "Sip & Stone (Mock)",
            "geometry": {"location": {"lat": 33.8964, "lng": 35.5161}},
            # Contradiction case: high stars, sour review text.
            "rating": 4.5,
            "user_ratings_total": 890,
            "price_level": 3,
            # Overnight closer: 18:00 to 02:00 next day.
            "opening_hours": _hours([(d, "1800", (d + 1) % 7, "0200") for d in range(7)]),
            "reviews": [
                {
                    "rating": 4,
                    "text": "Terrible noise levels and rude staff ruined an otherwise nice spot.",
                    "time": 1717300000,
                    "language": "en",
                },
                {
                    "rating": 5,
                    "text": "الأسعار غالية والمكان مزدحم دائماً",
                    "time": 1717400000,
                    "language": "ar",
                },
            ],
        },
    },
    {
        "area": "Mar Mikhael",
        "place_id": "mock_marmikhael_001",
        "details": {
            "place_id": "mock_marmikhael_001",
            "name": "Beirut Beans 24/7 (Mock)",
            "geometry": {"location": {"lat": 33.8983, "lng": 35.5247}},
            "rating": 4.1,
            "user_ratings_total": 460,
            "price_level": 2,
            # Google's 24/7 signal: single open period, no close.
            "opening_hours": {"periods": [{"open": {"day": 0, "time": "0000"}}]},
            "reviews": [
                {
                    "rating": 4,
                    "text": "Open all night — a lifesaver during exam season. Decent flat white.",
                    "time": 1717500000,
                    "language": "en",
                },
                {
                    "rating": 4,
                    "text": "مكان رائع للدراسة والقهوة ممتازة",
                    "time": 1717600000,
                    "language": "ar",
                },
            ],
        },
    },
    {
        "area": "Achrafieh",
        "place_id": "mock_achrafieh_001",
        "details": {
            "place_id": "mock_achrafieh_001",
            "name": "Le Petit Moulin (Mock)",
            "geometry": {"location": {"lat": 33.8869, "lng": 35.5131}},
            "rating": 4.4,
            "user_ratings_total": 675,
            "price_level": 3,
            "opening_hours": _hours(_STANDARD_WEEK),
            "reviews": [
                {
                    "rating": 5,
                    "text": "Beautiful terrace and excellent manakish. Highly recommended.",
                    "time": 1717700000,
                    "language": "en",
                },
            ],
        },
    },
]


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc).isoformat()
    for cafe in MOCK_CAFES:
        payload = {**cafe, "fetched_at": fetched_at}
        path = RAW_DIR / f"{cafe['area'].replace(' ', '_')}_{cafe['place_id']}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote {path.relative_to(PROJECT_ROOT)}")
    reviews = sum(len(c["details"]["reviews"]) for c in MOCK_CAFES)
    print(f"{len(MOCK_CAFES)} mock cafés, {reviews} reviews")
    return 0


if __name__ == "__main__":
    sys.exit(main())
