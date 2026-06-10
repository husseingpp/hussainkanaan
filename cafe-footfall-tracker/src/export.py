"""Build the static GitHub Pages report (docs/index.html).

Runs every analysis query via src/analyse.py, renders five Plotly
figures, converts each to an embeddable div with plotly.io.to_html
(full_html=False), and injects them into templates/report.html with
Jinja2. plotly.js itself is loaded once from the CDN by a <script>
tag in the template head, so every chart div is exported with
include_plotlyjs=False — the page stays self-contained apart from
that single CDN tag.

Run:  python src/export.py
"""

from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone

import pandas as pd
import plotly.graph_objects as go
import plotly.io as pio
from jinja2 import Environment, FileSystemLoader, select_autoescape

import analyse
from db import PROJECT_ROOT

TEMPLATE_DIR = PROJECT_ROOT / "templates"
DOCS_DIR = PROJECT_ROOT / "docs"

# Palette shared with templates/report.html.
BG = "#0f0f0f"
CARD_BG = "#1a1a1a"
ACCENT = "#1D9E75"
TEXT = "#e8e6e3"
MUTED = "#9a9a9a"
AREA_COLOURS = ["#1D9E75", "#5ab0f2", "#e2b84b", "#e2664b", "#b07fe8"]

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

PLOTLY_CONFIG = {"responsive": True, "displayModeBar": False}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("export")


def _styled(fig: go.Figure, height: int = 460) -> go.Figure:
    """Apply the report's dark theme to a figure."""
    fig.update_layout(
        paper_bgcolor=CARD_BG,
        plot_bgcolor=CARD_BG,
        font=dict(color=TEXT, family="Inter, system-ui, sans-serif", size=13),
        height=height,
        margin=dict(l=60, r=30, t=50, b=50),
        legend=dict(bgcolor="rgba(0,0,0,0)"),
        colorway=AREA_COLOURS,
    )
    fig.update_xaxes(gridcolor="#2a2a2a", zerolinecolor="#3a3a3a")
    fig.update_yaxes(gridcolor="#2a2a2a", zerolinecolor="#3a3a3a")
    return fig


def _to_div(fig: go.Figure) -> str:
    return pio.to_html(
        fig,
        full_html=False,
        include_plotlyjs=False,  # CDN script tag lives in the template head
        config=PLOTLY_CONFIG,
    )


# ----------------------------------------------------------------- charts


def chart_zone_ranking(df: pd.DataFrame) -> go.Figure:
    """Horizontal bars: avg rating and avg sentiment per area, shared y."""
    df = df.sort_values("overall_rank", ascending=False)  # best zone on top
    fig = go.Figure()
    fig.add_trace(
        go.Bar(
            y=df["area"], x=df["avg_rating"], orientation="h",
            name="Avg rating (0–5)", marker_color=ACCENT,
        )
    )
    fig.add_trace(
        go.Bar(
            y=df["area"], x=df["avg_sentiment"], orientation="h",
            name="Avg sentiment (−1…1)", marker_color="#5ab0f2",
            xaxis="x2",
        )
    )
    fig.update_layout(
        barmode="group",
        title="Zone ranking — rating vs review sentiment",
        xaxis=dict(title="Average Google rating", range=[0, 5]),
        xaxis2=dict(
            title="Average sentiment", overlaying="x", side="top",
            range=[-1, 1], gridcolor="rgba(0,0,0,0)",
        ),
        legend=dict(orientation="h", y=-0.18),
    )
    return _styled(fig)


def chart_open_heatmap(df: pd.DataFrame) -> go.Figure:
    """day_of_week × hour heatmap of simultaneously open cafés."""
    matrix = (
        df.pivot(index="day_of_week", columns="hour_of_day", values="open_cafes")
        .reindex(index=range(7), columns=range(24))
        .fillna(0)
    )
    fig = go.Figure(
        go.Heatmap(
            z=matrix.values,
            x=[f"{h:02d}:00" for h in range(24)],
            y=DAY_NAMES,
            colorscale=[[0, CARD_BG], [1, ACCENT]],
            colorbar=dict(title="Cafés open"),
            hovertemplate="%{y} %{x}<br>%{z} cafés open<extra></extra>",
        )
    )
    fig.update_layout(
        title="When is Beirut caffeinated? Open cafés by day and hour",
        yaxis=dict(autorange="reversed"),  # Monday on top
    )
    return _styled(fig)


def chart_rating_scatter(df: pd.DataFrame) -> go.Figure:
    """Rating vs review volume, coloured by area, sized by price level."""
    fig = go.Figure()
    for i, (area, group) in enumerate(df.groupby("area")):
        fig.add_trace(
            go.Scatter(
                x=group["total_reviews"], y=group["rating"],
                mode="markers", name=area,
                marker=dict(
                    size=group["price_level"] * 8 + 6,
                    color=AREA_COLOURS[i % len(AREA_COLOURS)],
                    opacity=0.75, line=dict(width=0),
                ),
                text=group["name"],
                hovertemplate="<b>%{text}</b><br>rating %{y} · %{x} reviews<extra>" + area + "</extra>",
            )
        )
    fig.update_layout(
        title="Rating vs popularity (marker size = price level)",
        xaxis=dict(title="Total reviews (log scale)", type="log"),
        yaxis=dict(title="Google rating", range=[2.5, 5.1]),
    )
    return _styled(fig)


