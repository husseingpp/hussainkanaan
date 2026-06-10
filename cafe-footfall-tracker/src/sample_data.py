"""Generate a richer, realistic *sample* dataset for the portfolio demo.

This is distinct from src/mock_data.py (which writes the minimal 5-café
fixture used for the end-to-end dry-run). Here we seed ~28 cafés spread
across all five Beirut areas, with varied opening-hour patterns and a
believable mix of English + Arabic reviews, so the published report shows
a full, interesting dashboard before the live Google Places API is run.

The data is fabricated for demonstration only — café names are real
Beirut spots but every rating, review and opening time here is synthetic.
The report carries a clear "demo data" banner so this is never mistaken
for live Google data.

Output matches the exact JSON shape src/ingest.py produces, so the rest
of the pipeline (load → sentiment → analyse → export) is untouched.

Run:  python src/sample_data.py        # writes data/raw/*.json
Stdlib only.
"""

from __future__ import annotations

import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = PROJECT_ROOT / "data" / "raw"

random.seed(2024)  # deterministic output

# --- opening-hour patterns, in Google's format (day 0=Sun … 6=Sat) -------

def _standard_week(open_t: str, close_t: str) -> dict:
    return {"periods": [{"open": {"day": d, "time": open_t},
                         "close": {"day": d, "time": close_t}} for d in range(7)]}

def _overnight_week(open_t: str, close_t: str) -> dict:
    return {"periods": [{"open": {"day": d, "time": open_t},
                         "close": {"day": (d + 1) % 7, "time": close_t}} for d in range(7)]}

def _always_open() -> dict:
    return {"periods": [{"open": {"day": 0, "time": "0000"}}]}

HOUR_PATTERNS = {
    "daytime":   lambda: _standard_week("0700", "2000"),   # 07:00–20:00
    "full":      lambda: _standard_week("0800", "2300"),   # 08:00–23:00
    "late":      lambda: _overnight_week("1000", "0100"),  # 10:00–01:00
    "nightowl":  lambda: _overnight_week("1700", "0200"),  # 17:00–02:00
    "247":       _always_open,
}

# --- review snippet pools ------------------------------------------------

EN_POS = [
    "Fantastic coffee and a cosy atmosphere — my go-to spot.",
    "Great place to work, fast wifi and genuinely friendly staff.",
    "Best flat white in the neighbourhood, hands down.",
    "Lovely terrace and excellent pastries. Highly recommended.",
    "Consistently good espresso and warm, attentive service.",
    "Beautiful interior, calm vibe and the manakish is superb.",
]
EN_NEG = [
    "Slow service and honestly overpriced for what you get.",
    "Coffee was lukewarm and the place was far too noisy.",
    "Rude staff completely ruined an otherwise nice spot.",
    "Disappointing — a long wait for a pretty mediocre latte.",
    "Tables were dirty and nobody seemed to care.",
]
EN_NEU = [
    "Decent coffee, nothing that really stands out.",
    "Average spot — fine if you can grab a seat at peak hours.",
]
AR_POS = [
    "القهوة لذيذة والمكان مريح وهادئ، أنصح الجميع بزيارته",
    "مكان رائع للدراسة والقهوة ممتازة والخدمة سريعة",
    "أحلى قهوة في المنطقة والأجواء جميلة والموظفون ودودون",
    "المكان نظيف ومريح والمعجنات طازجة ولذيذة",
]
AR_NEG = [
    "الخدمة بطيئة جداً والأسعار غالية للأسف",
    "المكان مزدحم دائماً والقهوة باردة",
    "الموظفون وقحون والمكان وسخ، تجربة سيئة",
]
AR_NEU = [
    "المكان عادي والقهوة مقبولة، لا بأس به",
]

# --- café roster: (name, base_rating, price_level, hour_pattern) ----------
# base_rating is a hint; reviews are sampled to mostly match it, with a
# couple of deliberate contradictions/underperformers planted below.

