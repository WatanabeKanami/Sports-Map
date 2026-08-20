"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { recommendActivities } from "./lib/recommend";
import type {
  Activity,
  ActivityRecommendation,
  GeoPoint,
  IndoorPreference,
  Mood,
  RecommendationInput,
  SupportCategory,
  SupportSpot,
} from "./lib/types";

const KOTO_CENTER: GeoPoint = { latitude: 35.6762, longitude: 139.8171 };

const AREA_OPTIONS = [
  { id: "center", label: "江東区の中心", location: KOTO_CENTER },
  { id: "kameido", label: "亀戸", location: { latitude: 35.697, longitude: 139.826 } },
  { id: "toyosu", label: "豊洲・有明", location: { latitude: 35.649, longitude: 139.791 } },
  { id: "higashisuna", label: "東砂", location: { latitude: 35.68, longitude: 139.839 } },
  { id: "yumenoshima", label: "夢の島", location: { latitude: 35.651, longitude: 139.824 } },
] as const;

const TIME_OPTIONS = [30, 60, 90, 120];
const BUDGET_OPTIONS = Array.from({ length: 7 }, (_, index) => index * 250);
const GROUP_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

const MOOD_OPTIONS: { value: Mood; label: string; caption: string }[] = [
  { value: "relax", label: "ゆるく", caption: "力を抜いて" },
  { value: "refresh", label: "気分転換", caption: "さっぱりしたい" },
  { value: "challenge", label: "しっかり", caption: "汗をかきたい" },
  { value: "social", label: "わいわい", caption: "みんなで遊ぶ" },
];

const SETTING_OPTIONS: { value: IndoorPreference; label: string }[] = [
  { value: "either", label: "どちらでも" },
  { value: "indoor", label: "屋内" },
  { value: "outdoor", label: "屋外" },
];

const SUPPORT_META: Record<
  SupportCategory,
  { label: string; shortLabel: string; className: string }
> = {
  water: { label: "給水スポット", shortLabel: "水", className: "is-water" },
  cooling: { label: "涼み処", shortLabel: "涼", className: "is-cooling" },
  toilet: { label: "公衆トイレ", shortLabel: "WC", className: "is-toilet" },
  aed: { label: "AED", shortLabel: "AED", className: "is-aed" },
};

const CATEGORY_LABELS: Record<string, string> = {
  training: "トレーニング",
  badminton: "バドミントン",
  swimming: "水泳",
  basketball: "バスケットボール",
  running: "ランニング",
  skateboarding: "スケートボード",
  baseball: "野球",
};

const DEFAULT_INPUT: RecommendationInput = {
  timeMinutes: 60,
  budget: 500,
  groupSize: 2,
  mood: "refresh",
  indoorPreference: "either",
  location: KOTO_CENTER,
};

type LocationStatus = "idle" | "locating" | "success" | "error";

