import type { HistoryPoint, StationCurrent, StationHistoryResponse } from "@osu-weather/shared";

import { getCurrentStations, getStationCatalog } from "./ohmesonet";

const LIVE_CAPTURE_SOURCE = "live_capture";

type HistoryRow = {
  captured_at: string;
  observed_at: string;
  observed_at_display: string;
  air_temp_c: number | null;
  air_temp_f: number | null;
  dew_point_c: number | null;
  dew_point_f: number | null;
  humidity_percent: number | null;
  pressure_hpa: number | null;
  pressure_in_hg: number | null;
  wind_speed_mps: number | null;
  wind_speed_mph: number | null;
  wind_gust_mps: number | null;
  wind_gust_mph: number | null;
  precipitation_day_mm: number | null;
  precipitation_day_in: number | null;
  precipitation_24h_mm: number | null;
  precipitation_24h_in: number | null;
  solar_radiation_wm2: number | null;
  soil_temp_c: number | null;
  soil_temp_f: number | null;
  soil_moisture_percent: number | null;
};

export type HistoryRange = {
  from: string;
  to: string;
};

export async function maybeCaptureHistory(env: Env, stations?: StationCurrent[]): Promise<{ captured: boolean; capturedAt: string | null; reason: string }> {
  const intervalSeconds = getHistoryCaptureIntervalSeconds(env);
  const lastCaptureAt = await getLastHistoryCaptureAt(env);

  if (lastCaptureAt && Date.now() - Date.parse(lastCaptureAt) < intervalSeconds * 1_000) {
    return {
      captured: false,
      capturedAt: lastCaptureAt,
      reason: "interval_not_elapsed"
    };
  }

  const currentStations = stations ?? (await getCurrentStations());
  const capturedAt = new Date().toISOString();
  const statements = currentStations.map((station) =>
    env.WEATHER_DB.prepare(
      `
        INSERT INTO weather_history (
          station_id,
          captured_at,
          observed_at,
          observed_at_display,
          air_temp_c,
          air_temp_f,
          dew_point_c,
          dew_point_f,
          humidity_percent,
          pressure_hpa,
          pressure_in_hg,
          wind_speed_mps,
          wind_speed_mph,
          wind_gust_mps,
          wind_gust_mph,
          precipitation_day_mm,
          precipitation_day_in,
          precipitation_24h_mm,
          precipitation_24h_in,
          solar_radiation_wm2,
          soil_temp_c,
          soil_temp_f,
          soil_moisture_percent,
          source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (station_id, captured_at) DO UPDATE SET
          observed_at = excluded.observed_at,
          observed_at_display = excluded.observed_at_display,
          air_temp_c = excluded.air_temp_c,
          air_temp_f = excluded.air_temp_f,
          dew_point_c = excluded.dew_point_c,
          dew_point_f = excluded.dew_point_f,
          humidity_percent = excluded.humidity_percent,
          pressure_hpa = excluded.pressure_hpa,
          pressure_in_hg = excluded.pressure_in_hg,
          wind_speed_mps = excluded.wind_speed_mps,
          wind_speed_mph = excluded.wind_speed_mph,
          wind_gust_mps = excluded.wind_gust_mps,
          wind_gust_mph = excluded.wind_gust_mph,
          precipitation_day_mm = excluded.precipitation_day_mm,
          precipitation_day_in = excluded.precipitation_day_in,
          precipitation_24h_mm = excluded.precipitation_24h_mm,
          precipitation_24h_in = excluded.precipitation_24h_in,
          solar_radiation_wm2 = excluded.solar_radiation_wm2,
          soil_temp_c = excluded.soil_temp_c,
          soil_temp_f = excluded.soil_temp_f,
          soil_moisture_percent = excluded.soil_moisture_percent,
          source = excluded.source
      `
    ).bind(
      station.stationId,
      capturedAt,
      station.observedAt,
      station.observedAtDisplay,
      station.conditions.airTempC,
      station.conditions.airTempF,
      station.conditions.dewPointC,
      station.conditions.dewPointF,
      station.conditions.humidityPercent,
      station.conditions.pressureHpa,
      station.conditions.pressureInHg,
      station.conditions.windSpeedMps,
      station.conditions.windSpeedMph,
      station.conditions.windGustMps,
      station.conditions.windGustMph,
      station.conditions.precipitationDayMm,
      station.conditions.precipitationDayIn,
      station.conditions.precipitation24hMm,
      station.conditions.precipitation24hIn,
      station.conditions.solarRadiationWm2,
      station.conditions.soilTempC,
      station.conditions.soilTempF,
      station.conditions.soilMoisturePercent,
      LIVE_CAPTURE_SOURCE
    )
  );

  await env.WEATHER_DB.batch(statements);

  return {
    captured: true,
    capturedAt,
    reason: "captured"
  };
}

