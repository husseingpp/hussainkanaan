import SunCalc from "suncalc";
import { format } from "date-fns";

export type SolarTimes = {
  dawn: Date;
  sunrise: Date;
  /** End of the morning golden hour. */
  morningGoldenEnd: Date;
  /** Start of the evening golden hour. */
  eveningGoldenStart: Date;
  sunset: Date;
  dusk: Date;
};

/** Sunrise/sunset and golden-hour windows for a coordinate + date (local math). */
export function getSolarTimes(lat: number, lng: number, date: Date = new Date()): SolarTimes {
  const t = SunCalc.getTimes(date, lat, lng);
  return {
    dawn: t.dawn,
    sunrise: t.sunrise,
    morningGoldenEnd: t.goldenHourEnd,
    eveningGoldenStart: t.goldenHour,
    sunset: t.sunset,
    dusk: t.dusk,
  };
}

/** The next upcoming golden-hour boundary from `now`, used for alerts. */
export function nextGoldenHour(
  lat: number,
  lng: number,
  now: Date = new Date(),
): { label: string; at: Date } | null {
  const today = getSolarTimes(lat, lng, now);
  const tomorrow = getSolarTimes(lat, lng, new Date(now.getTime() + 86400000));
  const candidates: { label: string; at: Date }[] = [
    { label: "Sunrise golden hour", at: today.sunrise },
    { label: "Sunset golden hour", at: today.eveningGoldenStart },
    { label: "Sunrise golden hour", at: tomorrow.sunrise },
  ];
  for (const c of candidates) {
    if (c.at.getTime() > now.getTime()) return c;
  }
  return null;
}

/**
 * The next sun event — sunrise or sunset, whichever comes first from `now`.
 * Looks across today and tomorrow and returns the soonest upcoming one, so the
 * header countdown flips from "next sunrise" to "next sunset" as the day turns.
 */
export function nextSunEvent(
  lat: number,
  lng: number,
  now: Date = new Date(),
): { kind: "sunrise" | "sunset"; at: Date } | null {
  const today = getSolarTimes(lat, lng, now);
  const tomorrow = getSolarTimes(lat, lng, new Date(now.getTime() + 86_400_000));
  const candidates: { kind: "sunrise" | "sunset"; at: Date }[] = [
    { kind: "sunrise", at: today.sunrise },
    { kind: "sunset", at: today.sunset },
    { kind: "sunrise", at: tomorrow.sunrise },
    { kind: "sunset", at: tomorrow.sunset },
  ];
  return (
    candidates
      .filter((c) => Number.isFinite(c.at.getTime()) && c.at.getTime() > now.getTime())
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null
  );
}

export const fmtTime = (d: Date): string => {
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "HH:mm");
};
