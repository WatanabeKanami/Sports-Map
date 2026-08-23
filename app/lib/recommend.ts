import {
  INDOOR_PREFERENCES,
  MOODS,
  type Activity,
  type ActivityRecommendation,
  type ActivitySetting,
  type GeoPoint,
  type Mood,
  type RecommendationInput,
  type RecommendationScoreBreakdown,
} from "./types.ts";
import { shouldExcludeFromRecommendations } from "./availability.ts";
import type { WBGTLevel } from "./wbgt.ts";

/** Maximum points available for each independently inspectable factor. */
export const RECOMMENDATION_SCORE_WEIGHTS = {
  distance: 30,
  time: 20,
  cost: 15,
  groupSize: 10,
  mood: 15,
  indoorPreference: 10,
  heatAdjustment: 0,
} as const satisfies RecommendationScoreBreakdown;

const DISTANCE_SCORE_LIMIT_KM = 10;
const RESULT_LIMIT = 3;

const moodLabels: Record<Mood, string> = {
  relax: "ゆるく動きたい",
  refresh: "気分転換したい",
  challenge: "しっかり挑戦したい",
  social: "みんなで楽しみたい",
};

const settingLabels: Record<Exclude<ActivitySetting, "both">, string> = {
  indoor: "屋内",
  outdoor: "屋外",
};

interface ReasonCandidate {
  points: number;
  order: number;
  text: string;
}

interface IndexedRecommendation {
  index: number;
  recommendation: ActivityRecommendation;
}

type ValidRecommendationInput = RecommendationInput & { location: GeoPoint };

/**
 * Scores activities without mutating input and returns at most three matches.
 * Confirmed constraint violations are rejected; unknown values earn no points
 * and are surfaced as warnings instead of being assumed to match.
 */
export function recommendActivities(
  activities: readonly Activity[],
  input: RecommendationInput,
  referenceDate = new Date(),
  wbgtLevel: WBGTLevel | null = null,
): ActivityRecommendation[] {
  if (!isValidInput(input)) {
    return [];
  }

  return activities
    .map((activity, index) =>
      scoreActivity(activity, input, index, referenceDate, wbgtLevel),
    )
    .filter((item): item is IndexedRecommendation => item !== null)
    .sort((left, right) => {
      const scoreDifference =
        right.recommendation.score - left.recommendation.score;

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const distanceDifference =
        left.recommendation.distanceKm - right.recommendation.distanceKm;

      return distanceDifference !== 0
        ? distanceDifference
        : left.index - right.index;
    })
    .slice(0, RESULT_LIMIT)
    .map(({ recommendation }) => recommendation);
}