def chart_bucket_sentiment(df: pd.DataFrame) -> go.Figure:
    """Avg sentiment per star-rating bucket (1–5)."""
    df = df.set_index("star_bucket").reindex(range(1, 6)).reset_index()
    colours = [ACCENT if (s or 0) >= 0 else "#e2664b" for s in df["avg_sentiment"]]
    fig = go.Figure(
        go.Bar(
            x=[f"{b} ★" for b in df["star_bucket"]],
            y=df["avg_sentiment"],
            marker_color=colours,
            text=df["review_count"],
            texttemplate="n=%{text}",
            textposition="outside",
        )
    )
    fig.update_layout(
        title="Do words match the stars? Avg sentiment per rating bucket",
        xaxis=dict(title="Review star rating"),
        yaxis=dict(title="Average sentiment score", range=[-1, 1]),
    )
    return _styled(fig, height=420)


def chart_underperformers(df: pd.DataFrame) -> go.Figure:
    """Table of cafés rated > 0.5 stars below their area average."""
    columns = ["name", "area", "rating", "area_avg_rating", "rating_delta", "avg_sentiment"]
    headers = ["Café", "Area", "Rating", "Area avg", "Delta", "Avg sentiment"]
    fig = go.Figure(
        go.Table(
            header=dict(
                values=[f"<b>{h}</b>" for h in headers],
                fill_color=ACCENT, font=dict(color="#06241a", size=13),
                align="left", height=32,
            ),
            cells=dict(
                values=[df[c] for c in columns] if not df.empty else [[] for _ in columns],
                fill_color=CARD_BG, font=dict(color=TEXT, size=12),
                align="left", height=28,
            ),
        )
    )
    fig.update_layout(title="Underperformers — more than 0.5★ below their area")
    return _styled(fig, height=max(240, 80 + 28 * (len(df) + 1)))


# --------------------------------------------------------------- captions


def build_captions(r: dict) -> dict[str, str]:
    """Short plain-English insight lines under each chart, data-driven
    where possible with safe fallbacks for empty results."""
    captions = {}

    zr = r["zone_ranking"]
    if not zr.empty:
        best = zr.iloc[0]
        captions["zone_ranking"] = (
            f"{best['area']} comes out as the strongest all-round zone, combining a "
            f"{best['avg_rating']} average rating with the healthiest review sentiment. "
            "Rating and sentiment mostly move together, but the gaps between them show "
            "where star ratings flatter (or undersell) the actual customer experience."
        )
    else:
        captions["zone_ranking"] = "Run the pipeline to populate zone rankings."

    ap = r["area_peaks"]
    if not ap.empty:
        top = ap.sort_values("open_cafes", ascending=False).iloc[0]
        captions["open_matrix"] = (
            f"Café availability peaks around {top['peak_day']} {int(top['peak_hour']):02d}:00 "
            f"in {top['area']}, when {int(top['open_cafes'])} spots are open at once. "
            "The bright mid-day band shows Beirut's café culture is an all-week, "
            "late-into-the-evening affair rather than a weekend phenomenon."
        )
    else:
        captions["open_matrix"] = "Run the pipeline to populate opening-hour data."

    cs = r["cafe_scatter"]
    if not cs.empty:
        busiest = cs.sort_values("total_reviews", ascending=False).iloc[0]
        captions["cafe_scatter"] = (
            f"Popularity and quality are only loosely linked: {busiest['name']} draws the most "
            f"reviews ({int(busiest['total_reviews'])}) without topping the ratings. Watch the "
            "lower-right corner — heavily reviewed but modestly rated cafés trade on location, "
            "not loyalty."
        )
    else:
        captions["cafe_scatter"] = "Run the pipeline to populate café data."

    bs = r["bucket_sentiment"]
    if not bs.empty:
        captions["bucket_sentiment"] = (
            "Sentiment climbs almost monotonically with star rating, which is a good sanity "
            "check on the multilingual scoring (VADER for English, a custom lexicon for "
            "Arabic). Where a bucket breaks the trend, reviewers are saying one thing and "
            "clicking another — those gaps feed the contradiction analysis."
        )
    else:
        captions["bucket_sentiment"] = "Run the pipeline to populate sentiment data."

    up = r["underperformers"]
    if not up.empty:
        worst = up.iloc[0]
        captions["underperformers"] = (
            f"{len(up)} café{'s sit' if len(up) != 1 else ' sits'} more than half a star below "
            f"the neighbourhood average, with {worst['name']} ({worst['area']}) furthest "
            f"adrift at {worst['rating_delta']:+.2f}. Cross-checking against review sentiment "
            "separates genuinely weak operators from places with a few loud detractors."
        )
    else:
        captions["underperformers"] = (
            "No café currently sits more than half a star below its area average — "
            "a remarkably even playing field."
        )
    return captions


# ------------------------------------------------------------------ main


def main() -> int:
    results = analyse.run_all()
    metrics = results["metrics"]

    log.info("Building charts…")
    charts = {
        "zone_ranking": _to_div(chart_zone_ranking(results["zone_ranking"])),
        "open_matrix": _to_div(chart_open_heatmap(results["open_matrix"])),
        "cafe_scatter": _to_div(chart_rating_scatter(results["cafe_scatter"])),
        "bucket_sentiment": _to_div(chart_bucket_sentiment(results["bucket_sentiment"])),
        "underperformers": _to_div(chart_underperformers(results["underperformers"])),
    }

    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=select_autoescape(enabled_extensions=()),  # chart divs are trusted HTML
    )
    html = env.get_template("report.html").render(
        metrics=metrics,
        charts=charts,
        captions=build_captions(results),
        generated_on=datetime.now(timezone.utc).strftime("%d %B %Y"),
    )

    DOCS_DIR.mkdir(exist_ok=True)
    out_path = DOCS_DIR / "index.html"
    out_path.write_text(html, encoding="utf-8")
    # Keep GitHub Pages from running the output through Jekyll.
    (DOCS_DIR / ".nojekyll").touch()
    log.info("Wrote %s (%.1f kB)", out_path, out_path.stat().st_size / 1024)
    return 0


if __name__ == "__main__":
    sys.exit(main())
