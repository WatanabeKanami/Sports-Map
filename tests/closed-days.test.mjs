import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getActivityAvailability,
  getTokyoDateString,
  millisecondsUntilNextTokyoDay,
  shouldExcludeFromRecommendations,
} from "../app/lib/availability.ts";
import { recommendActivities } from "../app/lib/recommend.ts";

const activities = JSON.parse(
  await readFile(new URL("../public/data/activities.json", import.meta.url), "utf8"),
);

function activity(id) {
  const match = activities.find((item) => item.id === id);
  assert.ok(match, `Missing test activity: ${id}`);
  return match;
}

test("uses the official FY2026 closure calendar instead of fixed today flags", () => {
  assert.ok(activities.every((item) => !("todayAvailability" in item)));
  assert.ok(activities.every((item) => !("todayAvailabilityLabel" in item)));
  assert.ok(
    activities.every(
      (item) =>
        item.closureCalendarId === "koto-sports-fy2026" &&
        item.closedDayNote.includes("第2・第4月曜日") &&
        item.closedDayVerifiedAt === "2026-08-21",
    ),
  );
});

test("treats 2026-08-21 as a schedule check, not an asserted opening", () => {
  const sportsHall = activity("koto-sports-hall-training");
  const availability = getActivityAvailability(
    sportsHall,
    new Date("2026-08-21T03:00:00.000Z"),
  );

  assert.deepEqual(availability, {
    status: "schedule-check",
    label: "本日の利用予定を確認",
  });
  assert.equal(shouldExcludeFromRecommendations(sportsHall, new Date("2026-08-21T03:00:00.000Z")), false);
});

test("recognizes confirmed and holiday-transferred closure dates in Tokyo", () => {
  const sportsHall = activity("koto-sports-hall-training");

  assert.equal(
    getActivityAvailability(sportsHall, new Date("2026-08-23T15:01:00.000Z")).status,
    "regularly-closed",
  );
  assert.equal(
    getActivityAvailability(sportsHall, new Date("2026-10-13T03:00:00.000Z")).status,
    "regularly-closed",
  );
  assert.equal(
    getActivityAvailability(sportsHall, new Date("2026-10-12T03:00:00.000Z")).status,
    "schedule-check",
  );
  assert.equal(
    shouldExcludeFromRecommendations(sportsHall, new Date("2026-08-24T03:00:00.000Z")),
    true,
  );
});

test("excludes a currently suspended activity without marking the whole facility closed", () => {
  const ariakeBasketball = activity("ariake-sports-center-basketball");
  const availability = getActivityAvailability(
    ariakeBasketball,
    new Date("2026-08-21T03:00:00.000Z"),
  );

  assert.equal(availability.status, "activity-unavailable");
  assert.equal(availability.label, "大体育室は改修工事で利用休止中");
  assert.match(availability.sourceUrl, /^https:\/\/www\.koto-hsc\.or\.jp\//);
  assert.equal(
    getActivityAvailability(
      ariakeBasketball,
      new Date("2026-10-15T03:00:00.000Z"),
    ).status,
    "activity-unavailable",
  );
  assert.equal(
    getActivityAvailability(
      ariakeBasketball,
      new Date("2026-10-15T03:00:00.000Z"),
    ).label,
    "大体育室の再開状況を公式確認",
  );
});

test("keeps confirmed Yumenoshima year-end closures separate from indoor guidance", () => {
  const running = activity("yumenoshima-stadium-running");
  const sportsHall = activity("koto-sports-hall-training");
  const newYearsEve = new Date("2026-12-31T03:00:00.000Z");

  assert.equal(
    getActivityAvailability(running, newYearsEve).status,
    "regularly-closed",
  );
  assert.equal(
    getActivityAvailability(sportsHall, newYearsEve).status,
    "schedule-check",
  );
});

test("recommendations integrate the closure and suspension checks", () => {
  const sportsHall = activity("koto-sports-hall-training");
  const ariakeBasketball = activity("ariake-sports-center-basketball");
  const input = {
    timeMinutes: 60,
    budget: 500,
    groupSize: 2,
    mood: "challenge",
    indoorPreference: "either",
    location: { latitude: 35.6762, longitude: 139.8171 },
  };

  assert.deepEqual(
    recommendActivities(
      [sportsHall, ariakeBasketball],
      input,
      new Date("2026-08-21T03:00:00.000Z"),
    ).map(({ activity: item }) => item.id),
    [sportsHall.id],
  );
  assert.deepEqual(
    recommendActivities(
      [sportsHall],
      input,
      new Date("2026-08-24T03:00:00.000Z"),
    ),
    [],
  );
});

test("handles the Tokyo date boundary and calendar expiry safely", () => {
  const sportsHall = activity("koto-sports-hall-training");
  const beforeTokyoMidnight = new Date("2026-08-23T14:59:00.000Z");
  const afterTokyoMidnight = new Date("2026-08-23T15:01:00.000Z");

  assert.equal(getTokyoDateString(beforeTokyoMidnight), "2026-08-23");
  assert.equal(getTokyoDateString(afterTokyoMidnight), "2026-08-24");
  assert.ok(millisecondsUntilNextTokyoDay(beforeTokyoMidnight) > 0);
  assert.equal(
    getActivityAvailability(sportsHall, new Date("2027-04-12T03:00:00.000Z")).status,
    "schedule-check",
  );
});
