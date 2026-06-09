-- Additive seed: ~18 well-known Lebanese golden-hour spots, inserted as
-- `approved` so they show on the map / Explore / portfolio widget out of the box.
--
-- Idempotent by design: each row is an `insert ... select ... where not exists`
-- keyed on `name`, so re-running this migration (or running it alongside the
-- original 12 seed rows) never creates duplicates.
--
-- Notes:
--  * `author_id` is left NULL — these are editorial seed spots, not user
--    submissions. This migration runs with elevated privilege so it bypasses the
--    `is_email_verified()` write policy.
--  * `average_rating` / `ratings_count` are set directly. The rating-aggregate
--    trigger only fires on `ratings` table writes, so these editorial values
--    persist until a real user rates the spot.
--  * `photo_urls[0]` uses Wikimedia Commons `Special:FilePath` — a stable
--    redirect to the current file at ~1280px. Any URL that can't resolve simply
--    falls back to the app's colored placeholder tile.

-- Raouché / Pigeon Rocks — Beirut's iconic offshore sea stacks, due west.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Raouché (Pigeon Rocks)',
       'Beirut''s landmark sea arches off the Corniche. The sun drops straight into the Mediterranean behind them — the city''s classic sunset.',
       33.8901, 35.4783, 'sunset', 'approved',
       array['May','June','July','August','September'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Pigeon%20Rocks%2C%20Beirut.jpg?width=1280'],
       4.8, 37
where not exists (select 1 from public.spots where name = 'Raouché (Pigeon Rocks)');

-- Beirut Corniche / Manara — the seafront promenade.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Beirut Corniche',
       'The Manara seafront promenade. Open western horizon over the sea, palm trees and the lighthouse make for an easy, reliable sunset walk.',
       33.9005, 35.4731, 'sunset', 'approved',
       array['April','May','June','July','August','September'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Beirut%20Corniche.jpg?width=1280'],
       4.4, 21
where not exists (select 1 from public.spots where name = 'Beirut Corniche');

-- Harissa — Our Lady of Lebanon, high above Jounieh Bay.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Harissa — Our Lady of Lebanon',
       'The hilltop shrine looks west over Jounieh Bay. Golden hour lights the statue and the whole curve of the coast; dusk brings the city lights.',
       33.9817, 35.6517, 'both', 'approved',
       array['May','June','July','August','September','October'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Our%20Lady%20of%20Lebanon%2C%20Harissa.jpg?width=1280'],
       4.7, 29
where not exists (select 1 from public.spots where name = 'Harissa — Our Lady of Lebanon');

-- Jounieh Bay.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Jounieh Bay',
       'A wide western bay north of Beirut. The waterfront and marina catch warm reflected light as the sun sets over the water.',
       33.9808, 35.6178, 'sunset', 'approved',
       array['May','June','July','August','September'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Jounieh%20Bay.jpg?width=1280'],
       4.3, 15
where not exists (select 1 from public.spots where name = 'Jounieh Bay');

-- Byblos (Jbeil) old harbour.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Byblos Old Harbour',
       'One of the oldest continuously inhabited towns on earth. The little Phoenician harbour and Crusader castle glow at sunset over the sea.',
       34.1208, 35.6450, 'sunset', 'approved',
       array['April','May','June','July','August','September','October'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Byblos%20port.jpg?width=1280'],
       4.6, 26
where not exists (select 1 from public.spots where name = 'Byblos Old Harbour');

-- Batroun — Phoenician sea wall.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Batroun Sea Wall',
       'The ancient Phoenician wall holds back the sea on Batroun''s old shore. Low tide pools and an open horizon make for a relaxed coastal sunset.',
       34.2553, 35.6581, 'sunset', 'approved',
       array['May','June','July','August','September'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Batroun.jpg?width=1280'],
       4.5, 18
where not exists (select 1 from public.spots where name = 'Batroun Sea Wall');

-- Tripoli Citadel.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Citadel of Tripoli',
       'The Citadel of Raymond de Saint-Gilles overlooks Lebanon''s second city. Warm evening light rakes across the old stone and rooftops.',
       34.4346, 35.8456, 'sunset', 'approved',
       array['April','May','June','September','October'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Citadel%20of%20Raymond%20de%20Saint-Gilles.jpg?width=1280'],
       4.2, 12
where not exists (select 1 from public.spots where name = 'Citadel of Tripoli');

-- The Cedars of God (Bsharri).
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'The Cedars of God',
       'Ancient cedar groves above Bsharri at ~2,000 m. First and last light on the trees and the high ridgeline is extraordinary — snow-dusted in winter.',
       34.2436, 36.0494, 'both', 'approved',
       array['June','July','August','September','October'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Cedars%20of%20God.jpg?width=1280'],
       4.9, 41
where not exists (select 1 from public.spots where name = 'The Cedars of God');

-- Qadisha Valley.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Qadisha Valley',
       'The Holy Valley''s deep gorge fills with mist at dawn. Sunrise spills over the eastern rim onto monasteries cut into the cliffs.',
       34.2500, 36.0000, 'sunrise', 'approved',
       array['May','June','July','August','September','October'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Kadisha%20Valley.jpg?width=1280'],
       4.7, 23
where not exists (select 1 from public.spots where name = 'Qadisha Valley');

-- Baalbek — Temple of Bacchus.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Baalbek Temples',
       'The colossal Roman temples of the Bekaa. Low morning sun throws long shadows down the colonnades of Bacchus and Jupiter.',
       34.0069, 36.2039, 'sunrise', 'approved',
       array['April','May','June','September','October'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Temple%20of%20Bacchus%2C%20Baalbek.jpg?width=1280'],
       4.8, 33
where not exists (select 1 from public.spots where name = 'Baalbek Temples');

-- Anjar — Umayyad city.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Anjar Ruins',
       'The 8th-century Umayyad city in the eastern Bekaa. Open, flat ruins with the Anti-Lebanon range behind — clean light at sunrise.',
       33.7269, 35.9319, 'sunrise', 'approved',
       array['April','May','June','September','October'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Anjar%2C%20Lebanon.jpg?width=1280'],
       4.3, 9
where not exists (select 1 from public.spots where name = 'Anjar Ruins');

-- Beiteddine Palace.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Beiteddine Palace',
       'An early-19th-century palace in the Chouf mountains. Courtyards and terraced gardens glow morning and evening above the valley.',
       33.6953, 35.5836, 'both', 'approved',
       array['May','June','July','August','September','October'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Beiteddine%20Palace.jpg?width=1280'],
       4.6, 20
where not exists (select 1 from public.spots where name = 'Beiteddine Palace');

-- Deir el Qamar.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Deir el Qamar',
       'A preserved 16th–18th-century town of ochre stone and red roofs in the Chouf. Warm light suits the old square and the valley views.',
       33.6953, 35.5614, 'both', 'approved',
       array['May','June','July','August','September','October'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Deir%20el%20Qamar.jpg?width=1280'],
       4.4, 14
where not exists (select 1 from public.spots where name = 'Deir el Qamar');

-- Moussa Castle.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Moussa Castle',
       'A quirky hand-built castle between Beiteddine and Deir el Qamar, framed by Chouf hills that catch first and last light.',
       33.6817, 35.5828, 'both', 'approved',
       array['May','June','July','August','September'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Moussa%20Castle.jpg?width=1280'],
       4.2, 8
where not exists (select 1 from public.spots where name = 'Moussa Castle');

-- Chouf Cedar Reserve (Barouk).
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Chouf Cedar Reserve',
       'Lebanon''s largest nature reserve, on the Barouk ridge. Cedar forest and long views over the Bekaa — superb at both ends of the day.',
       33.7000, 35.6900, 'both', 'approved',
       array['June','July','August','September','October'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Chouf%20Cedar%20Reserve.jpg?width=1280'],
       4.6, 19
where not exists (select 1 from public.spots where name = 'Chouf Cedar Reserve');

-- Tyre (Sour).
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Tyre Roman Ruins',
       'Seaside Roman remains on the southern coast — colonnaded road and hippodrome by the water. The sun sets over the Mediterranean beyond the columns.',
       33.2700, 35.1969, 'sunset', 'approved',
       array['May','June','July','August','September'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Tyre%2C%20Lebanon.jpg?width=1280'],
       4.5, 17
where not exists (select 1 from public.spots where name = 'Tyre Roman Ruins');

-- Sidon Sea Castle.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Sidon Sea Castle',
       'A 13th-century Crusader fort on a small island off Sidon''s old port, linked by a stone causeway. It sits dramatically against the sunset.',
       33.5631, 35.3689, 'sunset', 'approved',
       array['April','May','June','July','August','September'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Sidon%20Sea%20Castle.jpg?width=1280'],
       4.5, 22
where not exists (select 1 from public.spots where name = 'Sidon Sea Castle');

-- Faraya / Mzaar.
insert into public.spots (name, description, latitude, longitude, type, status, best_months, photo_urls, average_rating, ratings_count)
select 'Faraya Mzaar',
       'High Kesrouan slopes at ~2,000 m. Snowfields in winter and alpine meadows in summer take warm light beautifully at sunrise and sunset.',
       34.0000, 35.8333, 'both', 'approved',
       array['December','January','February','March','July','August'],
       array['https://commons.wikimedia.org/wiki/Special:FilePath/Mzaar%20Kfardebian.jpg?width=1280'],
       4.4, 16
where not exists (select 1 from public.spots where name = 'Faraya Mzaar');
