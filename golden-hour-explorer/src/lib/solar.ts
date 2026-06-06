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

export const fmtTime = (d: Date): string => {
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "HH:mm");
};
