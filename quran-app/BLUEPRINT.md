# Quran App — Blueprint (Android, iOS, Desktop)

Reference: **القرآن الهادي** (net.firstcause.quran_arabic).

**Two core modes define v1:**

1. **Listen Mode** — long-running background/sleep playback. Screen off, hours at a time, untouched.
2. **Follow Mode** — audio + text together, highlighting the exact word being recited, auto-scrolling.

These two are opposites at the power/lifecycle level — one wants the screen off and minimum CPU, the other wants the screen forced awake and a timer firing every few hundred milliseconds. They are two modes with separate UI and separate failure cases, not a toggle on one screen.

**Companion features (Phase 6):** prayer times (Shia/Jafari primary), qibla compass, and a Shia religious calendar with events and a'maal.

**Architecture: offline-first with optional cloud sync.** Decided — see §5.

---

## 1. Stack

**Flutter** — one codebase for Android, iOS, Windows, macOS, Linux.

Why not React Native / Tauri:

- RN desktop is second-class; you'd maintain two shells.
- Tauri is good for desktop-first (PharmaPOS), but mobile Tauri is immature, and this app needs heavy custom text rendering plus rock-solid background audio on both mobile platforms.
- Flutter renders its own text through Skia, so Arabic mushaf glyph fonts behave identically on every platform. No per-OS shaping bugs — which matters enormously when you're highlighting individual words inside justified Arabic text.

| Concern | Choice |
| --- | --- |
| State | Riverpod |
| Local DB | SQLite (`sqflite` mobile, `sqflite_common_ffi` desktop) |
| Audio engine | `just_audio` |
| Background/lockscreen | `audio_service` |
| Keep-awake | `wakelock_plus` |
| Downloads | `dio` + resumable queue table |
| Prayer times | `adhan` (offline calculation) |
| Hijri dates | `hijri` / custom arithmetic converter |
| Compass | `flutter_compass` + `geolocator` |
| Notifications | `flutter_local_notifications` |
| Sync (v2, optional) | Supabase |

---

## 2. Mus'haf rendering

Two renderers, deliberately:

- **Page View — QCF glyph fonts.** King Fahd Complex ships 604 fonts, one per Madani page, encoding that page's words at private-use codepoints. Line and page breaks land exactly where the printed Mus'haf has them. ~40MB. Fixed layout, no zoom.
- **Reading View — Uthmani Unicode.** One font, arbitrary sizing, reflows.

**Follow Mode uses the Reading View**, not the Page View. Reason: highlighting requires each word in its own `TextSpan` at a known position so you can scroll it into view. QCF fixed-layout pages fight that, and someone following along wants font-size control anyway.

Desktop wide windows render a **two-page spread** in Page View — the feature the reference app doesn't have.

---

## 3. Listen Mode (the sleep feature)

The hardest feature to make *reliable*, and reliability is the whole point — if it dies at 3am, the app failed.

**Playback**

- Per-ayah MP3 files queued via `ConcatenatingAudioSource`, pre-buffering ayah N+1 so there's no gap.
- Continuous queue across surah boundaries. "Play from here to the end of the Quran" must be one tap.
- **Offline required.** Never stream for a sleep session. Listen Mode refuses to start on undownloaded audio and offers the download instead.

**Sleep timer** — four stop conditions, not just minutes:

- After N minutes
- At end of current surah
- After N surahs
- Off (until battery dies)

Fade volume out over the last 30s rather than cutting. The person is asleep; a hard stop wakes them.

**Low-volume floor.** System minimum volume is often still too loud in a quiet room. Apply an in-app gain multiplier *below* system volume so it can go genuinely quiet.

**Android is where this breaks.** Plan for it:

- Foreground service via `audio_service` with an ongoing notification — non-negotiable, or the OS kills you.
- Partial wakelock while playing.
- OEM battery killers (Xiaomi, Huawei, Oppo, Samsung) terminate background audio aggressively *regardless of correct implementation*. Ship a one-time "keep playback alive" screen that deep-links to the battery-optimization exemption settings; detect manufacturer and show the right instructions.
- Write playback position to SQLite every ~10s so a kill is recoverable, not catastrophic.