function scoreActivity(
  activity: Activity,
  input: ValidRecommendationInput,
  index: number,
  referenceDate: Date,
  wbgtLevel: WBGTLevel | null,
): IndexedRecommendation | null {
  if (shouldExcludeFromRecommendations(activity, referenceDate)) {
    return null;
  }

  if (!isGeoPoint(activity.location)) {
    return null;
  }

  const warnings: string[] = [];
  const reasons: ReasonCandidate[] = [];
  const distanceKm = haversineDistanceKm(input.location, activity.location);
  const distance =
    RECOMMENDATION_SCORE_WEIGHTS.distance *
    Math.max(0, 1 - distanceKm / DISTANCE_SCORE_LIMIT_KM);

  if (distance > 0) {
    reasons.push({
      points: distance,
      order: 0,
      text: `現在地から${formatDistance(distanceKm)}`,
    });
  }

  const duration = validPositiveNumber(activity.durationMinutes);
  let time = 0;

  if (duration === null) {
    warnings.push("所要時間は未確認です。公式情報を確認してください。");
  } else {
    if (duration > input.timeMinutes) {
      return null;
    }

    time =
      RECOMMENDATION_SCORE_WEIGHTS.time * (duration / input.timeMinutes);
    reasons.push({
      points: time,
      order: 1,
      text: `${formatNumber(duration)}分で時間内に楽しめる`,
    });
  }

  const costYen = validNonNegativeNumber(activity.costYen);
  let cost = 0;

  if (costYen === null) {
    warnings.push("料金は未確認です。予算内か公式情報を確認してください。");
  } else {
    if (costYen > input.budget) {
      return null;
    }

    cost =
      input.budget === 0
        ? RECOMMENDATION_SCORE_WEIGHTS.cost
        : 5 + 10 * (1 - costYen / input.budget);
    reasons.push({
      points: cost,
      order: 2,
      text: costYen === 0 ? "無料で楽しめる" : `${formatNumber(costYen)}円で予算内`,
    });
  }

  const minGroupSize = validPositiveInteger(activity.minGroupSize);
  const maxGroupSize = validPositiveInteger(activity.maxGroupSize);
  let groupSize = 0;

  if (
    minGroupSize !== null &&
    maxGroupSize !== null &&
    minGroupSize > maxGroupSize
  ) {
    return null;
  }

  if (minGroupSize !== null && input.groupSize < minGroupSize) {
    return null;
  }

  if (maxGroupSize !== null && input.groupSize > maxGroupSize) {
    return null;
  }

  if (minGroupSize === null || maxGroupSize === null) {
    warnings.push("対応人数は一部未確認です。利用条件を確認してください。");
  } else {
    const idealGroupSize = validPositiveInteger(activity.idealGroupSize);
    const distanceFromIdeal =
      idealGroupSize !== null &&
      idealGroupSize >= minGroupSize &&
      idealGroupSize <= maxGroupSize
        ? Math.abs(input.groupSize - idealGroupSize)
        : 0;

    groupSize = Math.max(
      4,
      RECOMMENDATION_SCORE_WEIGHTS.groupSize - distanceFromIdeal * 2,
    );
    reasons.push({
      points: groupSize,
      order: 3,
      text: `${input.groupSize}人で楽しめる`,
    });
  }

  const hasMoodData = Array.isArray(activity.moods) && activity.moods.length > 0;
  const mood = activity.moods?.includes(input.mood)
    ? RECOMMENDATION_SCORE_WEIGHTS.mood
    : 0;

  if (!hasMoodData) {
    warnings.push("おすすめの気分は未確認です。");
  } else if (mood > 0) {
    reasons.push({
      points: mood,
      order: 4,
      text: `「${moodLabels[input.mood]}」気分に合う`,
    });
  }

  const setting = validActivitySetting(activity.setting);
  let indoorPreference = 0;
  let heatAdjustment = 0;

  if (setting === null) {
    warnings.push("屋内・屋外の区分は未確認です。");
  } else if (input.indoorPreference === "either") {
    indoorPreference = RECOMMENDATION_SCORE_WEIGHTS.indoorPreference;
  } else if (setting === input.indoorPreference || setting === "both") {
    indoorPreference = RECOMMENDATION_SCORE_WEIGHTS.indoorPreference;
    reasons.push({
      points: indoorPreference,
      order: 5,
      text: `${settingLabels[input.indoorPreference]}希望に合う`,
    });
  } else {
    return null;
  }

  if (wbgtLevel === "danger" && setting === "outdoor") return null;
  if (wbgtLevel === "warning" || wbgtLevel === "severe") {
    heatAdjustment = setting === "indoor" || setting === "both" ? 15 : -20;
    reasons.push({ points: Math.abs(heatAdjustment), order: 6, text: heatAdjustment > 0 ? "暑さを考慮して屋内を優先" : "暑さを考慮して屋外の順位を調整" });
  }

  const scoreBreakdown = roundBreakdown({
    distance,
    time,
    cost,
    groupSize,
    mood,
    indoorPreference,
    heatAdjustment,
  });
  const score = round(
    Object.values(scoreBreakdown).reduce((total, points) => total + points, 0),
  );
  const reasonTexts = reasons
    .sort((left, right) => right.points - left.points || left.order - right.order)
    .slice(0, 3)
    .map(({ text }) => text);

  if (reasonTexts.length === 0) {
    reasonTexts.push("確認できる条件が限られるため、詳細情報を確認してください");
  }

  return {
    index,
    recommendation: {
      activity,
      score,
      distanceKm: round(distanceKm),
      scoreBreakdown,
      reasons: reasonTexts,
      reason: reasonTexts.join("・"),
      warnings,
    },
  };
}

function isValidInput(
  input: RecommendationInput,
): input is ValidRecommendationInput {
  return (
    validPositiveNumber(input.timeMinutes) !== null &&
    validNonNegativeNumber(input.budget) !== null &&
    validPositiveInteger(input.groupSize) !== null &&
    MOODS.includes(input.mood) &&
    INDOOR_PREFERENCES.includes(input.indoorPreference) &&
    isGeoPoint(input.location)
  );
}

function isGeoPoint(value: GeoPoint | null | undefined): value is GeoPoint {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

function validPositiveNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function validNonNegativeNumber(
  value: number | null | undefined,
): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function validPositiveInteger(
  value: number | null | undefined,
): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function validActivitySetting(
  value: ActivitySetting | null | undefined,
): ActivitySetting | null {
  return value === "indoor" || value === "outdoor" || value === "both"
    ? value
    : null;
}

function haversineDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const earthRadiusKm = 6_371;
  const latitudeDifference = toRadians(to.latitude - from.latitude);
  const longitudeDifference = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function formatDistance(distanceKm: number): string {
  return distanceKm < 1
    ? `約${Math.max(10, Math.round((distanceKm * 1_000) / 10) * 10)}m`
    : `約${distanceKm.toFixed(1)}km`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(
    value,
  );
}

function roundBreakdown(
  breakdown: RecommendationScoreBreakdown,
): RecommendationScoreBreakdown {
  return {
    distance: round(breakdown.distance),
    time: round(breakdown.time),
    cost: round(breakdown.cost),
    groupSize: round(breakdown.groupSize),
    mood: round(breakdown.mood),
    indoorPreference: round(breakdown.indoorPreference),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
