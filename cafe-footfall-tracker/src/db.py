"""Shared database plumbing for the café footfall pipeline.

Defines the SQLAlchemy engine factory and Core ``Table`` objects that
mirror sql/schema.sql, so load.py / sentiment.py / analyse.py all agree
on column names without reflection round-trips.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import (
    BOOLEAN,
    FLOAT,
    INT,
    TEXT,
    TIME,
    TIMESTAMP,
    Column,
    ForeignKey,
    MetaData,
    Table,
    create_engine,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.engine import Engine

PROJECT_ROOT = Path(__file__).resolve().parents[1]

metadata = MetaData()

cafes = Table(
    "cafes",
    metadata,
    Column("cafe_id", UUID(as_uuid=True), primary_key=True),
    Column("name", TEXT, nullable=False),
    Column("area", TEXT, nullable=False),
    Column("lat", FLOAT),
    Column("lng", FLOAT),
    Column("price_level", INT),
    Column("rating", FLOAT),
    Column("total_reviews", INT),
    Column("place_id", TEXT, unique=True, nullable=False),
    Column("fetched_at", TIMESTAMP(timezone=True)),
)

opening_hours = Table(
    "opening_hours",
    metadata,
    Column("hour_id", INT, primary_key=True),
    Column("cafe_id", UUID(as_uuid=True), ForeignKey("cafes.cafe_id"), nullable=False),
    Column("day_of_week", INT, nullable=False),
    Column("open_time", TIME),
    Column("close_time", TIME),
    Column("is_open_24h", BOOLEAN, nullable=False, default=False),
)

reviews = Table(
    "reviews",
    metadata,
    Column("review_id", INT, primary_key=True),
    Column("cafe_id", UUID(as_uuid=True), ForeignKey("cafes.cafe_id"), nullable=False),
    Column("rating", INT),
    Column("text", TEXT),
    Column("language", TEXT),
    Column("time_posted", TIMESTAMP(timezone=True)),
    Column("sentiment_score", FLOAT),
    Column("sentiment_label", TEXT),
)


def get_engine() -> Engine:
    """Build an engine from the DB_URL in .env (or the environment)."""
    load_dotenv(PROJECT_ROOT / ".env")
    db_url = os.environ.get("DB_URL")
    if not db_url:
        raise RuntimeError(
            "DB_URL is not set. Copy .env.example to .env and fill it in."
        )
    # SQLAlchemy 2.x requires the explicit psycopg2 driver suffix to be
    # unambiguous; accept the plain postgresql:// form from .env.example.
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return create_engine(db_url)