CAFES = {
    "Hamra": [
        ("Café Younes", 4.6, 2, "full"),
        ("T-Marbouta", 4.2, 2, "full"),
        ("Bardo", 4.3, 3, "nightowl"),
        ("Ka3kaya", 4.1, 1, "daytime"),
        ("De Prague", 4.4, 2, "late"),
        ("Costa Hamra", 3.4, 2, "full"),          # underperformer
    ],
    "Achrafieh": [
        ("Kalei Coffee Co.", 4.7, 3, "daytime"),
        ("Sip Achrafieh", 4.3, 2, "full"),
        ("Urbanista", 4.5, 3, "late"),
        ("Cherry on Top", 4.0, 2, "full"),
        ("Paul Sassine", 4.1, 3, "full"),
        ("Le Petit Moulin", 4.4, 3, "daytime"),
    ],
    "Gemmayzeh": [
        ("Aaliya's Books", 4.5, 2, "late"),
        ("Internazionale", 4.2, 2, "full"),
        ("Sienna", 4.6, 3, "nightowl"),           # high stars, sour reviews (contradiction)
        ("The Gathering", 4.0, 2, "nightowl"),
        ("Sip & Stone", 3.6, 2, "full"),          # underperformer
    ],
    "Mar Mikhael": [
        ("Kalei Mar Mikhael", 4.6, 3, "daytime"),
        ("Veronica", 4.3, 3, "nightowl"),
        ("Anise", 4.4, 2, "late"),
        ("Frosty Palace", 4.1, 2, "nightowl"),
        ("Beirut Beans 24/7", 4.0, 2, "247"),
        ("Riwaq", 4.2, 1, "full"),
    ],
    "Verdun": [
        ("Paul Verdun", 4.1, 3, "full"),
        ("Caribou Coffee", 3.9, 2, "full"),
        ("Starbucks Verdun", 3.7, 2, "full"),
        ("Em Sherif Café", 4.5, 4, "full"),
        ("Cups & Co", 4.2, 1, "daytime"),
    ],
}


def _reviews_for(base_rating: float, contradiction: str | None) -> list[dict]:
    """Sample 2–5 reviews whose stars track the café's quality, mixing
    English and Arabic. `contradiction` plants a deliberate mismatch."""
    n = random.randint(2, 5)
    reviews = []
    for _ in range(n):
        arabic = random.random() < 0.4
        if contradiction == "negative":          # high stars, negative text
            stars = random.choice([4, 5])
            pool = AR_NEG if arabic else EN_NEG
        elif contradiction == "positive":        # low stars, positive text
            stars = random.choice([1, 2])
            pool = AR_POS if arabic else EN_POS
        else:
            stars = max(1, min(5, round(base_rating + random.uniform(-1.0, 0.6))))
            if stars >= 4:
                pool = AR_POS if arabic else EN_POS
            elif stars <= 2:
                pool = AR_NEG if arabic else EN_NEG
            else:
                pool = AR_NEU if arabic else EN_NEU
        reviews.append({
            "rating": stars,
            "text": random.choice(pool),
            "language": "ar" if arabic else "en",
            "time": random.randint(1_690_000_000, 1_717_000_000),
        })
    return reviews


# Area centroids (approx) so coordinates look plausible on a map.
AREA_CENTER = {
    "Hamra": (33.8959, 35.4786),
    "Achrafieh": (33.8869, 35.5200),
    "Gemmayzeh": (33.8964, 35.5161),
    "Mar Mikhael": (33.8983, 35.5247),
    "Verdun": (33.8790, 35.4880),
}

# Cafés whose review tone deliberately fights their star rating.
CONTRADICTIONS = {"Sienna": "negative"}


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    # Clear any previous dumps so the demo set is the only thing loaded.
    for old in RAW_DIR.glob("*.json"):
        old.unlink()

    fetched_at = datetime.now(timezone.utc).isoformat()
    total_cafes = total_reviews = 0

    for area, roster in CAFES.items():
        clat, clng = AREA_CENTER[area]
        for i, (name, rating, price, pattern) in enumerate(roster):
            place_id = f"sample_{area.replace(' ', '')}_{i:02d}"
            contradiction = CONTRADICTIONS.get(name)
            reviews = _reviews_for(rating, contradiction)
            details = {
                "place_id": place_id,
                "name": name,
                "geometry": {"location": {
                    "lat": round(clat + random.uniform(-0.004, 0.004), 6),
                    "lng": round(clng + random.uniform(-0.004, 0.004), 6),
                }},
                "rating": rating,
                "user_ratings_total": random.randint(120, 1500),
                "price_level": price,
                "opening_hours": HOUR_PATTERNS[pattern](),
                "reviews": reviews,
            }
            payload = {"area": area, "place_id": place_id,
                       "fetched_at": fetched_at, "details": details}
            path = RAW_DIR / f"{area.replace(' ', '_')}_{place_id}.json"
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                            encoding="utf-8")
            total_cafes += 1
            total_reviews += len(reviews)

    print(f"Wrote {total_cafes} sample cafés, {total_reviews} reviews "
          f"across {len(CAFES)} areas to {RAW_DIR.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
