/**
 * Seed script — populates the facts table with 50 historical locations.
 * Fetches body text from the Wikipedia REST API summary endpoint.
 *
 * Usage (run once from atlas-of-history/):
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/seed.ts
 *
 * The service role key bypasses RLS so inserts work without a login session.
 * Find it at: Supabase Dashboard → Project → Settings → API → service_role key.
 * NEVER commit this key.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ltidmmvudancwnrxglud.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var before running.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface Location {
  title: string;
  slug: string; // Wikipedia article slug
  lat: number;
  lng: number;
  year: number | null;
  country_code: string;
  country_name: string;
}

const locations: Location[] = [
  { title: 'Great Pyramid of Giza', slug: 'Great_Pyramid_of_Giza', lat: 29.9792, lng: 31.1342, year: -2560, country_code: 'EGY', country_name: 'Egypt' },
  { title: 'Colosseum', slug: 'Colosseum', lat: 41.8902, lng: 12.4922, year: 80, country_code: 'ITA', country_name: 'Italy' },
  { title: 'Machu Picchu', slug: 'Machu_Picchu', lat: -13.1631, lng: -72.5449, year: 1450, country_code: 'PER', country_name: 'Peru' },
  { title: 'Angkor Wat', slug: 'Angkor_Wat', lat: 13.4125, lng: 103.8670, year: 1150, country_code: 'KHM', country_name: 'Cambodia' },
  { title: 'Stonehenge', slug: 'Stonehenge', lat: 51.1789, lng: -1.8262, year: -2500, country_code: 'GBR', country_name: 'United Kingdom' },
  { title: 'Parthenon', slug: 'Parthenon', lat: 37.9715, lng: 23.7267, year: -432, country_code: 'GRC', country_name: 'Greece' },
  { title: 'Great Wall of China', slug: 'Great_Wall_of_China', lat: 40.4319, lng: 116.5704, year: -221, country_code: 'CHN', country_name: 'China' },
  { title: 'Pompeii', slug: 'Pompeii', lat: 40.7512, lng: 14.4989, year: 79, country_code: 'ITA', country_name: 'Italy' },
  { title: 'Teotihuacan', slug: 'Teotihuacan', lat: 19.6925, lng: -98.8438, year: 100, country_code: 'MEX', country_name: 'Mexico' },
  { title: 'Easter Island', slug: 'Easter_Island', lat: -27.1127, lng: -109.3497, year: 1200, country_code: 'CHL', country_name: 'Chile' },
  { title: 'Ancient Troy', slug: 'Troy', lat: 39.9574, lng: 26.2385, year: -1200, country_code: 'TUR', country_name: 'Turkey' },
  { title: 'Battle of Waterloo', slug: 'Battle_of_Waterloo', lat: 50.6800, lng: 4.4100, year: 1815, country_code: 'BEL', country_name: 'Belgium' },
  { title: 'Battle of Thermopylae', slug: 'Battle_of_Thermopylae', lat: 38.7986, lng: 22.5350, year: -480, country_code: 'GRC', country_name: 'Greece' },
  { title: 'Palace of Versailles', slug: 'Palace_of_Versailles', lat: 48.8049, lng: 2.1204, year: 1682, country_code: 'FRA', country_name: 'France' },
  { title: 'Hiroshima Peace Memorial', slug: 'Hiroshima_Peace_Memorial', lat: 34.3955, lng: 132.4536, year: 1945, country_code: 'JPN', country_name: 'Japan' },
  { title: 'Berlin Wall', slug: 'Berlin_Wall', lat: 52.5359, lng: 13.3910, year: 1961, country_code: 'DEU', country_name: 'Germany' },
  { title: 'Battle of Gettysburg', slug: 'Battle_of_Gettysburg', lat: 39.8309, lng: -77.2311, year: 1863, country_code: 'USA', country_name: 'United States' },
  { title: 'Normandy Landings', slug: 'Normandy_landings', lat: 49.3700, lng: -0.8600, year: 1944, country_code: 'FRA', country_name: 'France' },
  { title: 'Library of Alexandria', slug: 'Library_of_Alexandria', lat: 31.2001, lng: 29.9187, year: -300, country_code: 'EGY', country_name: 'Egypt' },
  { title: 'Hagia Sophia', slug: 'Hagia_Sophia', lat: 41.0086, lng: 28.9802, year: 537, country_code: 'TUR', country_name: 'Turkey' },
  { title: 'Tikal', slug: 'Tikal', lat: 17.2220, lng: -89.6237, year: 400, country_code: 'GTM', country_name: 'Guatemala' },
  { title: 'Chichen Itza', slug: 'Chichen_Itza', lat: 20.6843, lng: -88.5678, year: 900, country_code: 'MEX', country_name: 'Mexico' },
  { title: 'Carthage', slug: 'Carthage', lat: 36.8520, lng: 10.3230, year: -814, country_code: 'TUN', country_name: 'Tunisia' },
  { title: 'Babylon', slug: 'Babylon', lat: 32.5430, lng: 44.4215, year: -1800, country_code: 'IRQ', country_name: 'Iraq' },
  { title: 'Persepolis', slug: 'Persepolis', lat: 29.9350, lng: 52.8911, year: -518, country_code: 'IRN', country_name: 'Iran' },
  { title: 'Mohenjo-daro', slug: 'Mohenjo-daro', lat: 27.3284, lng: 68.1385, year: -2500, country_code: 'PAK', country_name: 'Pakistan' },
  { title: 'Great Zimbabwe', slug: 'Great_Zimbabwe', lat: -20.2671, lng: 30.9337, year: 1200, country_code: 'ZWE', country_name: 'Zimbabwe' },
  { title: 'Timbuktu', slug: 'Timbuktu', lat: 16.7666, lng: -3.0026, year: 1100, country_code: 'MLI', country_name: 'Mali' },
  { title: 'Lascaux Cave', slug: 'Lascaux', lat: 45.0546, lng: 1.0827, year: -17000, country_code: 'FRA', country_name: 'France' },
  { title: 'Çatalhöyük', slug: 'Çatalhöyük', lat: 37.6677, lng: 32.8272, year: -7500, country_code: 'TUR', country_name: 'Turkey' },
  { title: 'Ephesus', slug: 'Ephesus', lat: 37.9390, lng: 27.3413, year: -1000, country_code: 'TUR', country_name: 'Turkey' },
  { title: 'Oracle of Delphi', slug: 'Delphi', lat: 38.4824, lng: 22.5012, year: -800, country_code: 'GRC', country_name: 'Greece' },
  { title: 'Masada', slug: 'Masada', lat: 31.3146, lng: 35.3536, year: 73, country_code: 'ISR', country_name: 'Israel' },
  { title: 'Petra', slug: 'Petra,_Jordan', lat: 30.3285, lng: 35.4444, year: -300, country_code: 'JOR', country_name: 'Jordan' },
  { title: 'Borobudur', slug: 'Borobudur', lat: -7.6079, lng: 110.2038, year: 825, country_code: 'IDN', country_name: 'Indonesia' },
  { title: 'Lalibela', slug: 'Lalibela', lat: 12.0319, lng: 39.0474, year: 1200, country_code: 'ETH', country_name: 'Ethiopia' },
  { title: 'Tenochtitlan', slug: 'Tenochtitlan', lat: 19.4326, lng: -99.1332, year: 1325, country_code: 'MEX', country_name: 'Mexico' },
  { title: 'Samarkand', slug: 'Samarkand', lat: 39.6547, lng: 66.9758, year: 700, country_code: 'UZB', country_name: 'Uzbekistan' },
  { title: 'Ur', slug: 'Ur', lat: 30.9610, lng: 46.1033, year: -2600, country_code: 'IRQ', country_name: 'Iraq' },
  { title: 'Battle of Hastings', slug: 'Battle_of_Hastings', lat: 50.9100, lng: 0.4892, year: 1066, country_code: 'GBR', country_name: 'United Kingdom' },
  { title: 'Gallipoli Campaign', slug: 'Gallipoli_campaign', lat: 40.3513, lng: 26.4611, year: 1915, country_code: 'TUR', country_name: 'Turkey' },
  { title: 'Chernobyl Disaster', slug: 'Chernobyl_disaster', lat: 51.3890, lng: 30.0993, year: 1986, country_code: 'UKR', country_name: 'Ukraine' },
  { title: 'Auschwitz Concentration Camp', slug: 'Auschwitz_concentration_camp', lat: 50.0343, lng: 19.1784, year: 1940, country_code: 'POL', country_name: 'Poland' },
  { title: 'Wounded Knee Massacre', slug: 'Wounded_Knee_Massacre', lat: 43.1509, lng: -102.3682, year: 1890, country_code: 'USA', country_name: 'United States' },
  { title: 'Appomattox Court House', slug: 'Appomattox_Court_House_National_Historical_Park', lat: 37.3634, lng: -78.7987, year: 1865, country_code: 'USA', country_name: 'United States' },
  { title: 'Mesa Verde', slug: 'Mesa_Verde_National_Park', lat: 37.1853, lng: -108.4862, year: 1200, country_code: 'USA', country_name: 'United States' },
  { title: "Hadrian's Wall", slug: "Hadrian%27s_Wall", lat: 54.9893, lng: -2.6087, year: 122, country_code: 'GBR', country_name: 'United Kingdom' },
  { title: 'Ancient Olympia', slug: 'Olympia,_Greece', lat: 37.6379, lng: 21.6300, year: -776, country_code: 'GRC', country_name: 'Greece' },
  { title: 'Fall of Constantinople', slug: 'Fall_of_Constantinople', lat: 41.0082, lng: 28.9784, year: 1453, country_code: 'TUR', country_name: 'Turkey' },
  { title: 'Alhambra', slug: 'Alhambra', lat: 37.1760, lng: -3.5881, year: 1238, country_code: 'ESP', country_name: 'Spain' },
];

async function fetchSummary(slug: string): Promise<string> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`,
      { headers: { 'User-Agent': 'AtlasOfHistory/1.0 (kanaanbh@gmail.com)' } },
    );
    if (!res.ok) return '';
    const data = (await res.json()) as { extract?: string };
    return (data.extract ?? '').substring(0, 800);
  } catch {
    return '';
  }
}

async function seed() {
  console.log(`Seeding ${locations.length} facts…\n`);
  let ok = 0;
  let fail = 0;

  for (const loc of locations) {
    const body = await fetchSummary(loc.slug);
    if (!body) {
      console.warn(`⚠  No Wikipedia summary for ${loc.title} (slug: ${loc.slug})`);
    }

    const { error } = await supabase.from('facts').upsert(
      {
        title: loc.title,
        body: body || loc.title,
        lat: loc.lat,
        lng: loc.lng,
        year: loc.year,
        country_code: loc.country_code,
        country_name: loc.country_name,
        reference_url: `https://en.wikipedia.org/wiki/${loc.slug}`,
        reference_label: 'Wikipedia',
        created_by: null,
      },
      { onConflict: 'id' },
    );

    if (error) {
      console.error(`✗ ${loc.title}: ${error.message}`);
      fail++;
    } else {
      console.log(`✓ ${loc.title}`);
      ok++;
    }

    // Be polite to the Wikipedia API
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone — ${ok} inserted, ${fail} failed.`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
