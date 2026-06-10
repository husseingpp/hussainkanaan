"""Sentiment scoring for multilingual café reviews.

- English ('en'): vaderSentiment compound score (-1 … 1).
- Arabic  ('ar'): bag-of-words score from the bundled lexicon at
  data/arabic_sentiment_words.csv — (pos − neg) / (pos + neg).
  Deliberately lightweight: no camel-tools dependency. Tokens are
  normalised (diacritics stripped, alef variants folded) before lookup.
  Known limitation: negation ("مش حلو") is not handled.
- Other languages: VADER as a best-effort fallback (scores near 0 for
  text it cannot read, which maps to a 'neutral' label).

Public API:
    score_review(text, language) -> {"sentiment_score": float,
                                     "sentiment_label": str}

Run as a script to score every review in Postgres that has no
sentiment yet:  python src/sentiment.py
"""

from __future__ import annotations

import csv
import logging
import re
import sys

from sqlalchemy import bindparam, select, update
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from db import PROJECT_ROOT, get_engine, reviews

LEXICON_PATH = PROJECT_ROOT / "data" / "arabic_sentiment_words.csv"

# Same compound-score thresholds VADER's authors recommend.
POSITIVE_THRESHOLD = 0.05
NEGATIVE_THRESHOLD = -0.05

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("sentiment")

_vader = SentimentIntensityAnalyzer()

# Harakat, superscript alef and tatweel.
_ARABIC_DIACRITICS = re.compile("[\u064b-\u0652\u0670\u0640]")
# Any run of characters in the main Arabic block.
_ARABIC_TOKEN = re.compile("[\u0600-\u06ff]+")


def normalise_arabic(text: str) -> str:
    """Fold the variations that would break naive lexicon lookups."""
    text = _ARABIC_DIACRITICS.sub("", text)
    text = re.sub("[إأآ]", "ا", text)
    text = text.replace("ى", "ي")
    return text


def _load_lexicon() -> tuple[set[str], set[str]]:
    positive, negative = set(), set()
    with open(LEXICON_PATH, encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            word = normalise_arabic(row["word"].strip())
            (positive if row["polarity"] == "positive" else negative).add(word)
    return positive, negative


_POSITIVE_WORDS, _NEGATIVE_WORDS = _load_lexicon()


def _arabic_score(text: str) -> float:
    tokens = [normalise_arabic(t) for t in _ARABIC_TOKEN.findall(text)]
    pos = sum(t in _POSITIVE_WORDS for t in tokens)
    neg = sum(t in _NEGATIVE_WORDS for t in tokens)
    if pos + neg == 0:
        return 0.0
    return (pos - neg) / (pos + neg)


def _label(score: float) -> str:
    if score >= POSITIVE_THRESHOLD:
        return "positive"
    if score <= NEGATIVE_THRESHOLD:
        return "negative"
    return "neutral"


def score_review(text: str | None, language: str | None) -> dict:
    """Score one review. Returns {sentiment_score, sentiment_label}."""
    if not text or not text.strip():
        return {"sentiment_score": 0.0, "sentiment_label": "neutral"}
    if language == "ar":
        score = _arabic_score(text)
    else:
        # English, plus best-effort fallback for anything else.
        score = _vader.polarity_scores(text)["compound"]
    return {"sentiment_score": round(score, 4), "sentiment_label": _label(score)}


def main() -> int:
    engine = get_engine()
    with engine.begin() as conn:
        pending = conn.execute(
            select(reviews.c.review_id, reviews.c.text, reviews.c.language).where(
                reviews.c.sentiment_score.is_(None)
            )
        ).all()

        if not pending:
            log.info("No unscored reviews — nothing to do.")
            return 0

        updates = []
        for review_id, text, language in pending:
            result = score_review(text, language)
            updates.append({"rid": review_id, **result})

        # Single executemany UPDATE rather than one statement per row.
        stmt = (
            update(reviews)
            .where(reviews.c.review_id == bindparam("rid"))
            .values(
                sentiment_score=bindparam("sentiment_score"),
                sentiment_label=bindparam("sentiment_label"),
            )
        )
        conn.execute(stmt, updates)

    labels = [u["sentiment_label"] for u in updates]
    log.info(
        "Scored %d reviews (%d positive / %d neutral / %d negative)",
        len(updates),
        labels.count("positive"),
        labels.count("neutral"),
        labels.count("negative"),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
