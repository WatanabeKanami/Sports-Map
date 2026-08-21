import type { Activity, ClosureCalendarId } from "./types";

export type ActivityAvailabilityStatus =
  | "regularly-closed"
  | "activity-unavailable"
  | "schedule-check";

export interface ActivityAvailability {
  status: ActivityAvailabilityStatus;
  label: string;
  sourceUrl?: string | null;
}

interface ClosureCalendar {
  validFrom: string;
  validThrough: string;
  closedDates: ReadonlySet<string>;
}

const TOKYO_TIME_ZONE = "Asia/Tokyo";
const TOKYO_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000;

/**
 * Confirmed dates from the Koto Health and Sports Foundation's FY2026 list.
 * Holiday transfers are already reflected, so no separate holiday library is
 * needed. The same statutory second/fourth-Monday rule applies to the three
 * Yumenoshima facilities in the pilot data.
 *
 * https://www.koto-hsc.or.jp/news/令和8年度（2026年度）-休館日一覧/
 */
const KOTO_SPORTS_FY2026_CLOSED_DATES = new Set([
  "2026-04-13",
  "2026-04-27",
  "2026-05-11",
  "2026-05-25",
  "2026-06-08",
  "2026-06-22",
  "2026-07-13",
  "2026-07-27",
  "2026-08-10",
  "2026-08-24",
  "2026-09-14",
  "2026-09-28",
  "2026-10-13",
  "2026-10-26",
  "2026-11-09",
  "2026-11-24",
  "2026-12-14",
  "2026-12-28",
  "2027-01-12",
  "2027-01-25",
  "2027-02-08",
  "2027-02-22",
  "2027-03-08",
  "2027-03-23",
]);

const CLOSURE_CALENDARS: Record<ClosureCalendarId, ClosureCalendar> = {
  "koto-sports-fy2026": {
    validFrom: "2026-04-01",
    validThrough: "2027-03-31",
    closedDates: KOTO_SPORTS_FY2026_CLOSED_DATES,
  },
};

const tokyoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TOKYO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Returns a safe, activity-level availability status for the given instant. */
export function getActivityAvailability(
  activity: Activity,
  referenceDate = new Date(),
): ActivityAvailability {
  const date = getTokyoDateString(referenceDate);

  if (date === null) {
    return scheduleCheck(activity);
  }

  const unavailablePeriod = activity.unavailablePeriods?.find(
    (period) =>
      date >= period.startsOn &&
      (typeof period.endsOn !== "string" || date <= period.endsOn),
  );

  if (unavailablePeriod) {
    return {
      status: "activity-unavailable",
      label:
        unavailablePeriod.reviewOn &&
        date >= unavailablePeriod.reviewOn &&
        unavailablePeriod.reviewLabel
          ? unavailablePeriod.reviewLabel
          : unavailablePeriod.label,
      sourceUrl: unavailablePeriod.sourceUrl,
    };
  }

  const isAdditionalClosure = activity.additionalClosedPeriods?.some(
    (period) => date >= period.startsOn && date <= period.endsOn,
  );

  if (isAdditionalClosure) {
    return {
      status: "regularly-closed",
      label: "本日は休場日",
      sourceUrl: activity.closedDaySourceUrl,
    };
  }

  const calendar = activity.closureCalendarId
    ? CLOSURE_CALENDARS[activity.closureCalendarId]
    : null;

  if (
    calendar &&
    date >= calendar.validFrom &&
    date <= calendar.validThrough &&
    calendar.closedDates.has(date)
  ) {
    return {
      status: "regularly-closed",
      label: "本日は定例休館日",
      sourceUrl: activity.closedDaySourceUrl,
    };
  }

  return scheduleCheck(activity);
}

/** Closed and activity-specific suspension statuses are not recommendable. */
export function shouldExcludeFromRecommendations(
  activity: Activity,
  referenceDate = new Date(),
): boolean {
  return getActivityAvailability(activity, referenceDate).status !== "schedule-check";
}

/** Keeps a long-open tab in sync when the calendar day changes in Tokyo. */
export function millisecondsUntilNextTokyoDay(referenceDate = new Date()): number {
  const date = getTokyoDateString(referenceDate);

  if (date === null) {
    return 60 * 60 * 1_000;
  }

  const [year, month, day] = date.split("-").map(Number);
  const nextTokyoMidnight =
    Date.UTC(year, month - 1, day + 1) - TOKYO_OFFSET_MILLISECONDS;

  return Math.max(1_000, nextTokyoMidnight - referenceDate.getTime() + 1_000);
}

export function getTokyoDateString(referenceDate: Date): string | null {
  if (!Number.isFinite(referenceDate.getTime())) {
    return null;
  }

  const parts = tokyoDateFormatter.formatToParts(referenceDate);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function scheduleCheck(activity: Activity): ActivityAvailability {
  return {
    status: "schedule-check",
    label: activity.availabilityCheckLabel?.trim() || "本日の利用予定を確認",
  };
}