export default function SportsMapApp() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [supportSpots, setSupportSpots] = useState<SupportSpot[]>([]);
  const [draftInput, setDraftInput] = useState(DEFAULT_INPUT);
  const [appliedInput, setAppliedInput] = useState(DEFAULT_INPUT);
  const [selectedArea, setSelectedArea] = useState("center");
  const [locationLabel, setLocationLabel] = useState("江東区の中心");
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dataError, setDataError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [supportVisibility, setSupportVisibility] = useState<
    Record<SupportCategory, boolean>
  >({ water: true, cooling: true, toilet: false, aed: false });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch("/data/activities.json", { signal: controller.signal }),
      fetch("/data/support-spots.json", { signal: controller.signal }),
    ])
      .then(async ([activityResponse, supportResponse]) => {
        if (!activityResponse.ok || !supportResponse.ok) {
          throw new Error("データの取得に失敗しました");
        }

        const [activityData, supportData] = await Promise.all([
          activityResponse.json() as Promise<Activity[]>,
          supportResponse.json() as Promise<SupportSpot[]>,
        ]);
        setActivities(activityData);
        setSupportSpots(supportData);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDataError(true);
      });

    return () => controller.abort();
  }, []);

  const recommendations = useMemo(
    () => recommendActivities(activities, appliedInput),
    [activities, appliedInput],
  );

  const activeSelectedId = recommendations.some(
    ({ activity }) => activity.id === selectedId,
  )
    ? selectedId
    : recommendations[0]?.activity.id ?? null;

  useEffect(() => {
    let disposed = false;

    async function createMap() {
      if (!mapContainerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (disposed || !mapContainerRef.current) return;

      leafletRef.current = L;
      const map = L.map(mapContainerRef.current, {
        center: [KOTO_CENTER.latitude, KOTO_CENTER.longitude],
        zoom: 12,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
      }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);

      const resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(mapContainerRef.current);
      window.setTimeout(() => map.invalidateSize(), 100);

      return () => resizeObserver.disconnect();
    }

    let disconnectResizeObserver: (() => void) | undefined;
    void createMap().then((disconnect) => {
      disconnectResizeObserver = disconnect;
    });

    return () => {
      disposed = true;
      disconnectResizeObserver?.();
      markerLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!L || !map || !markerLayer) return;

    markerLayer.clearLayers();
    const rankedIds = new Map(
      recommendations.map(({ activity }, index) => [activity.id, index + 1]),
    );

    activities.forEach((activity) => {
      if (!activity.location) return;
      const rank = rankedIds.get(activity.id);
      const marker = L.marker(
        [activity.location.latitude, activity.location.longitude],
        {
          icon: L.divIcon({
            className: "map-marker-shell",
            html: `<span class="activity-marker${rank ? " is-recommended" : ""}"><b>${rank ?? "•"}</b></span>`,
            iconSize: rank ? [38, 42] : [24, 28],
            iconAnchor: rank ? [19, 40] : [12, 26],
          }),
          title: activity.name,
        },
      ).addTo(markerLayer);

      marker.bindTooltip(escapeHtml(activity.name), {
        direction: "top",
        offset: [0, -28],
      });
      marker.on("click", () => {
        setSelectedId(activity.id);
        document.getElementById(`result-${activity.id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    });

    supportSpots.forEach((spot) => {
      if (!supportVisibility[spot.category]) return;
      const meta = SUPPORT_META[spot.category];
      const marker = L.marker([spot.location.latitude, spot.location.longitude], {
        icon: L.divIcon({
          className: "map-marker-shell",
          html: `<span class="support-marker ${meta.className}">${meta.shortLabel}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        title: spot.name,
      }).addTo(markerLayer);

      marker.bindPopup(
        `<div class="map-popup"><strong>${escapeHtml(spot.name)}</strong><br><span>${escapeHtml(spot.details)}</span></div>`,
      );
    });

    if (locationStatus === "success" && appliedInput.location) {
      L.circleMarker(
        [appliedInput.location.latitude, appliedInput.location.longitude],
        {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: "#3857ff",
          fillOpacity: 1,
        },
      )
        .bindTooltip("現在地")
        .addTo(markerLayer);
    }
  }, [activities, supportSpots, recommendations, supportVisibility, locationStatus, appliedInput.location, mapReady]);

  useEffect(() => {
    const selected = recommendations.find(({ activity }) => activity.id === activeSelectedId);
    if (!selected?.activity.location || !mapRef.current) return;
    mapRef.current.flyTo(
      [selected.activity.location.latitude, selected.activity.location.longitude],
      14,
      { duration: 0.55 },
    );
  }, [activeSelectedId, recommendations, mapReady]);

  const applySearch = () => {
    setAppliedInput({ ...draftInput });
    window.setTimeout(() => {
      document.getElementById("recommendations")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  const requestCurrentPosition = () => {
    setShowLocationDialog(false);
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        setDraftInput((current) => ({ ...current, location }));
        setAppliedInput((current) => ({ ...current, location }));
        setLocationLabel("現在地");
        setSelectedArea("current");
        setLocationStatus("success");
        mapRef.current?.flyTo([location.latitude, location.longitude], 14, {
          duration: 0.6,
        });
      },
      () => setLocationStatus("error"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const selectArea = (areaId: string) => {
    const area = AREA_OPTIONS.find(({ id }) => id === areaId) ?? AREA_OPTIONS[0];
    setSelectedArea(area.id);
    setLocationLabel(area.label);
    setLocationStatus("idle");
    setDraftInput((current) => ({ ...current, location: area.location }));
    setAppliedInput((current) => ({ ...current, location: area.location }));
    setShowLocationDialog(false);
    mapRef.current?.flyTo([area.location.latitude, area.location.longitude], 13, {
      duration: 0.55,
    });
  };

  return (
    <main className="site-shell" id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="いまスポ ホーム">
          <span className="brand-mark" aria-hidden="true">↗</span>
          <span>いまスポ</span>
        </a>
        <nav className="header-nav" aria-label="ページ内ナビゲーション">
          <a href="#recommendations">おすすめ</a>
          <a href="#data-policy">データについて</a>
          <span className="pilot-label">江東区 PILOT</span>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">TOKYO ACTIVE PLAY MAP / KOTO</p>
          <h1>
            「運動したい」を、
            <span>「今からできる」に。</span>
          </h1>
          <p className="hero-description">
            使える時間と予算を選ぶだけ。江東区のオープンデータから、<br />
            いまの条件に合う運動を3つ提案します。
          </p>

          <div className="location-line">
            <div>
              <span className="micro-label">SEARCH FROM</span>
              <strong>{locationLabel}</strong>
              {locationStatus === "locating" && <small>位置を確認中…</small>}
              {locationStatus === "error" && (
                <small className="error-copy">
                  現在地を取得できませんでした。エリアを選んで検索できます。
                </small>
              )}
            </div>
            <button type="button" onClick={() => setShowLocationDialog(true)}>
              場所を変える
            </button>
          </div>

          <div className="condition-panel" aria-label="運動の検索条件">
            <fieldset>
              <legend><span>01</span> 使える時間</legend>
              <div className="choice-row">
                {TIME_OPTIONS.map((time) => (
                  <button
                    className={draftInput.timeMinutes === time ? "is-active" : ""}
                    key={time}
                    type="button"
                    aria-pressed={draftInput.timeMinutes === time}
                    onClick={() => setDraftInput((current) => ({ ...current, timeMinutes: time }))}
                  >
                    {time}分
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend><span>02</span> 1人あたりの予算</legend>
              <div className="scroll-choice-wrapper">
                <div className="scroll-choice-row" aria-label="予算の候補を横スクロールで選択">
                  {BUDGET_OPTIONS.map((budget) => (
                    <button
                      className={draftInput.budget === budget ? "is-active" : ""}
                      key={budget}
                      type="button"
                      aria-pressed={draftInput.budget === budget}
                      onClick={() => setDraftInput((current) => ({ ...current, budget }))}
                    >
                      {budget === 0 ? "無料" : `${budget.toLocaleString("ja-JP")}円`}
                    </button>
                  ))}
                </div>
                <small className="scroll-choice-hint">横スクロールして選べます</small>
              </div>
            </fieldset>

            <div className="condition-split">
              <fieldset>
                <legend><span>03</span> 人数</legend>
                <div className="scroll-choice-wrapper">
                  <div className="scroll-choice-row is-group" aria-label="人数の候補を横スクロールで選択">
                    {GROUP_OPTIONS.map((groupSize) => (
                      <button
                        className={draftInput.groupSize === groupSize ? "is-active" : ""}
                        key={groupSize}
                        type="button"
                        aria-pressed={draftInput.groupSize === groupSize}
                        onClick={() => setDraftInput((current) => ({ ...current, groupSize }))}
                      >
                        {groupSize}人
                      </button>
                    ))}
                  </div>
                  <small className="scroll-choice-hint">横スクロールして選べます</small>
                </div>
              </fieldset>

              <fieldset>
                <legend><span>04</span> 場所</legend>
                <div className="choice-row compact">
                  {SETTING_OPTIONS.map(({ value, label }) => (
                    <button
                      className={draftInput.indoorPreference === value ? "is-active" : ""}
                      key={value}
                      type="button"
                      aria-pressed={draftInput.indoorPreference === value}
                      onClick={() => setDraftInput((current) => ({ ...current, indoorPreference: value }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <fieldset>
              <legend><span>05</span> いまの気分</legend>
              <div className="mood-grid">
                {MOOD_OPTIONS.map(({ value, label, caption }) => (
                  <button
                    className={draftInput.mood === value ? "is-active" : ""}
                    key={value}
                    type="button"
                    aria-pressed={draftInput.mood === value}
                    onClick={() => setDraftInput((current) => ({ ...current, mood: value }))}
                  >
                    <strong>{label}</strong>
                    <small>{caption}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            <button className="primary-action" type="button" onClick={applySearch}>
              <span>この条件で3つ提案してもらう</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>

        <div className="map-column">
          <div className="map-heading">
            <div>
              <span className="micro-label">LIVE MAP</span>
              <strong>江東区スポーツマップ</strong>
            </div>
            <span className="map-count">運動 {activities.length}件</span>
          </div>
          <div className="map-stage">
            <div className="map-toolbar" aria-label="地図に表示する設備">
              {(Object.keys(SUPPORT_META) as SupportCategory[]).map((category) => {
                const meta = SUPPORT_META[category];
                return (
                  <button
                    className={supportVisibility[category] ? `is-active ${meta.className}` : ""}
                    key={category}
                    type="button"
                    aria-pressed={supportVisibility[category]}
                    onClick={() =>
                      setSupportVisibility((current) => ({
                        ...current,
                        [category]: !current[category],
                      }))
                    }
                  >
                    <span aria-hidden="true">{meta.shortLabel}</span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <div ref={mapContainerRef} className="leaflet-map" aria-label="江東区の運動施設と支援スポットの地図" />
            {!mapReady && <div className="map-loading">地図を読み込み中…</div>}
          </div>
          <p className="map-note">
            距離は直線距離の目安です。地図上の番号はおすすめ順位、丸い記号は給水・涼み処などを表します。
          </p>
        </div>
      </section>

      <section className="results-section" id="recommendations" aria-live="polite">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR 3 PICKS</p>
            <h2>今日、行くならココ！</h2>
          </div>
          <p>
            {locationLabel}から／{appliedInput.timeMinutes}分／
            {appliedInput.budget === 0 ? "無料" : `${appliedInput.budget.toLocaleString("ja-JP")}円以内`}
          </p>
        </div>

        {dataError ? (
          <div className="empty-state">
            <strong>データを読み込めませんでした。</strong>
            <span>通信を確認して、ページを再読み込みしてみてください。</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="empty-state"><span>候補データを読み込み中…</span></div>
        ) : recommendations.length === 0 ? (
          <div className="empty-state">
            <strong>ぴったりの候補が見つかりませんでした。</strong>
            <span>時間・予算・人数・屋内外のどれかを少し広げると見つかりやすいよ。</span>
          </div>
        ) : (
          <div className="result-grid">
            {recommendations.map((recommendation, index) => (
              <RecommendationCard
                key={recommendation.activity.id}
                recommendation={recommendation}
                rank={index + 1}
                selected={activeSelectedId === recommendation.activity.id}
                supportSpots={supportSpots}
                onSelect={() => setSelectedId(recommendation.activity.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="safety-section">
        <div className="safety-intro">
          <p className="eyebrow">PLAY SAFE</p>
          <h2>運動の前後まで、マップの守備範囲。</h2>
        </div>
        <div className="safety-cards">
          <article>
            <span className="safety-index">01</span>
            <h3>暑さを見て、無理しない</h3>
            <p>体調と暑さ指数を確認し、無理のない範囲で運動してください。気分が悪くなったら、すぐに運動をやめて涼しい場所へ移動してください。</p>
          </article>
          <article>
            <span className="safety-index">02</span>
            <h3>給水と涼み処も一緒に</h3>
            <p>地図のレイヤーで近くの候補を表示できます。開館日・利用条件・一時休止は現地や公式サイトで確認してください。</p>
          </article>
          <article>
            <span className="safety-index">03</span>
            <h3>AEDは参考情報として</h3>
            <p>AED位置は参考情報です。緊急時は表示だけを頼らず119番へ連絡してください。閉館中は利用できない場合があります。</p>
          </article>
        </div>
      </section>

      <section className="data-section" id="data-policy">
        <div>
          <p className="eyebrow">WHY KOTO PILOT?</p>
          <h2>まず江東区で。</h2>
        </div>
        <div className="data-copy">
          <p>
            「パイロット地域」は、本格的に都内全域へ広げる前に、使い勝手やデータ品質を試す最初の地域のこと。
            江東区はスポーツ施設・給水・涼み処・トイレ・AEDの公開データが揃っているので、初期版の検証に向いています。
          </p>
          <details>
            <summary>使っているデータとライセンス</summary>
            <div className="attribution-list">
              <a href="https://catalog.data.metro.tokyo.lg.jp/dataset/t131083d3100000004" target="_blank" rel="noreferrer">江東区 スポーツ施設一覧</a>
              <a href="https://catalog.data.metro.tokyo.lg.jp/dataset/t131083d3100000016" target="_blank" rel="noreferrer">江東区 クーリングシェルター一覧</a>
              <a href="https://catalog.data.metro.tokyo.lg.jp/dataset/t131083d0000000019" target="_blank" rel="noreferrer">江東区 公衆トイレ一覧</a>
              <a href="https://catalog.data.metro.tokyo.lg.jp/dataset/t131083d0000000027" target="_blank" rel="noreferrer">江東区 AED設置箇所一覧</a>
              <a href="https://catalog.data.metro.tokyo.lg.jp/dataset/t000019d0000000003" target="_blank" rel="noreferrer">東京都水道局 Tokyowater Drinking Station</a>
              <a href="https://creativecommons.org/licenses/by/4.0/deed.ja" target="_blank" rel="noreferrer">CC BY 4.0</a>
              <p>各データを加工して使用／取得・料金確認日: 2026年8月15日</p>
            </div>
          </details>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-brand"><span className="brand-mark" aria-hidden="true">↗</span>いまスポ</div>
        <p>いまスポは試作版で、東京都・江東区の公式サービスではありません。掲載情報は参考情報です。料金・営業時間・予約状況・設備は変更されるため、利用前に各施設の公式情報をご確認ください。</p>
        <a href="#top">ページ上部へ ↑</a>
      </footer>

      {showLocationDialog && (
        <dialog
          className="dialog-backdrop"
          open
          aria-labelledby="location-dialog-title"
        >
          <section
            className="location-dialog"
          >
            <button className="dialog-close" type="button" aria-label="閉じる" onClick={() => setShowLocationDialog(false)}>×</button>
            <p className="eyebrow">LOCATION</p>
            <h2 id="location-dialog-title">近くの運動スポットを探します</h2>
            <p>現在地は距離計算にだけ使い、保存・送信しません。許可しなくてもエリアを選んで利用できます。</p>
            <button className="primary-action" type="button" onClick={requestCurrentPosition}>
              <span>現在地を使う</span><span aria-hidden="true">◎</span>
            </button>
            <div className="dialog-divider"><span>または、エリアから探す</span></div>
            <div className="area-grid">
              {AREA_OPTIONS.map((area) => (
                <button
                  className={selectedArea === area.id ? "is-active" : ""}
                  key={area.id}
                  type="button"
                  onClick={() => selectArea(area.id)}
                >
                  {area.label}
                </button>
              ))}
            </div>
          </section>
        </dialog>
      )}
    </main>
  );
}

function RecommendationCard({
  recommendation,
  rank,
  selected,
  supportSpots,
  onSelect,
}: {
  recommendation: ActivityRecommendation;
  rank: number;
  selected: boolean;
  supportSpots: SupportSpot[];
  onSelect: () => void;
}) {
  const { activity, distanceKm, reasons, warnings } = recommendation;
  const nearestSupport = getNearestSupport(activity, supportSpots);

  return (
    <article className={`result-card${selected ? " is-selected" : ""}`} id={`result-${activity.id}`}>
      <div className="result-topline">
        <span className="rank-badge">{String(rank).padStart(2, "0")}</span>
        <span>{CATEGORY_LABELS[activity.category ?? ""] ?? "スポーツ"}</span>
        <span>{formatDistance(distanceKm)}</span>
      </div>
      <h3>{activity.name}</h3>
      <p className="facility-name">{activity.facilityName}</p>
      <div className="result-stats">
        <span><small>時間</small>{activity.durationMinutes ? `${activity.durationMinutes}分` : "要確認"}</span>
        <span><small>料金</small>{formatCost(activity)}</span>
        <span><small>場所</small>{formatSetting(activity)}</span>
      </div>
      <div className="reason-list">
        {reasons.map((reason) => <span key={reason}>✓ {reason}</span>)}
      </div>
      {nearestSupport.length > 0 && (
        <div className="nearby-support">
          <strong>近くのサポート</strong>
          {nearestSupport.map(({ spot, distanceKm: supportDistance }) => (
            <span key={spot.id}>{SUPPORT_META[spot.category].label} 約{formatDistance(supportDistance)}</span>
          ))}
        </div>
      )}
      <p className="price-note">{activity.priceNote}</p>
      {[...warnings, ...(activity.warnings ?? [])].slice(0, 2).map((warning) => (
        <p className="warning-note" key={warning}>※ {warning}</p>
      ))}
      <div className="result-footer">
        <span>料金確認 {formatDate(activity.verifiedAt)}</span>
        <button className="result-select" type="button" onClick={onSelect}>地図で見る</button>
        <a href={activity.sourceUrl ?? "#"} target="_blank" rel="noreferrer">
          公式情報を見る ↗
        </a>
      </div>
    </article>
  );
}

function getNearestSupport(activity: Activity, spots: SupportSpot[]) {
  if (!activity.location) return [];
  const usefulCategories: SupportCategory[] = ["water", "cooling"];

  return usefulCategories
    .map((category) =>
      spots
        .filter((spot) => spot.category === category)
        .map((spot) => ({ spot, distanceKm: distanceBetween(activity.location!, spot.location) }))
        .sort((left, right) => left.distanceKm - right.distanceKm)[0],
    )
    .filter((item): item is { spot: SupportSpot; distanceKm: number } => Boolean(item));
}

function distanceBetween(from: GeoPoint, to: GeoPoint) {
  const radius = 6_371;
  const lat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const lon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(lat / 2) ** 2 +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(lon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

function formatDistance(distanceKm: number) {
  return distanceKm < 1
    ? `${Math.max(10, Math.round((distanceKm * 1_000) / 10) * 10)}m`
    : `${distanceKm.toFixed(1)}km`;
}

function formatCost(activity: Activity) {
  if (typeof activity.costYen === "number") {
    return `${activity.costYen.toLocaleString("ja-JP")}円`;
  }
  if (typeof activity.priceAmountYen === "number") {
    return `${activity.priceAmountYen.toLocaleString("ja-JP")}円／団体`;
  }
  return "要確認";
}

function formatSetting(activity: Activity) {
  if (activity.setting === "indoor") return "屋内";
  if (activity.setting === "outdoor") return "屋外";
  if (activity.setting === "both") return "屋内・屋外";
  return "要確認";
}

function formatDate(value?: string | null) {
  if (!value) return "未確認";
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1/$2/$3");
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character,
  );
}