**iOS**: `AVAudioSession` category `.playback`, `UIBackgroundModes: audio` in Info.plist. Handle interruptions (calls, alarms) — resume after, don't die.

**Desktop**: closing the window must not stop audio. Minimize to system tray with play/pause/next in the tray menu. Respect media keys.

**Interaction with prayer alerts:** an adhan notification firing mid-sleep-session must not stop or duck the recitation unpredictably. Make it an explicit setting — pause for adhan, or ignore — and default to ignore during an active sleep timer.

*QA gate:* 8-hour continuous playback, screen off, on a **physical Android device with battery optimization ON**. Test on a Xiaomi or Samsung, not an emulator.

---

## 4. Follow Mode (word-synced reading)

**The data constraint, first.** Word-level timing data exists for only *some* reciters — QUL / Quran Foundation publishes segment data for a subset. Everything else has ayah-level timing or none. This is a data limit, not a coding problem, so tier reciters in the DB and degrade honestly:

| Tier | Data | Behavior |
| --- | --- | --- |
| A | Word segments | Word-by-word highlight |
| B | Ayah timings only | Whole-ayah highlight |
| C | None | Audio only, no highlight, badge in picker |

**Never interpolate word positions from ayah duration.** It drifts within two ayahs and looks broken — worse than ayah-level highlight done correctly. Recitation pauses and elongations are not uniform.

**Implementation**

- `ayah_timings(reciter_id, ayah_id, word_position, start_ms, end_ms)`, loaded into memory for the current surah only.
- Drive highlight off `just_audio`'s `positionStream`, throttled to ~60ms. **Binary-search** the segment list per tick — never scan linearly.
- Each word is a `TextSpan`; track offsets so the current ayah can be scrolled into view.
- **Auto-scroll etiquette:** keep the current ayah in the upper third. If the user scrolls manually, suspend auto-scroll and show a "return to playback" pill; resume only when tapped. Nothing is more irritating than the view being yanked back.
- **Keep screen awake** while Follow Mode is active — and release the wakelock the instant the mode exits, or you've built a battery bug.
- Repeat engine: repeat ayah ×N → repeat range ×N → continue. Explicit state machine, not nested booleans. This doubles as the memorization feature.

*QA gate:* highlight stays within 150ms of audio across a full 20-minute surah, including after seeking, pausing, and backgrounding.

---

## 5. Data architecture — offline-first with optional cloud sync

**Decision.** Local SQLite is authoritative. The app is fully functional having never seen a network. Cloud sync is optional, additive, and arrives in v2.

Why not the alternatives:

- **Full cloud** is disqualified by Listen Mode — 8 hours of streaming will fail some nights across a wifi drop or carrier handoff, killing the core feature. It also bills you for popularity (~14MB per user per day at 64kbps; 10k users ≈ 4TB/month egress) on an app with no revenue, and it's useless in mosque basements, on flights, and during outages.
- **Cloud-required hybrid** (server authoritative, local cache) inherits most of those failure modes: first launch needs a connection, an expired token locks users out, and you still own uptime.
- **Pure offline with no sync path** is fine for v1 but loses bookmarks and notes when a phone dies, and people genuinely read on phone at night and desktop at a desk.

**Rules, to be written into `CLAUDE.md`:**

1. **No feature in the reading, playback, prayer-time, or qibla path may touch the network.** If a code path in Listen Mode or Follow Mode can `await` a request, it's a bug. Prayer times and qibla are computed locally from coordinates — never fetched from an API.
2. **v1 ships with no backend at all.** JSON export/import covers the backup need for zero infrastructure. Don't build auth before users ask for sync.
3. **Never host audio yourself.** The download manager pulls from existing free CDNs (everyayah.com, Quran Foundation). No bandwidth bill, no hosting liability.
4. **v2 sync covers user data only** — bookmarks, notes, khatmah, reciter and calculation preferences. Never content, never audio.
5. **Content packs are versioned downloads**, not app updates: tafsirs, translations, and the calendar event dataset (§9). A date correction then ships in hours instead of waiting on store review.

**Conflict resolution** when sync lands: last-write-wins per row for bookmarks and notes. **Khatmah progress merges as max-progress, not last-write** — otherwise reading on desktop and then opening your phone silently moves you backwards.

---

## 6. Data model

