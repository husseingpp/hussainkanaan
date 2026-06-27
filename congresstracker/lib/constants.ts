export const US_STATES = [
  { code: "AK", name: "Alaska" },
  { code: "AL", name: "Alabama" },
  { code: "AR", name: "Arkansas" },
  { code: "AZ", name: "Arizona" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DC", name: "D.C." },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "GU", name: "Guam" },
  { code: "HI", name: "Hawaii" },
  { code: "IA", name: "Iowa" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "MA", name: "Massachusetts" },
  { code: "MD", name: "Maryland" },
  { code: "ME", name: "Maine" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MO", name: "Missouri" },
  { code: "MP", name: "N. Mariana Islands" },
  { code: "MS", name: "Mississippi" },
  { code: "MT", name: "Montana" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "NE", name: "Nebraska" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NV", name: "Nevada" },
  { code: "NY", name: "New York" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "PR", name: "Puerto Rico" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VA", name: "Virginia" },
  { code: "VI", name: "Virgin Islands" },
  { code: "VT", name: "Vermont" },
  { code: "WA", name: "Washington" },
  { code: "WI", name: "Wisconsin" },
  { code: "WV", name: "West Virginia" },
  { code: "WY", name: "Wyoming" },
] as const;

export const PARTY_LABELS: Record<string, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
  ID: "Ind. Democrat",
  L: "Libertarian",
  Other: "Other",
};

export const CHAMBER_LABELS: Record<string, string> = {
  house: "House",
  senate: "Senate",
};

/** Display labels for the descriptive ideology wing (never pejorative). */
export const WING_LABELS: Record<string, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};

/**
 * The cutoff on DW-NOMINATE first dimension (liberal–conservative) used to
 * bucket the published score into a left / center / right wing for display.
 *
 * This is a presentation choice, NOT an invented score: the underlying number
 * comes from Voteview's DW-NOMINATE dataset and is always shown alongside the
 * wing so the bucketing is transparent. dim1 runs roughly -1 (most liberal) to
 * +1 (most conservative); members within ±this value of 0 are shown as Center.
 * Documented on /methodology.
 */
export const DW_NOMINATE_CENTER_THRESHOLD = 0.25;

/** The canonical source for the DW-NOMINATE ideology metric. */
export const VOTEVIEW_URL = "https://voteview.com";

/**
 * Promise lifecycle labels. `unverified` is the default and the only status a
 * non-reviewer (or a seed) may set; every other status is a reviewer judgement
 * that the schema requires to carry a reviewer + a status source.
 */
export const PROMISE_STATUS_LABELS: Record<string, string> = {
  unverified: "Unverified",
  kept: "Kept",
  broken: "Broken",
  partial: "Partial",
  stalled: "Stalled",
};

/** The set of statuses a reviewer can assign, in display order. */
export const PROMISE_STATUSES = [
  "unverified",
  "kept",
  "partial",
  "stalled",
  "broken",
] as const;

/** Congress N started in January of this year. */
export function congressStartYear(congress: number): number {
  return 1789 + (congress - 1) * 2;
}

/** The Congress number in session for a given date (defaults to today). */
export function currentCongress(date: Date = new Date()): number {
  // Each Congress spans two years starting in an odd year (the 1st began 1789).
  return Math.floor((date.getUTCFullYear() - 1789) / 2) + 1;
}

/** Short display labels for bill types (DB stores lowercase: "hr", "s", …). */
export const BILL_TYPE_LABELS: Record<string, string> = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
  hres: "H.Res.",
  sres: "S.Res.",
};

/** congress.gov web-URL path segment per bill type. */
const BILL_TYPE_URL_SEGMENT: Record<string, string> = {
  hr: "house-bill",
  s: "senate-bill",
  hjres: "house-joint-resolution",
  sjres: "senate-joint-resolution",
  hconres: "house-concurrent-resolution",
  sconres: "senate-concurrent-resolution",
  hres: "house-resolution",
  sres: "senate-resolution",
};

/** 1 -> "1st", 2 -> "2nd", 117 -> "117th". */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Build the public congress.gov URL for a bill, or null if type is unknown. */
export function congressGovBillUrl(
  congress: number,
  billType: string,
  number: number,
): string | null {
  const segment = BILL_TYPE_URL_SEGMENT[billType];
  if (!segment) return null;
  return `https://www.congress.gov/bill/${ordinal(congress)}-congress/${segment}/${number}`;
}
