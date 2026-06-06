/**
 * Open-Meteo is keyless and CORS/proxy-free — React Native calls it directly.
 * `skyScore` turns the forecast into a deterministic 0–100 "how good will the
 * sky look" heuristic. Pure formula, no AI.
 */
export type Weather = {
  temperature: number;
  cloudCover: number; // %
  windSpeed: number; // km/h
  humidity: number; // %
};

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export async function fetchWeather(lat: number, lng: number): Promise<Weather> {
  const url =
    `${ENDPOINT}?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const json = (await res.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      cloud_cover?: number;
      wind_speed_10m?: number;
    };
  };
  const c = json.current ?? {};
  return {
    temperature: c.temperature_2m ?? 0,
    cloudCover: c.cloud_cover ?? 0,
    windSpeed: c.wind_speed_10m ?? 0,
    humidity: c.relative_humidity_2m ?? 0,
  };
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * A little cloud is ideal (it catches colour); too much greys out, too little
 * is flat. Calm, drier air and mild temps help. Weighted blend, clamped 0–100.
 */
export function skyScore(w: Weather): number {
  const cloud = clamp(100 - Math.abs(w.cloudCover - 45) * 1.7);
  const wind = clamp(100 - w.windSpeed * 2.2);
  const humidity = clamp(100 - Math.abs(w.humidity - 55) * 1.1);
  const temp = clamp(100 - Math.abs(w.temperature - 18) * 1.8);
  const score = cloud * 0.5 + wind * 0.2 + humidity * 0.2 + temp * 0.1;
  return Math.round(clamp(score));
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Poor";
  return "Flat";
}
