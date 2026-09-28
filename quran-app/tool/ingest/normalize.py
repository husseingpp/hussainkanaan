"""Search-text normalization.

Applied once at ingest to build ``ayahs.search_text`` and, identically, to
every user query at runtime (lib/core/arabic_normalizer.dart). People type
without harakat and with whatever hamza/alef/ya forms their keyboard gives
them, so both sides fold to the same skeleton. The two implementations are
pinned together by schema/search_normalization_vectors.json.
"""

import re

_FOLD = str.maketrans(
    {
        "ٱ": "ا",  # ٱ alef wasla -> ا
        "أ": "ا",  # أ
        "إ": "ا",  # إ
        "آ": "ا",  # آ
        "ى": "ي",  # ى alef maqsura -> ي
        "ی": "ي",  # ی Persian yeh
        "ئ": "ي",  # ئ
        "ؤ": "و",  # ؤ -> و
        "ة": "ه",  # ة ta marbuta -> ه
        "ک": "ك",  # ک Persian keheh -> ك
    }
)

# Tatweel, harakat + dagger alef, and the Quranic annotation block
# (small high letters, pause marks, end-of-ayah and rub el hizb signs).
_STRIP = re.compile("[ـً-ٰٟۖ-ۭ]")
_SPACE = re.compile(r"\s+")


def normalize(text: str) -> str:
    text = _STRIP.sub("", text)
    text = text.translate(_FOLD)
    return _SPACE.sub(" ", text).strip()
