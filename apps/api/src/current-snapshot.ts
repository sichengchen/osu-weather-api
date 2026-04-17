import type { CurrentWeatherResponse, StationCurrent, StationInfo } from "@osu-weather/shared";

import { buildCurrentWeatherResponse, getCurrentStations } from "./ohmesonet";

const CURRENT_WEATHER_RESPONSE_CACHE_KEY = "current_weather_response";

type CurrentWeatherSnapshotRow = {
  payload_json: string;
};

type RefreshCurrentWeatherSnapshotOptions = {
  captureIntervalSeconds: number;
  lastCaptureAt: string | null;
  stations?: StationCurrent[];
};

export async function getCurrentWeatherSnapshot(env: Env): Promise<CurrentWeatherResponse | null> {
  const row = await env.WEATHER_DB.prepare(
    `
      SELECT payload_json
      FROM api_response_cache
      WHERE cache_key = ?
    `
  )
    .bind(CURRENT_WEATHER_RESPONSE_CACHE_KEY)
    .first<CurrentWeatherSnapshotRow>();

  if (!row) {
    return null;
  }

  return JSON.parse(row.payload_json) as CurrentWeatherResponse;
}

export async function refreshCurrentWeatherSnapshot(
  env: Env,
  { captureIntervalSeconds, lastCaptureAt, stations }: RefreshCurrentWeatherSnapshotOptions
): Promise<CurrentWeatherResponse> {
  const currentStations = stations ?? (await getCurrentStations());
  const snapshot = buildCurrentWeatherResponse(currentStations, lastCaptureAt, captureIntervalSeconds);

  await env.WEATHER_DB.prepare(
    `
      INSERT INTO api_response_cache (
        cache_key,
        fetched_at,
        payload_json
      ) VALUES (?, ?, ?)
      ON CONFLICT (cache_key) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        payload_json = excluded.payload_json
    `
  )
    .bind(CURRENT_WEATHER_RESPONSE_CACHE_KEY, snapshot.fetchedAt, JSON.stringify(snapshot))
    .run();

  return snapshot;
}

export function getStationCatalogFromSnapshot(snapshot: CurrentWeatherResponse): StationInfo[] {
  return snapshot.stations.map(toStationInfo);
}

export function getStationCurrentFromSnapshot(snapshot: CurrentWeatherResponse, stationId: string): StationCurrent | null {
  return snapshot.stations.find((station) => station.stationId === stationId) ?? null;
}

export function getStationInfoFromSnapshot(snapshot: CurrentWeatherResponse, stationId: string): StationInfo | null {
  const station = getStationCurrentFromSnapshot(snapshot, stationId);
  return station ? toStationInfo(station) : null;
}

function toStationInfo(station: StationCurrent): StationInfo {
  const { observedAt: _observedAt, observedAtDisplay: _observedAtDisplay, conditions: _conditions, ...stationInfo } = station;
  return stationInfo;
}
