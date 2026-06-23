// TypeScript shapes for NASA's EONET v3 API.
// Reference: https://eonet.gsfc.nasa.gov/docs/v3

export interface EonetCategory {
  id: string; // "wildfires"
  title: string; // "Wildfires"
  description?: string | null;
  link?: string;
}

export interface EonetSource {
  id: string;
  url: string;
}

// Geometry is usually a Point, occasionally a Polygon.
export interface EonetGeometry {
  magnitudeValue: number | null;
  magnitudeUnit: string | null;
  date: string; // ISO timestamp
  type: "Point" | "Polygon";
  // Point: [lng, lat]  |  Polygon: array of linear rings of [lng, lat]
  coordinates: number[] | number[][][];
}

export interface EonetEvent {
  id: string; // "EONET_xxxx"
  title: string;
  description: string | null;
  link: string;
  closed: string | null; // null = still open
  categories: EonetCategory[];
  sources: EonetSource[];
  geometry: EonetGeometry[]; // can have multiple points over time
}

export interface EonetEventsResponse {
  title: string;
  description: string;
  link: string;
  events: EonetEvent[];
}

export interface EonetCategoriesResponse {
  title: string;
  description: string;
  link: string;
  categories: EonetCategory[];
}