Sources: Tanzil (text), QUL / Quran Foundation (word-by-word + segments), everyayah.com (audio).

```sql
-- Quran core
surahs(id, name_ar, name_en, revelation_type, ayah_count, page_start)
ayahs(id, surah_id, ayah_no, text_uthmani, search_text, text_qcf, page, juz, sajda)
words(id, ayah_id, position, text_qcf, text_uthmani, translation_en, root)
reciters(id, name, style, bitrate, base_url, sync_tier)     -- A | B | C
audio_files(reciter_id, ayah_id, local_path, bytes, state)
ayah_timings(reciter_id, ayah_id, word_position, start_ms, end_ms)
playback_state(reciter_id, ayah_id, position_ms, updated_at)
translations / tafsirs(ayah_id, ...)        -- FTS5, downloaded on demand

-- User data (the only thing v2 sync touches)
bookmarks / favourites / notes / khatmah

-- Companion features
locations(id, label, lat, lng, timezone, is_current)
calc_settings(method_id, asr_factor, maghrib_rule, per_prayer_offsets_json, hijri_offset)
calendar_events(id, name_ar, name_en, category, importance, significance_text)
event_dates(id, event_id, hijri_month, hijri_day, variant_label, is_primary)
event_amaal(id, event_id, kind, title_ar, body_ar, source_note)
event_amaal_ayahs(amaal_id, surah_id, ayah_from, ayah_to)   -- links a'maal to the Quran
```

`search_text` = diacritics stripped, alef/hamza/ya forms normalized — computed **at ingest, never at query time**. People type without harakat.

Bundled at install: Quran text, one translation, word-by-word, calendar events. Downloaded on demand: tafsirs, all audio.

---

## 7. Prayer times — Shia (Jafari) primary

Computed **offline** from latitude/longitude. No API, no network. The `adhan` library handles the astronomy; the real work is in the settings.

**Default to Jafari.** Keep the other methods available — the sect difference is parameters, not a separate engine, so supporting them costs almost nothing and serves mixed households and travel:

| Parameter | Shia (Jafari) — default | Sunni (varies by method) |
| --- | --- | --- |
| Fajr angle | 16° | 18° (MWL), 15° (ISNA), 18.5° (Umm al-Qura) |
| Isha | 14° | 17°, or fixed 90 min after maghrib |
| Maghrib | Delayed past sunset (~4° below horizon, until redness passes) | At sunset |
| Asr shadow | 1× | 1× (Shafi/Maliki/Hanbali), 2× (Hanafi) |

**Maghrib is the parameter that matters most** and the one generic prayer apps get wrong for Shia users — sunset is not maghrib. Make the delay rule explicit and configurable (degrees below horizon, or a fixed minute offset), not buried.

**Three prayer times, five slots.** Shia practice commonly combines Dhuhr–Asr and Maghrib–Isha. The UI should present the five computed times but group them the way people actually pray, and show the permissible window for each rather than only a start instant — the window is what someone checks when they're running late.

