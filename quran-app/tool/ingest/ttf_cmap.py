"""Just enough TrueType parsing to list a font's mapped code points.

The ingest uses it to prove every QCF glyph code on a page exists in that
page's font, without leaving the standard library.
"""

from __future__ import annotations

import struct


class FontError(ValueError):
    pass


def codepoints(data: bytes) -> set[int]:
    """All code points mapped by the font's Unicode cmap subtables (formats 4 and 12)."""
    if len(data) < 12 or data[:4] not in (b"\x00\x01\x00\x00", b"true"):
        raise FontError("not a TrueType font")
    num_tables = struct.unpack_from(">H", data, 4)[0]
    cmap_offset = None
    for i in range(num_tables):
        tag, _, offset, _ = struct.unpack_from(">4sIII", data, 12 + 16 * i)
        if tag == b"cmap":
            cmap_offset = offset
    if cmap_offset is None:
        raise FontError("font has no cmap table")

    out: set[int] = set()
    n_sub = struct.unpack_from(">H", data, cmap_offset + 2)[0]
    for i in range(n_sub):
        platform, encoding, sub = struct.unpack_from(">HHI", data, cmap_offset + 4 + 8 * i)
        if (platform, encoding) not in ((3, 1), (3, 10), (0, 3), (0, 4)):
            continue
        base = cmap_offset + sub
        fmt = struct.unpack_from(">H", data, base)[0]
        if fmt == 4:
            seg2 = struct.unpack_from(">H", data, base + 6)[0]
            ends = struct.unpack_from(f">{seg2 // 2}H", data, base + 14)
            starts = struct.unpack_from(f">{seg2 // 2}H", data, base + 16 + seg2)
            deltas = struct.unpack_from(f">{seg2 // 2}h", data, base + 16 + 2 * seg2)
            ro_base = base + 16 + 3 * seg2
            ranges = struct.unpack_from(f">{seg2 // 2}H", data, ro_base)
            for k, (start, end) in enumerate(zip(starts, ends)):
                for c in range(start, end + 1):
                    if c == 0xFFFF:
                        continue
                    if ranges[k] == 0:
                        glyph = (c + deltas[k]) & 0xFFFF
                    else:
                        at = ro_base + 2 * k + ranges[k] + 2 * (c - start)
                        glyph = struct.unpack_from(">H", data, at)[0]
                        glyph = (glyph + deltas[k]) & 0xFFFF if glyph else 0
                    if glyph:
                        out.add(c)
        elif fmt == 12:
            n_groups = struct.unpack_from(">I", data, base + 12)[0]
            for g in range(n_groups):
                start, end, glyph = struct.unpack_from(">III", data, base + 16 + 12 * g)
                out.update(c for c in range(start, end + 1) if glyph + (c - start))
    return out
