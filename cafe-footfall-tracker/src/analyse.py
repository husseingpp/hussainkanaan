"""Run the SQL analysis queries and return Pandas DataFrames.

Each file in sql/ holds one or more SELECT statements, each preceded
by a marker comment of the form:

    -- :name some_result_name

run_query_file() splits the file on those markers and returns
{name: DataFrame}. Files without a marker get their filename stem as
the result name. run_all() executes every analysis query, refreshes
the area_summary materialised view, and adds a couple of small inline
queries (headline metrics, café scatter data) the report needs.

Run standalone to eyeball results:  python src/analyse.py
"""

from __future__ import annotations

import logging
import re
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

from db import PROJECT_ROOT, get_engine

SQL_DIR = PROJECT_ROOT / "sql"

ANALYSIS_FILES = [
    "zone_ranking.sql",
    "peak_hours.sql",
    "underperformers.sql",
    "sentiment_vs_rating.sql",
]

_NAME_MARKER = re.compile(r"^--\s*:name\s+(\w+)\s*$", re.MULTILINE)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("analyse")


def split_named_queries(sql_text: str, default_name: str) -> dict[str, str]:
    """Split a SQL file into {result_name: statement} on '-- :name' markers."""
    markers = list(_NAME_MARKER.finditer(sql_text))
    if not markers:
        return {default_name: sql_text}
    queries: dict[str, str] = {}
    for i, marker in enumerate(markers):
        start = marker.end()
        end = markers[i + 1].start() if i + 1 < len(markers) else len(sql_text)
        statement = sql_text[start:end].strip().rstrip(";")
        queries[marker.group(1)] = statement
    return queries


def run_query_file(engine: Engine, path: Path) -> dict[str, pd.DataFrame]:
    """Execute every named statement in one SQL file."""
    queries = split_named_queries(path.read_text(encoding="utf-8"), path.stem)
    results = {}
    for name, statement in queries.items():
        with engine.connect() as conn:
            results[name] = pd.read_sql(text(statement), conn)
        log.info("%s -> %s: %d rows", path.name, name, len(results[name]))
    return results


def refresh_area_summary(engine: Engine) -> None:
    """Recompute the materialised rollup after load/sentiment runs."""
    with engine.begin() as conn:
        conn.execute(text("REFRESH MATERIALIZED VIEW area_summary"))
    log.info("Refreshed area_summary materialised view")


def headline_metrics(engine: Engine) -> dict:
    """The four numbers shown as metric cards at the top of the report."""
    sql = text(
        """
        SELECT (SELECT COUNT(*) FROM cafes)                                  AS total_cafes,
               (SELECT COUNT(DISTINCT area) FROM cafes)                      AS areas_covered,
               (SELECT COUNT(*) FROM reviews)                                AS reviews_processed,
               (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM cafes)            AS avg_city_rating
        """
    )
    with engine.connect() as conn:
        row = conn.execute(sql).mappings().one()
    return dict(row)


def cafe_scatter_data(engine: Engine) -> pd.DataFrame:
    """Café-level fields for the rating vs popularity scatter chart."""
    sql = text(
        """
        SELECT name, area, rating, total_reviews, COALESCE(price_level, 1) AS price_level
        FROM cafes
        WHERE rating IS NOT NULL AND total_reviews IS NOT NULL
        """
    )
    with engine.connect() as conn:
        return pd.read_sql(sql, conn)


def area_summary(engine: Engine) -> pd.DataFrame:
    with engine.connect() as conn:
        return pd.read_sql(text("SELECT * FROM area_summary ORDER BY area"), conn)


def run_all(engine: Engine | None = None) -> dict[str, pd.DataFrame | dict]:
    """Everything export.py needs, keyed by result name.

    Keys: zone_ranking, open_matrix, area_peaks, underperformers,
    bucket_sentiment, contradictions, cafe_scatter, area_summary,
    metrics (a plain dict).
    """
    engine = engine or get_engine()
    refresh_area_summary(engine)

    results: dict[str, pd.DataFrame | dict] = {}
    for filename in ANALYSIS_FILES:
        results.update(run_query_file(engine, SQL_DIR / filename))
    results["cafe_scatter"] = cafe_scatter_data(engine)
    results["area_summary"] = area_summary(engine)
    results["metrics"] = headline_metrics(engine)
    return results


def main() -> int:
    results = run_all()
    print("\n=== Headline metrics ===")
    for key, value in results["metrics"].items():
        print(f"  {key}: {value}")
    for name, df in results.items():
        if isinstance(df, pd.DataFrame):
            print(f"\n=== {name} ({len(df)} rows) ===")
            print(df.head(10).to_string(index=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