**Also surface:** midnight (shar'i midnight, for the end of Isha and the start of the night prayer window), and the last third of the night for Tahajjud. Both are derived from the maghrib-to-fajr span, not from clock midnight.

**Settings that must exist:**

- Method picker (Jafari/Leva Institute Qom, Tehran, MWL, ISNA, Egyptian, Karachi, Umm al-Qura, custom angles). A sect selection *presets* the method; users can still override, because people disagree within sects.
- Per-prayer manual offsets in minutes — local mosques routinely differ from every calculation.
- Multiple saved locations, plus "current location". Needed for travel and for checking a family member's city.
- High-latitude rule (Angle-Based / One-Seventh / Middle of Night) — matters for users in Europe and Canada, where Fajr and Isha don't resolve in summer.

**Notifications:** scheduled locally, per-prayer on/off, with pre-alerts (N minutes before). Android 13+ needs exact-alarm permission and notification permission; iOS needs a rolling window of pre-scheduled alerts since you can't wake up to schedule them. Offer adhan audio, a short beep, or silent — and let the user pick the adhan recitation, since the Shia adhan includes phrases the Sunni adhan doesn't.

---

## 8. Qibla compass

Great-circle bearing from the user's position to the Kaaba (21.4225°N, 39.8262°E).

Two real problems, both of which most compass apps get wrong:

- **Magnetic vs true north.** The magnetometer reads magnetic north; the bearing is relative to *true* north. Apply magnetic declination for the user's location or the needle is off by up to ~20° in some regions.
- **Calibration drift.** Phone magnetometers wander near metal and electronics. Detect low sensor accuracy and show the figure-8 calibration prompt rather than displaying a confidently wrong direction.

Always display the **numeric bearing alongside the needle**, and a sun-position fallback ("at 14:32 today, the qibla is toward the sun's direction"). People pray in places where the magnetometer is unusable, and a number they can reason about beats a needle they can't trust.

**Desktop has no magnetometer.** Don't ship a fake needle — show a static map with the qibla line drawn from the user's location, plus the bearing in degrees.

---

## 9. Shia religious calendar

Hijri calendar with the Shia observance cycle, computed and stored locally.

**The correctness problem, first.** Arithmetic Hijri conversion (tabular or Umm al-Qura) can differ from the observed date by ±1 day, and Shia jurisprudence generally ties month beginnings to actual moon sighting, with rulings varying by marja'. So:

- Ship a **global Hijri offset setting (−2…+2 days)**, prominent, not buried in advanced settings.
- **Never present a computed date as authoritative for an obligation.** Ramadan's start, Eid al-Fitr and Eid al-Adha get a visible "subject to local sighting / your marja'" note. This is a correctness and trust issue, not a legal disclaimer — an app that confidently shows the wrong Eid loses its users permanently.
- Show the Hijri, Gregorian, and (optionally) Solar Hijri date together, since the audience spans Lebanon, Iraq, Iran and the diaspora.

**Event dataset structure.** Events are stored as Hijri month/day, and — importantly — **an event can have more than one date.** Several observances have differing narrations or are marked on more than one day (the martyrdom of Sayyida Fatima is observed on distinct dates by different traditions; the Prophet's birth is 17 Rabi' al-Awwal in Shia narration versus 12 in Sunni). Hence `event_dates` as a child table with a `variant_label` — not month/day columns on the event itself. Getting this wrong means a schema migration later.

**Categories to model:**

- **Mourning periods** — Muharram 1–10 (Ashura on the 10th), Arbaeen (20 Safar), the Fatimiyya days. These are *ranges*, not single days, and the app should know it's inside one.
- **Births and martyrdoms of the fourteen Ma'sumeen** — the backbone of the calendar.
- **Eids** — Fitr (1 Shawwal), Adha (10 Dhul-Hijjah), Ghadir (18 Dhul-Hijjah), Mubahala (24 Dhul-Hijjah).
- **Blessed nights** — the Laylat al-Qadr nights in Ramadan (19th, 21st, 23rd), Nisf Sha'ban (15 Sha'ban), Laylat al-Ragha'ib.
- **Recommended fasts** — Mab'ath (27 Rajab), the months of Rajab and Sha'ban, Ghadir, and the days it is *not* recommended to fast (Ashura is marked as mourning, not fasting-for-reward).

**A'maal linkage — this is where it connects to the rest of the app.** Many occasions carry recommended acts, including specific surahs and ayah ranges. `event_amaal_ayahs` lets the calendar deep-link straight into the reader or Listen Mode: tap "recommended for the night of the 23rd" and the queue is built. That linkage is the reason to build the calendar inside this app rather than telling users to install a separate one.

**Behavior:**

