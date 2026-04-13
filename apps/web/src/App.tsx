import { useEffect, useState, type FormEvent } from "react";

import type { CurrentWeatherResponse, StationHistoryResponse } from "@osu-weather/shared";

import { MetricChart } from "./components/MetricChart";
import { OhioStationMap } from "./components/OhioStationMap";
import { StationTable } from "./components/StationTable";
import { getDisplayStationName } from "./lib/stations";
import {
  FRONTEND_TIME_ZONE,
  formatFrontendDateTimeInputValue,
  formatFrontendTimestamp,
  formatObservationTimestamp,
  parseFrontendDateTimeInputValue
} from "./lib/time";
import { applyThemeMode, getInitialThemeMode, persistThemeMode, type ThemeMode } from "./lib/theme";
import {
  formatDewPoint,
  formatElevation,
  formatHumidity,
  formatPressure,
  formatRain1h,
  formatRainDay,
  formatRain24h,
  formatSolarRadiation,
  formatSoilMoisture,
  formatSoilTemperature,
  formatTemperature,
  formatWindDirection,
  formatWindGust,
  formatWindSpeed,
  getDewPointChartConfig,
  getInitialUnitSystem,
  getPressureChartConfig,
  getRainChartConfig,
  getSolarChartConfig,
  getSoilTemperatureChartConfig,
  getTemperatureChartConfig,
  getWindChartConfig,
  getWindGustChartConfig,
  persistUnitSystem,
  type UnitSystem
} from "./lib/units";

const DEFAULT_HISTORY_WINDOW_HOURS = 72;
const MOBILE_LAYOUT_QUERY = "(max-width: 760px)";
const HISTORY_SHORTCUTS = [
  { hours: 24, label: "24hr" },
  { hours: 72, label: "72hr" },
  { hours: 168, label: "7d" }
] as const;

type HistoryRange = {
  from: string;
  to: string;
};

type HistoryRangeDraft = {
  from: string;
  to: string;
};

type MobileLayer = "home" | "detail";