export async function getStationHistory(env: Env, stationId: string, range: HistoryRange): Promise<StationHistoryResponse> {
  const normalizedStationId = stationId.toUpperCase();
  const catalog = await getStationCatalog();
  const station = catalog.find((entry) => entry.stationId === normalizedStationId) ?? null;
  const intervalSeconds = getHistoryCaptureIntervalSeconds(env);
  const now = new Date();
  const result = await env.WEATHER_DB.prepare(
    `
      SELECT
        captured_at,
        observed_at,
        observed_at_display,
        air_temp_c,
        air_temp_f,
        dew_point_c,
        dew_point_f,
        humidity_percent,
        pressure_hpa,
        pressure_in_hg,
        wind_speed_mps,
        wind_speed_mph,
        wind_gust_mps,
        wind_gust_mph,
        precipitation_day_mm,
        precipitation_day_in,
        precipitation_24h_mm,
        precipitation_24h_in,
        solar_radiation_wm2,
        soil_temp_c,
        soil_temp_f,
        soil_moisture_percent
      FROM weather_history
      WHERE station_id = ? AND captured_at >= ? AND captured_at <= ?
      ORDER BY captured_at ASC
    `
  )
    .bind(normalizedStationId, range.from, range.to)
    .all<HistoryRow>();
  const points = (result.results ?? []).map(mapHistoryRow);

  return {
    fetchedAt: now.toISOString(),
    station,
    history: {
      captureIntervalSeconds: intervalSeconds,
      snapshotCount: points.length,
      from: range.from,
      to: range.to
    },
    points
  };
}

export async function ensureInitialCapture(env: Env): Promise<void> {
  const lastCaptureAt = await getLastHistoryCaptureAt(env);

  if (!lastCaptureAt) {
    await maybeCaptureHistory(env);
  }
}

export async function getLastHistoryCaptureAt(env: Env): Promise<string | null> {
  const row = await env.WEATHER_DB.prepare(
    `
      SELECT MAX(captured_at) AS capturedAt
      FROM weather_history
      WHERE source = ?
    `
  )
    .bind(LIVE_CAPTURE_SOURCE)
    .first<{ capturedAt: string | null }>();

  return row?.capturedAt ?? null;
}

export function getHistoryCaptureIntervalSeconds(env: Env): number {
  const parsed = Number.parseInt(env.HISTORY_CAPTURE_INTERVAL_SECONDS ?? "600", 10);
  return Number.isFinite(parsed) && parsed >= 60 ? parsed : 600;
}

function mapHistoryRow(row: HistoryRow): HistoryPoint {
  return {
    capturedAt: row.captured_at,
    observedAt: row.observed_at,
    observedAtDisplay: row.observed_at_display,
    airTempC: row.air_temp_c,
    airTempF: row.air_temp_f,
    dewPointC: row.dew_point_c,
    dewPointF: row.dew_point_f,
    humidityPercent: row.humidity_percent,
    pressureHpa: row.pressure_hpa,
    pressureInHg: row.pressure_in_hg,
    windSpeedMps: row.wind_speed_mps,
    windSpeedMph: row.wind_speed_mph,
    windGustMps: row.wind_gust_mps,
    windGustMph: row.wind_gust_mph,
    precipitationDayMm: row.precipitation_day_mm,
    precipitationDayIn: row.precipitation_day_in,
    precipitation24hMm: row.precipitation_24h_mm,
    precipitation24hIn: row.precipitation_24h_in,
    solarRadiationWm2: row.solar_radiation_wm2,
    soilTempC: row.soil_temp_c,
    soilTempF: row.soil_temp_f,
    soilMoisturePercent: row.soil_moisture_percent
  };
}
