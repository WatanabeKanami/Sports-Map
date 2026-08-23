export const MOODS = ["relax", "refresh", "challenge", "social"] as const;

export type Mood = (typeof MOODS)[number];

export const INDOOR_PREFERENCES = ["indoor", "outdoor", "either"] as const;

export type IndoorPreference = (typeof INDOOR_PREFERENCES)[number];
export type ActivitySetting = "indoor" | "outdoor" | "both";
export type ClosureCalendarId = "koto-sports-fy2026";

export interface ClosedDatePeriod {
  startsOn: string;
  endsOn: string;
}

export interface ActivityUnavailablePeriod {
  startsOn: string;
  /** Omit until an official reopening date is confirmed. */
  endsOn?: string | null;
  reviewOn?: string | null;
  label: string;
  reviewLabel?: string | null;
  sourceUrl: string;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface OperatingHours {
  opensAt: string;
  closesAt: string;
}

/** A recommendable activity. Nullable fields represent unverified source data. */
export interface Activity {
  id: string;
  name: string;
  location?: GeoPoint | null;
  operatingHours?: OperatingHours | null;
  durationMinutes?: number | null;
  costYen?: number | null;
  minGroupSize?: number | null;
  maxGroupSize?: number | null;
  idealGroupSize?: number | null;
  moods?: readonly Mood[] | null;
  setting?: ActivitySetting | null;
  description?: string | null;
  facilityName?: string | null;
  category?: string | null;
  address?: string | null;
  priceCategory?: string | null;
  priceNote?: string | null;
  priceAmountYen?: number | null;
  priceUnit?: string | null;
  priceSourceUrl?: string | null;
  closureCalendarId?: ClosureCalendarId | null;
  availabilityCheckLabel?: string | null;
  closedDayNote?: string | null;
  closedDaySourceUrl?: string | null;
  closedDayVerifiedAt?: string | null;
  additionalClosedPeriods?: readonly ClosedDatePeriod[] | null;
  unavailablePeriods?: readonly ActivityUnavailablePeriod[] | null;
  sourceUrl?: string | null;
  sourceDatasetName?: string | null;
  sourceDatasetUrl?: string | null;
  license?: string | null;
  verifiedAt?: string | null;
  demoFields?: readonly string[] | null;
  warnings?: readonly string[] | null;
}

export const SUPPORT_CATEGORIES = ["water", "cooling", "toilet", "aed"] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export interface SupportSpot {
  id: string;
  name: string;
  category: SupportCategory;
  location: GeoPoint;
  address: string;
  details: string;
  hoursNote?: string | null;
  priceCategory?: string | null;
  priceNote?: string | null;
  wheelchairAccessible?: boolean | null;
  sourceUrl: string;
  sourceDatasetName: string;
  sourceDatasetUrl: string;
  license: string;
  verifiedAt: string;
  warnings?: readonly string[] | null;
}

/** Conditions selected by the user. Budget is the per-person amount in yen. */
export interface RecommendationInput {
  timeMinutes: number;
  budget: number;
  groupSize: number;
  mood: Mood;
  indoorPreference: IndoorPreference;
  location: GeoPoint | null;
}

export interface RecommendationScoreBreakdown {
  distance: number;
  time: number;
  cost: number;
  groupSize: number;
  mood: number;
  indoorPreference: number;
  heatAdjustment: number;
}

/** A ranked activity with an explainable score and data-quality warnings. */
export interface ActivityRecommendation {
  activity: Activity;
  score: number;
  distanceKm: number | null;
  travel?: {
    walkingMinutes: number;
    arrivalAt: string;
    availableUntil: string;
    requestedMinutes: number;
  };
  scoreBreakdown: RecommendationScoreBreakdown;
  reasons: string[];
  reason: string;
  warnings: string[];
}
