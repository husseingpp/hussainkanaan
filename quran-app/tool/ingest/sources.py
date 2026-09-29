"""Parsers for each upstream source.

Every parser returns plain Python data so ingest.py never touches a source
format directly. When an upstream export changes shape, the fix lives here.

Formats:
  Tanzil metadata   quran-data.xml   https://tanzil.net/res/text/metadata
  Tanzil text       quran-uthmani.xml / quran-simple-clean.xml, or the
                    pipe-delimited .txt export ("sura|aya|text")
  Tanzil translation  same .txt/.xml shapes as the text
  QUL word data     location-keyed JSON: {"1:1:1": "<value>"} or
                    {"1:1:1": {"text": "<value>", ...}}. Used for the
                    word-level Uthmani script, the QCF v1 glyph script,
                    the word-by-word translation and word roots.
                    words-layout-v1.json holds {"page": p, "line": l} instead.
  Timing segments   {"1:1": [[word_position, start_ms, end_ms], ...]},
                    times relative to that ayah's own audio file.
                    An ayah with only a whole-ayah span uses word_position 0.
"""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


class SourceError(ValueError):
    pass


@dataclass(frozen=True)
class SurahMeta:
    id: int
    ayah_count: int
    start: int  # global offset: ayah id = start + ayah_no
    name_ar: str
    name_translit: str
    name_en: str
    revelation_type: str
    revelation_order: int


@dataclass(frozen=True)
class Metadata:
    surahs: list[SurahMeta]
    juz_starts: list[tuple[int, int, int]]  # (juz, surah, ayah)
    quarter_starts: list[tuple[int, int, int]]
    page_starts: list[tuple[int, int, int]]
    sajdas: dict[tuple[int, int], str]


def _int(el: ET.Element, attr: str) -> int:
    try:
        return int(el.attrib[attr])
    except (KeyError, ValueError) as e:
        raise SourceError(f"<{el.tag}> missing/invalid {attr!r}: {el.attrib}") from e


def _markers(root: ET.Element, group: str, tag: str) -> list[tuple[int, int, int]]:
    parent = root.find(group)
    if parent is None:
        raise SourceError(f"metadata has no <{group}>")
    out = [(_int(e, "index"), _int(e, "sura"), _int(e, "aya")) for e in parent.iter(tag)]
    return sorted(out)


def parse_metadata(path: Path) -> Metadata:
    root = ET.parse(path).getroot()
    suras = root.find("suras")
    if suras is None:
        raise SourceError(f"{path}: no <suras>")
    surahs = []
    for e in suras.iter("sura"):
        rtype = e.attrib.get("type", "").lower()
        if rtype not in ("meccan", "medinan"):
            raise SourceError(f"sura {e.attrib.get('index')}: bad type {rtype!r}")
        surahs.append(
            SurahMeta(
                id=_int(e, "index"),
                ayah_count=_int(e, "ayas"),
                start=_int(e, "start"),
                name_ar=e.attrib["name"],
                name_translit=e.attrib["tname"],
                name_en=e.attrib["ename"],
                revelation_type=rtype,
                revelation_order=_int(e, "order"),
            )
        )
    sajdas = {}
    sajda_el = root.find("sajdas")
    for e in sajda_el.iter("sajda") if sajda_el is not None else []:
        sajdas[(_int(e, "sura"), _int(e, "aya"))] = e.attrib["type"]
    return Metadata(
        surahs=sorted(surahs, key=lambda s: s.id),
        juz_starts=_markers(root, "juzs", "juz"),
        quarter_starts=_markers(root, "hizbs", "quarter"),
        page_starts=_markers(root, "pages", "page"),
        sajdas=sajdas,
    )


def parse_ayah_text(path: Path) -> dict[tuple[int, int], str]:
    """Tanzil text or translation, .xml or pipe-delimited .txt."""
    out: dict[tuple[int, int], str] = {}
    if path.suffix == ".xml":
        root = ET.parse(path).getroot()
        for sura in root.iter("sura"):
            s = _int(sura, "index")
            for aya in sura.iter("aya"):
                out[(s, _int(aya, "index"))] = aya.attrib["text"]
        return out
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue  # Tanzil appends its license as # comments
        parts = line.split("|", 2)
        if len(parts) != 3:
            raise SourceError(f"{path}:{n}: expected sura|aya|text")
        try:
            key = (int(parts[0]), int(parts[1]))
        except ValueError as e:
            raise SourceError(f"{path}:{n}: non-numeric sura/aya") from e
        if key in out:
            raise SourceError(f"{path}:{n}: duplicate {key}")
        out[key] = parts[2]
    return out


def _parse_location(key: str, parts: int, path: Path) -> tuple[int, ...]:
    try:
        loc = tuple(int(p) for p in key.split(":"))
    except ValueError:
        loc = ()
    if len(loc) != parts:
        raise SourceError(f"{path}: bad location key {key!r}")
    return loc


def parse_word_values(path: Path) -> dict[tuple[int, int, int], str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for key, value in data.items():
        if isinstance(value, dict):
            value = value.get("text")
        if not isinstance(value, str):
            raise SourceError(f"{path}: {key!r} has no text value")
        out[_parse_location(key, 3, path)] = value
    return out


def parse_word_layout(path: Path) -> dict[tuple[int, int, int], tuple[int, int]]:
    """{"1:1:1": {"page": 1, "line": 2}}: where each word sits in the printed mus'haf."""
    data = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for key, value in data.items():
        try:
            out[_parse_location(key, 3, path)] = (int(value["page"]), int(value["line"]))
        except (KeyError, TypeError, ValueError) as e:
            raise SourceError(f"{path}: {key!r} needs integer page and line") from e
    return out


def parse_segments(path: Path) -> dict[tuple[int, int], list[tuple[int, int, int]]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for key, segs in data.items():
        rows = []
        for seg in segs:
            if len(seg) != 3 or not all(isinstance(x, int) for x in seg):
                raise SourceError(f"{path}: {key}: segment must be [pos, start_ms, end_ms]")
            rows.append(tuple(seg))
        out[_parse_location(key, 2, path)] = sorted(rows)
    return out
