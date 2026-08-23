export type WBGTLevel = "safe" | "caution" | "warning" | "severe" | "danger";

export interface TokyoWBGT {
  value: number;
  observedAt: string;
  level: WBGTLevel;
}

const API_URL = "https://www.wbgt.env.go.jp/api/v1/getSurveyData";

export function getWBGTLevel(value: number): WBGTLevel {
  if (value < 21) return "safe";
  if (value < 25) return "caution";
  if (value < 28) return "warning";
  if (value < 31) return "severe";
  return "danger";
}

export function getWBGTLevelLabel(level: WBGTLevel): string {
  return { safe: "ほぼ安全", caution: "注意", warning: "警戒", severe: "厳重警戒", danger: "危険" }[level];
}

export function getWBGTAdvice(level: WBGTLevel): string {
  if (level === "safe" || level === "caution") return "現在の暑さなら屋外施設もおすすめです。こまめに水分をとりましょう。";
  if (level === "warning") return "暑くなってきているため、休憩と給水がしやすい施設を優先します。";
  if (level === "severe") return "暑さが厳しいため、屋内施設を優先します。給水と休憩を忘れずに。";
  return "危険な暑さです。屋外運動は控え、空調のある屋内で無理なく過ごしてください。";
}

export async function fetchTokyoWBGT(signal?: AbortSignal): Promise<TokyoWBGT> {
  const now = new Date();
  const url = new URL(API_URL);
  url.searchParams.set("data_type", "0");
  url.searchParams.set("location_type", "2");
  url.searchParams.set("pref_cds", "13");
  url.searchParams.set("date_from", formatTokyoDateTime(new Date(now.getTime() - 3 * 60 * 60 * 1000)));
  url.searchParams.set("date_to", formatTokyoDateTime(now));

  const response = await fetch(url.toString(), { signal });

  if (!response.ok) {
    throw new Error("WBGTデータの取得に失敗しました");
  }

  const payload = (await response.json()) as { status?: string; data?: unknown };
  if (payload.status !== "success" || !Array.isArray(payload.data)) {
    throw new Error("WBGT実況データを取得できませんでした");
  }

  const records = payload.data
    .filter(isSurveyRecord)
    .filter(({ wbgt_WO }) => wbgt_WO !== null && String(wbgt_WO).trim() !== "")
    .map((record) => ({ ...record, value: Number(record.wbgt_WO), time: parseTokyoDateTime(record.wbgt_date) }))
    .filter(({ value, time }) => Number.isFinite(value) && value >= 0 && value <= 60 && Number.isFinite(time));
  const latestTime = Math.max(...records.map(({ time }) => time));
  const latest = records.filter(({ time }) => time === latestTime);
  if (latest.length === 0) throw new Error("有効なWBGT実況値がありません");

  const value = latest.reduce((total, record) => total + record.value, 0) / latest.length;
  return { value, observedAt: latest[0].wbgt_date, level: getWBGTLevel(value) };
}

interface SurveyRecord {
  wbgt_date: string;
  wbgt_WO: string | number | null;
}

function isSurveyRecord(value: unknown): value is SurveyRecord {
  return Boolean(value && typeof value === "object" && "wbgt_date" in value && "wbgt_WO" in value);
}

function formatTokyoDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(value);
  return parts.filter(({ type }) => type !== "literal").map(({ value: part }) => part).join("");
}

function parseTokyoDateTime(value: string): number {
  const match = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute, second] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 9, Number(minute), Number(second));
}