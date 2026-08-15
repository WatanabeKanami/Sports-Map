import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the いまスポ landing screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>いまスポ/);
  assert.match(html, /「運動したい」を/);
  assert.match(html, /江東区 PILOT/);
  assert.match(html, /この条件で3つ提案してもらう/);
  assert.match(html, /データについて/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships validated pilot data and no disposable preview", async () => {
  const [activitiesText, supportText, attribution] = await Promise.all([
    readFile(new URL("../public/data/activities.json", import.meta.url), "utf8"),
    readFile(new URL("../public/data/support-spots.json", import.meta.url), "utf8"),
    readFile(new URL("../public/data/ATTRIBUTION.md", import.meta.url), "utf8"),
  ]);

  const activities = JSON.parse(activitiesText);
  const supportSpots = JSON.parse(supportText);
  assert.equal(activities.length, 8);
  assert.equal(supportSpots.length, 10);
  assert.ok(activities.every((item) => item.location?.latitude && item.location?.longitude));
  assert.deepEqual(
    [...new Set(supportSpots.map((item) => item.category))].sort(),
    ["aed", "cooling", "toilet", "water"],
  );
  assert.match(attribution, /CC BY 4\.0/);
  assert.match(attribution, /2026-08-15/);

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
