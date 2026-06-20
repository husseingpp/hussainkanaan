import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import isoCountries from 'i18n-iso-countries';
import topoData from 'world-atlas/countries-110m.json';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export interface DetectedCountry {
  country_code: string;
  country_name: string;
}

// Lazily convert the countries-110m TopoJSON to GeoJSON exactly once.
let cachedFeatures: Feature<Geometry, { name: string }>[] | null = null;

function getFeatures(): Feature<Geometry, { name: string }>[] {
  if (cachedFeatures) return cachedFeatures;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = feature(topoData as any, (topoData as any).objects.countries) as unknown as FeatureCollection<
    Geometry,
    { name: string }
  >;
  cachedFeatures = fc.features;
  return cachedFeatures;
}

/**
 * Resolve a lat/lng to a country using point-in-polygon over the
 * countries-110m geometry. Returns null when the point is over ocean.
 */
export function detectCountry(lat: number, lng: number): DetectedCountry | null {
  const features = getFeatures();
  const match = features.find((f) => geoContains(f, [lng, lat]));
  if (!match) return null;

  const numericId = String(match.id ?? '').padStart(3, '0');
  const alpha3 = isoCountries.numericToAlpha3(numericId) ?? numericId;

  return {
    country_code: alpha3,
    country_name: match.properties.name,
  };
}