- Month grid + agenda list, with today prominent and the next significant event always visible.
- **Advance notifications**, configurable days ahead (a mourning day matters more with a day's notice than a morning-of ping).
- **Mourning-aware theming as an opt-in setting** — muted palette during Muharram and Safar and the Fatimiyya days. Opt-in, not forced: don't make an aesthetic decision on someone's behalf about how they observe.
- Home screen widget: today's Hijri date, next prayer, and any event today.

**Data sourcing — do not trust my list above as final.** The event dataset must be compiled from a scholarly source and reviewed by someone qualified before release; specific dates and which observances are marked vary by tradition and marja'. Ship it as a **versioned downloadable pack** (per §5, rule 5) so corrections reach users without a store release.

---

## 10. Phases

One feature per session, hard QA gate between phases.

**Phase 0 — Data pipeline.** Ingest script that builds the bundled SQLite DB from Tanzil + QUL in one command, reproducibly. No UI until this is right; everything downstream depends on the data being correct.

**Phase 1 — Reader.** Navigation (surah/juz/page), QCF Page View, Uthmani Reading View, night mode, last-position resume.
*Gate:* all 604 pages render with correct line breaks (screenshot diff against reference images).

**Phase 2 — Listen Mode.** Reciter picker, download manager, background service, sleep timer, tray/lockscreen controls, low-volume gain.
*Gate:* the 8-hour test above.

**Phase 3 — Follow Mode.** Segment loading, word highlight, auto-scroll, repeat engine, keep-awake.
*Gate:* the 150ms drift test above.

**Phase 4 — Study.** Translations, tafsir per ayah, word tap → translation + root, FTS search across Quran and tafsir.
*Gate:* undiacritized queries return correct results in <100ms on a cold DB.

**Phase 5 — Khatmah.** Daily-amount or date-range plans, progress ring, streak, daily ayah notification, JSON backup/restore.

**Phase 6 — Prayer times, Qibla, Calendar.** Large enough to split into three sessions:

- 6a Prayer times + settings + notifications.
  *Gate:* Jafari times match a trusted reference (e.g. Qom/Tehran published timetables) within one minute for Beirut, Najaf, Tehran and a high-latitude city, across a solstice and an equinox.
- 6b Qibla compass.
  *Gate:* bearing correct to within 2° against known values for several cities; low-accuracy state triggers the calibration prompt instead of showing a needle.
- 6c Shia calendar + a'maal + deep links into the reader.
  *Gate:* Hijri conversion matches a reference for the current and next two years; every event renders its date variants; a'maal deep-links build the right playback queue.

**Phase 7 — Desktop polish.** Two-page spread, keyboard shortcuts (←/→ page, space play/pause, `/` search), tray, media keys.

**v2 — Optional Supabase sync** for user data only. Not before offline-first is proven in production.

---

## 11. Layout adaptation

Not three designs — one design with breakpoints:

| Width | Layout |
| --- | --- |
| < 600 | Single page, bottom nav, sheet-based tafsir |
| 600–1000 | Single page + persistent side rail |
| > 1000 | Two-page spread + docked tafsir/translation panel |

Content-driven breakpoints, not device checks. A tablet in portrait and a small desktop window are the same case.

Each mode needs its own layout thinking at each width: Listen Mode is a large, dark, low-information now-playing screen (thumb-reachable on mobile, tray-driven on desktop); Follow Mode is text-dominant with minimal chrome; the calendar is a grid on wide screens and an agenda list on narrow ones.

---

## 12. Get right early

- **RTL is the default**, set at app root. LTR is the exception.
- **Verify licensing before bundling.** Quran text is free; specific tafsir translations and many recitation recordings are not. Tanzil and QUL state terms per asset — read them. This is what kills these apps at store review.
- **Religious content needs review, not just testing.** Prayer-time parameters, calendar dates, and a'maal text should be checked by someone qualified before release. A code bug is fixable; publishing a wrong Eid date is a trust problem.
- **No ads, no tracking.** Category expectation. Crash reporting only.
- **Location permission is the one permission that will cost you installs.** Ask for it at the moment prayer times or qibla are first opened, with a plain explanation, never at launch. Offer manual city entry as a first-class alternative — some users will refuse GPS on principle.
- **Install size:** QCF fonts + translation + word-by-word ≈ 60–80MB before any audio. Consider downloading the font pack on first launch to keep the store binary small.
- **Audio storage is the number that surprises people.** One reciter, full Quran at 64kbps ≈ 800MB–1.2GB. Surface per-reciter size estimates in the download manager and allow deletion by surah range.

---

## 13. First session

Set up `CLAUDE.md` (including the five offline-first rules from §5), scaffold the Flutter project with the schema above, and write the Phase 0 ingest script.

Confirm at that point **which reciters actually have Tier A segment data**. That list determines what Follow Mode can promise, and it's much better known before any UI exists than after.

Separately, and it can run in parallel: start sourcing the calendar event dataset. It needs a qualified review, which is a slower loop than code, so beginning it early keeps it off the critical path at Phase 6c.
