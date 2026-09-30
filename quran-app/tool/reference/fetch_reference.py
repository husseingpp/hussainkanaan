#!/usr/bin/env python3
"""Fetch independent reference values for the Phase 6 gates (CI only).

Prayer times from the AlAdhan API (its own implementation of the same
methods: Shia Ithna-Ashari / Leva Institute Qom = method 0, Tehran = 7,
angle-based high-latitude rule, Jafari midnight) for Beirut, Najaf, Tehran
and Oslo at both solstices and both equinoxes; and Umm al-Qura Hijri dates
for the 1st and 15th of every month of this year and the next two.

This is the only networked step; the app itself never fetches times.
Writes JSON to the path given (default build/reference.json).
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

CITIES = {
    "Beirut": (33.8938, 35.5018, "Asia/Beirut"),
    "Najaf": (32.0000, 44.3350, "Asia/Baghdad"),
    "Tehran": (35.6892, 51.3890, "Asia/Tehran"),
    "Oslo": (59.9139, 10.7522, "Europe/Oslo"),
}
DATES = ["2026-03-20", "2026-06-21", "2026-09-23", "2026-12-21"]
METHODS = {"jafari": 0, "tehran": 7}


def get(url: str) -> dict:
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)["data"]
        except Exception as e:  # noqa: BLE001 - retry any transient failure
            if attempt == 4:
                raise
            print(f"retry {url}: {e}", file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    raise AssertionError


def main() -> int:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "build/reference.json")
    prayers = []
    for city, (lat, lng, tz) in CITIES.items():
        for date in DATES:
            y, m, d = date.split("-")
            for method, mid in METHODS.items():
                data = get(
                    f"https://api.aladhan.com/v1/timings/{d}-{m}-{y}?latitude={lat}&longitude={lng}"
                    f"&method={mid}&timezonestring={tz}&latitudeAdjustmentMethod=3&midnightMode=1&school=0"
                )
                prayers.append({"city": city, "lat": lat, "lng": lng, "tz": tz, "date": date,
                                "method": method, "timings": data["timings"]})
                time.sleep(0.3)
    hijri = []
    year = int(time.strftime("%Y"))
    for y in range(year, year + 3):
        for m in range(1, 13):
            for d in (1, 15):
                data = get(f"https://api.aladhan.com/v1/gToH/{d:02d}-{m:02d}-{y}?calendarMethod=UAQ")
                h = data["hijri"]
                hijri.append({"gregorian": f"{y}-{m:02d}-{d:02d}",
                              "hijri": [int(h["year"]), int(h["month"]["number"]), int(h["day"])]})
                time.sleep(0.2)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"prayers": prayers, "hijri": hijri}, indent=1), encoding="utf-8")
    print(f"wrote {out}: {len(prayers)} prayer days, {len(hijri)} Hijri dates")
    return 0


if __name__ == "__main__":
    sys.exit(main())