export default function App() {
  const [current, setCurrent] = useState<CurrentWeatherResponse | null>(null);
  const [history, setHistory] = useState<StationHistoryResponse | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>("BYRD");
  const [search, setSearch] = useState("");
  const [historyRange, setHistoryRange] = useState<HistoryRange>(createDefaultHistoryRange);
  const [historyRangeDraft, setHistoryRangeDraft] = useState<HistoryRangeDraft>(() =>
    createHistoryRangeDraft(createDefaultHistoryRange())
  );
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(getInitialUnitSystem);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSourceSheetOpen, setIsSourceSheetOpen] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(getInitialMobileLayout);
  const [mobileLayer, setMobileLayer] = useState<MobileLayer>("home");
  const [historyRangeError, setHistoryRangeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCurrent();

    const interval = window.setInterval(() => {
      void loadCurrent(true);
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsMobileLayout(event.matches);

    setIsMobileLayout(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!current) {
      return;
    }

    const currentSelectionExists = selectedStationId
      ? current.stations.some((station) => station.stationId === selectedStationId)
      : false;

    if (currentSelectionExists) {
      return;
    }

    const preferredStation = current.stations.find((station) => station.stationId === "BYRD") ?? current.stations[0] ?? null;
    setSelectedStationId(preferredStation?.stationId ?? null);
  }, [current, selectedStationId]);

  useEffect(() => {
    persistUnitSystem(unitSystem);
  }, [unitSystem]);

  useEffect(() => {
    persistThemeMode(themeMode);
    applyThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!selectedStationId) {
      return;
    }

    void loadHistory(selectedStationId, {
      from: historyRange.from,
      to: historyRange.to
    });
  }, [historyRange.from, historyRange.to, selectedStationId]);

  useEffect(() => {
    if (!isSourceSheetOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSourceSheetOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSourceSheetOpen]);

  useEffect(() => {
    setMobileLayer("home");
  }, [isMobileLayout]);

  useEffect(() => {
    if (!isMobileLayout) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollToTop();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isMobileLayout, mobileLayer]);

  async function loadCurrent(isBackgroundRefresh = false) {
    if (!isBackgroundRefresh) {
      setLoadingCurrent(true);
    }

    try {
      const data = await fetchJson<CurrentWeatherResponse>("/api/current");
      setCurrent(data);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load current weather.");
    } finally {
      setLoadingCurrent(false);
    }
  }

  async function loadHistory(stationId: string, range: HistoryRange) {
    setLoadingHistory(true);

    try {
      const historyParams = new URLSearchParams({
        from: range.from,
        to: range.to
      });
      const data = await fetchJson<StationHistoryResponse>(`/api/stations/${stationId}/history?${historyParams.toString()}`);
      setHistory(data);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load station history.");
    } finally {
      setLoadingHistory(false);
    }
  }

  const selectedStation = current?.stations.find((station) => station.stationId === selectedStationId) ?? null;
  const temperatureChart = getTemperatureChartConfig(unitSystem);
  const dewPointChart = getDewPointChartConfig(unitSystem);
  const pressureChart = getPressureChartConfig(unitSystem);
  const solarChart = getSolarChartConfig();
  const soilChart = getSoilTemperatureChartConfig(unitSystem);
  const windChart = getWindChartConfig(unitSystem);
  const windGustChart = getWindGustChartConfig(unitSystem);
  const rainChart = getRainChartConfig(unitSystem);
  const selectedConditions = selectedStation?.conditions;
  const detailFactGroups = [
    {
      title: "Observation",
      items: [
        {
          label: "Observation",
          value: selectedStation
            ? formatObservationTimestamp(selectedStation.observedAt, selectedStation.observedAtDisplay)
            : "Pending"
        },
        { label: "Network", value: selectedStation?.networkId ?? "--" },
        { label: "Elevation", value: formatElevation(selectedStation, unitSystem) }
      ]
    },
    {
      title: "Atmosphere & Wind",
      items: [
        { label: "Dew Point", value: formatDewPoint(selectedConditions, unitSystem) },
        { label: "Wind Direction", value: formatWindDirection(selectedConditions) },
        { label: "Wind Gust", value: formatWindGust(selectedConditions, unitSystem) },
        { label: "Solar Radiation", value: formatSolarRadiation(selectedConditions) }
      ]
    },
    {
      title: "Precipitation & Soil",
      items: [
        { label: "Precip Since Midnight", value: formatRainDay(selectedConditions, unitSystem) },
        { label: "1 Hour Precipitation", value: formatRain1h(selectedConditions, unitSystem) },
        { label: "Soil Moisture", value: formatSoilMoisture(selectedConditions) }
      ]
    }
  ];

  function handleHistoryRangeDraftChange(field: keyof HistoryRangeDraft, value: string) {
    setHistoryRangeDraft((currentRange) => ({
      ...currentRange,
      [field]: value
    }));
    setHistoryRangeError(null);
  }

  function handleHistoryRangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextRange = parseHistoryRangeDraft(historyRangeDraft);

    if (!nextRange) {
      setHistoryRangeError(`Choose a valid start and end date/time in ${FRONTEND_TIME_ZONE}.`);
      return;
    }

    if (Date.parse(nextRange.from) >= Date.parse(nextRange.to)) {
      setHistoryRangeError("End date/time must be later than the start date/time.");
      return;
    }

    setHistoryRange(nextRange);
    setHistoryRangeError(null);
  }

  function handleHistoryShortcutSelect(hours: number) {
    const nextRange = createRelativeHistoryRange(hours);

    setHistoryRange(nextRange);
    setHistoryRangeDraft(createHistoryRangeDraft(nextRange));
    setHistoryRangeError(null);
  }

  function handleStationSelect(stationId: string) {
    setSelectedStationId(stationId);

    if (!isMobileLayout) {
      return;
    }

    setMobileLayer("detail");
  }

  function handleMobileBack() {
    setMobileLayer("home");
  }

  function renderDetailShell(showMobileBackButton: boolean) {
    return (
      <section className={`detail-shell ${showMobileBackButton ? "detail-shell--mobile" : ""}`}>
        <div className={`detail-topline ${showMobileBackButton ? "detail-topline--mobile" : ""}`}>
          {showMobileBackButton ? (
            <div className="mobile-detail-bar">
              <button type="button" className="mobile-nav-button" onClick={handleMobileBack}>
                Back to stations
              </button>
            </div>
          ) : null}

          <div className="detail-heading-wrap">
            <OhioStationMap latitude={selectedStation?.latitude} longitude={selectedStation?.longitude} />
            <div className="detail-heading">
              <h2>{getDisplayStationName(selectedStation)}</h2>
              <span>
                {selectedStation
                  ? `${selectedStation.stationId} · ${selectedStation.location} · ${selectedStation.county} County`
                  : "Waiting for the first current payload"}
              </span>
            </div>
          </div>
        </div>

        <div className="detail-scroll">
          <div className="detail-overview">
            <div className="detail-ribbon">
              <DetailMetric label="Air Temp" value={formatTemperature(selectedConditions, unitSystem)} />
              <DetailMetric label="Humidity" value={formatHumidity(selectedConditions)} />
              <DetailMetric label="Wind" value={formatWindSpeed(selectedConditions, unitSystem)} />
              <DetailMetric label="Pressure" value={formatPressure(selectedConditions, unitSystem)} />
              <DetailMetric label="24h Rain" value={formatRain24h(selectedConditions, unitSystem)} />
              <DetailMetric label="Soil Temp" value={formatSoilTemperature(selectedConditions, unitSystem)} />
            </div>

            <div className="detail-facts">
              {detailFactGroups.map((group) => (
                <section key={group.title} className="detail-fact-group" aria-label={group.title}>
                  <div className="detail-fact-grid">
                    {group.items.map((fact) => (
                      <DetailFact key={fact.label} label={fact.label} value={fact.value} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {selectedStation ? (
            <div className="chart-toolbar-shell">
              <form className="chart-toolbar" onSubmit={handleHistoryRangeSubmit}>
                <label className="history-range-control" htmlFor="history-range-start">
                  <span>Start</span>
                  <input
                    id="history-range-start"
                    type="datetime-local"
                    step={60}
                    value={historyRangeDraft.from}
                    max={historyRangeDraft.to}
                    onChange={(event) => handleHistoryRangeDraftChange("from", event.target.value)}
                  />
                </label>

                <label className="history-range-control" htmlFor="history-range-end">
                  <span>End</span>
                  <input
                    id="history-range-end"
                    type="datetime-local"
                    step={60}
                    value={historyRangeDraft.to}
                    min={historyRangeDraft.from}
                    onChange={(event) => handleHistoryRangeDraftChange("to", event.target.value)}
                  />
                </label>

                <div className="history-range-action">
                  <span className="history-range-action-spacer" aria-hidden="true">
                    Apply
                  </span>
                  <div className="history-range-buttons">
                    <button type="submit" className="history-range-apply" disabled={loadingHistory}>
                      Apply
                    </button>
                    {HISTORY_SHORTCUTS.map((shortcut) => (
                      <button
                        key={shortcut.hours}
                        type="button"
                        className="history-range-shortcut"
                        disabled={loadingHistory}
                        onClick={() => handleHistoryShortcutSelect(shortcut.hours)}
                      >
                        {shortcut.label}
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              {historyRangeError ? <p className="history-range-error">{historyRangeError}</p> : null}
            </div>
          ) : null}

          {loadingCurrent && !current ? <div className="loading-shell">Loading the current statewide feed.</div> : null}

          {selectedStation && history ? (
            <div className="chart-grid">
              <MetricChart
                title="Air Temperature"
                unit={temperatureChart.unit}
                points={history.points}
                accessor={temperatureChart.accessor}
                accent="#ba0c2f"
              />
              <MetricChart
                title="Dew Point"
                unit={dewPointChart.unit}
                points={history.points}
                accessor={dewPointChart.accessor}
                accent="#ba0c2f"
              />
              <MetricChart
                title="Humidity"
                unit="%"
                points={history.points}
                accessor={(point) => point.humidityPercent}
                accent="#ba0c2f"
                precision={0}
              />
              <MetricChart
                title="Wind Speed"
                unit={windChart.unit}
                points={history.points}
                accessor={windChart.accessor}
                accent="#ba0c2f"
              />
              <MetricChart
                title="Wind Gust"
                unit={windGustChart.unit}
                points={history.points}
                accessor={windGustChart.accessor}
                accent="#ba0c2f"
              />
              <MetricChart
                title="Solar Radiation"
                unit={solarChart.unit}
                points={history.points}
                accessor={solarChart.accessor}
                accent="#ba0c2f"
              />
              <MetricChart
                title="Pressure"
                unit={pressureChart.unit}
                points={history.points}
                accessor={pressureChart.accessor}
                accent="#ba0c2f"
                precision={unitSystem === "metric" ? 0 : 2}
              />
              <MetricChart
                title="24 Hour Rain"
                unit={rainChart.unit}
                points={history.points}
                accessor={rainChart.accessor}
                accent="#ba0c2f"
              />
              <MetricChart
                title="Soil Temperature"
                unit={soilChart.unit}
                points={history.points}
                accessor={soilChart.accessor}
                accent="#ba0c2f"
              />
            </div>
          ) : null}

          {loadingHistory ? <div className="loading-shell">Refreshing history for {selectedStationId}.</div> : null}
        </div>
      </section>
    );
  }

  return (
    <main className="app-shell">
      {isMobileLayout ? (
        <>
          {mobileLayer === "home" ? (
            <section className="mobile-home-shell">
              <header className="mobile-home-header">
                <h1>OSU Weather</h1>
                <span>{current ? `Updated ${formatFrontendTimestamp(current.fetchedAt)}` : "Loading latest observations"}</span>
              </header>

              {error ? <div className="error-banner">{error}</div> : null}
              {loadingCurrent && !current ? <div className="loading-shell loading-shell--standalone">Loading the current statewide feed.</div> : null}

              <StationTable
                stations={current?.stations ?? []}
                selectedStationId={selectedStationId}
                search={search}
                unitSystem={unitSystem}
                showVisibleCount={false}
                highlightSelection={false}
                onSearchChange={setSearch}
                onSelect={handleStationSelect}
              />

              <section className="mobile-settings-shell" aria-label="Settings">
                <p className="mobile-settings-label">Settings</p>

                <SettingsToggleStack
                  unitSystem={unitSystem}
                  themeMode={themeMode}
                  onUnitSystemChange={setUnitSystem}
                  onThemeModeChange={setThemeMode}
                  className="toggle-stack--mobile"
                />
              </section>
            </section>
          ) : (
            <>
              {error ? <div className="error-banner">{error}</div> : null}
              {renderDetailShell(true)}
            </>
          )}
        </>
      ) : (
        <>
          <section className="topbar-shell">
            <h1>Ohio State Weather</h1>
            <div className="topbar-meta">
              <SettingsToggleStack
                unitSystem={unitSystem}
                themeMode={themeMode}
                onUnitSystemChange={setUnitSystem}
                onThemeModeChange={setThemeMode}
              />
              <div className="topbar-stat">
                <span>Selected</span>
                <strong>{selectedStation ? selectedStation.stationId : "--"}</strong>
              </div>
              <div className="topbar-stat">
                <span>Temp</span>
                <strong>{formatTemperature(selectedStation?.conditions, unitSystem)}</strong>
              </div>
              <div className="topbar-stat">
                <span>Updated</span>
                <strong>{current ? formatFrontendTimestamp(current.fetchedAt) : "--"}</strong>
              </div>
            </div>
          </section>

          {error ? <div className="error-banner">{error}</div> : null}

          <section className="workspace-grid">
            <StationTable
              stations={current?.stations ?? []}
              selectedStationId={selectedStationId}
              search={search}
              unitSystem={unitSystem}
              onSearchChange={setSearch}
              onSelect={handleStationSelect}
            />

            {renderDetailShell(false)}
          </section>
        </>
      )}

      <footer className="footer-shell">
        <div className="footer-main">
          <span>Website by</span>
          <a className="footer-link" href="https://scchan.com" target="_blank" rel="noreferrer">
            Sicheng Chen
          </a>
          {!isMobileLayout ? (
            <>
              <span className="footer-separator">|</span>
              <a className="footer-link" href="https://github.com/sichengchen/osu-weather-api" target="_blank" rel="noreferrer">
                GitHub
              </a>
              <span className="footer-separator">|</span>
              <a
                className="footer-link"
                href="https://github.com/sichengchen/osu-weather-api/blob/main/docs/API.md"
                target="_blank"
                rel="noreferrer"
              >
                API Docs
              </a>
            </>
          ) : null}
        </div>
        <button type="button" className="footer-link footer-link--button" onClick={() => setIsSourceSheetOpen(true)}>
          Data Source
        </button>
      </footer>

      {isSourceSheetOpen ? (
        <div className="credit-sheet-backdrop">
          <button
            type="button"
            className="credit-sheet-backdrop-dismiss"
            aria-label="Close data source dialog"
            onClick={() => setIsSourceSheetOpen(false)}
          />
          <aside
            className="credit-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-source-title"
          >
            <div className="credit-sheet-header">
              <div>
                <h2 id="data-source-title">Data source</h2>
              </div>
              <button type="button" className="credit-sheet-close" onClick={() => setIsSourceSheetOpen(false)}>
                Close
              </button>
            </div>

            <div className="credit-sheet-body">
              <p>
                The Ohio State University Mesonet, a Network of Weather and Environmental Sensors, Supported by the
                State Climate Office of Ohio.
              </p>

              <div className="credit-links">
                <a href="https://www.ohmesonet.org/" target="_blank" rel="noreferrer">
                  The Ohio State University Mesonet
                </a>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

function SettingsToggleStack({
  unitSystem,
  themeMode,
  onUnitSystemChange,
  onThemeModeChange,
  className = ""
}: {
  unitSystem: UnitSystem;
  themeMode: ThemeMode;
  onUnitSystemChange: (value: UnitSystem) => void;
  onThemeModeChange: (value: ThemeMode) => void;
  className?: string;
}) {
  return (
    <div className={joinClassNames("toggle-stack", className)}>
      <div className="toggle-row toggle-row--units" aria-label="Unit system">
        <button
          type="button"
          className={`toggle-button ${unitSystem === "imperial" ? "is-active" : ""}`}
          onClick={() => onUnitSystemChange("imperial")}
        >
          Imperial
        </button>
        <button
          type="button"
          className={`toggle-button ${unitSystem === "metric" ? "is-active" : ""}`}
          onClick={() => onUnitSystemChange("metric")}
        >
          Metric
        </button>
      </div>
      <div className="toggle-row toggle-row--themes" aria-label="Theme mode">
        <button
          type="button"
          className={`toggle-button ${themeMode === "auto" ? "is-active" : ""}`}
          onClick={() => onThemeModeChange("auto")}
        >
          Auto
        </button>
        <button
          type="button"
          className={`toggle-button ${themeMode === "light" ? "is-active" : ""}`}
          onClick={() => onThemeModeChange("light")}
        >
          Light
        </button>
        <button
          type="button"
          className={`toggle-button ${themeMode === "dark" ? "is-active" : ""}`}
          onClick={() => onThemeModeChange("dark")}
        >
          Dark
        </button>
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-metric">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-fact">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const fallback = await response.text();
    throw new Error(fallback || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

function createDefaultHistoryRange(): HistoryRange {
  return createRelativeHistoryRange(DEFAULT_HISTORY_WINDOW_HOURS);
}

function createHistoryRangeDraft(range: HistoryRange): HistoryRangeDraft {
  return {
    from: formatFrontendDateTimeInputValue(range.from),
    to: formatFrontendDateTimeInputValue(range.to)
  };
}

function parseHistoryRangeDraft(range: HistoryRangeDraft): HistoryRange | null {
  const from = parseFrontendDateTimeInputValue(range.from);
  const to = parseFrontendDateTimeInputValue(range.to);

  if (!from || !to) {
    return null;
  }

  return { from, to };
}

function trimDateToMinute(value: Date): Date {
  const nextValue = new Date(value);
  nextValue.setSeconds(0, 0);

  return nextValue;
}

function createRelativeHistoryRange(hours: number): HistoryRange {
  const to = trimDateToMinute(new Date());
  const from = new Date(to.getTime() - hours * 60 * 60 * 1_000);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

function getInitialMobileLayout() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}

function joinClassNames(...classNames: string[]) {
  return classNames.filter(Boolean).join(" ");
}

function scrollToTop() {
  if (typeof window === "undefined") {
    return;
  }

  window.scrollTo({ top: 0 });
}
