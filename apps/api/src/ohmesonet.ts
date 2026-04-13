import type { CurrentWeatherResponse, StationConditions, StationCurrent, StationInfo, SummaryMetric } from "@osu-weather/shared";

import {
  cToF,
  convertNullable,
  fToC,
  hpaToInHg,
  inHgToHpa,
  inchesToMm,
  mmToInches,
  mphToMps,
  mpsToMph,
  normalizeStatewidePressure,
  round,
  toNullableNumber
} from "./weather-math";

export const STATION_CATALOG_URL = "https://www.ohmesonet.org/api/dataBackend/stationInfos";
export const STATEWIDE_CURRENT_URL =
  "https://www.ohmesonet.org/api/dataBackend/current-0-all-locations&1950-07-19-2022-09-04";
export const BYRD_CURRENT_URL = "https://api.dev.ohmesonet.org/v2/obs/current?station_id[]=BYRD&units=imperial";
export const METRIC_INFO_URL = "https://www.ohmesonet.org/api/dataBackend/metricInfos";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type StationInfoApi = {
  station_id: string;
  station_name: string;
  lat: number;
  lon: number;
  elevation: number;
  county: string;
  location: string;
  network_id: string;
  provider_id: string;
  design_level: number;
};

type StatewideCurrentApi = {
  station_id: string;
  t1_air_150: number | null;
  td_150: number | null;
  rh_150: number | null;
  bp_slp: number | null;
  wd_1000: string | null;
  ws_1000: number | null;
  wg_1000: number | null;
  r_swin: number | null;
  p_day: number | null;
  p_1h: number | null;
  p_24h: number | null;
  t_soil_5: number | null;
  vw_soil_5: number | null;
  begin_date: string | null;
  begin_time: string | null;
};

type ByrdCurrentApi = {
  data?: {
    BYRD?: Array<{
      station_id?: string;
      t1_air_150?: string | number | null;
      td_150?: string | number | null;
      rh_150?: string | number | null;
      bp_slp?: string | number | null;
      wd_1000_compass?: string | null;
      ws_1000?: string | number | null;
      wg_1000?: string | number | null;
      r_swin?: string | number | null;
      p_day?: string | number | null;
      p_1h?: string | number | null;
      p_24h?: string | number | null;
      obstime?: {
        iso?: string;
        str_day?: string;
        str_time?: string;
      };
    }>;
  };
};

const CURRENT_TTL_MS = 60_000;
const STATION_TTL_MS = 3_600_000;

const BYRD_INFO: StationInfo = {
  stationId: "BYRD",
  stationName: "Byrd Polar Research Center",
  county: "Franklin",
  location: "5 NW Columbus",
  networkId: "UHI",
  providerId: "SCOO",
  designLevel: 1,
  latitude: 40.002764,
  longitude: -83.038476,
  elevationMeters: 239,
  elevationFeet: 784
};

let stationCache: CacheEntry<StationInfo[]> | null = null;
let stationPromise: Promise<StationInfo[]> | null = null;
let currentCache: CacheEntry<StationCurrent[]> | null = null;
let currentPromise: Promise<StationCurrent[]> | null = null;

export async function getStationCatalog(): Promise<StationInfo[]> {
  if (stationCache && stationCache.expiresAt > Date.now()) {
    return stationCache.value;
  }

  if (!stationPromise) {
    stationPromise = loadStationCatalog().finally(() => {
      stationPromise = null;
    });
  }

  return stationPromise;
}

export async function getCurrentStations(): Promise<StationCurrent[]> {
  if (currentCache && currentCache.expiresAt > Date.now()) {
    return currentCache.value;
  }

  if (!currentPromise) {
    currentPromise = loadCurrentStations().finally(() => {
      currentPromise = null;
    });
  }

  return currentPromise;
}

export async function buildCurrentWeatherResponse(lastCaptureAt: string | null, captureIntervalSeconds: number): Promise<CurrentWeatherResponse> {
  const stations = await getCurrentStations();

  return {
    fetchedAt: new Date().toISOString(),
    history: {
      captureIntervalSeconds,
      lastCaptureAt
    },
    source: {
      stationCatalogUrl: STATION_CATALOG_URL,
      statewideCurrentUrl: STATEWIDE_CURRENT_URL,
      byrdCurrentUrl: BYRD_CURRENT_URL,
      metricInfoUrl: METRIC_INFO_URL
    },
    summary: {
      stationCount: stations.length,
      networkCount: new Set(stations.map((station) => station.networkId)).size,
      warmest: pickMetric(stations, "airTempC", "Warmest", "°F", (value) => cToF(value)),
      windiest: pickMetric(stations, "windSpeedMps", "Strongest Wind", "mph", (value) => mpsToMph(value)),
      wettest24h: pickMetric(stations, "precipitation24hMm", "Wettest 24h", "in", (value) => mmToInches(value)),
      sunniest: pickMetric(stations, "solarRadiationWm2", "Brightest Solar", "W/m²", (value) => value)
    },
    stations
  };
}

async function loadStationCatalog(): Promise<StationInfo[]> {
  const stationData = await fetchJson<StationInfoApi[]>(STATION_CATALOG_URL);
  const catalog = stationData.map(normalizeStationInfo);

  if (!catalog.find((station) => station.stationId === BYRD_INFO.stationId)) {
    catalog.push(BYRD_INFO);
  }

  catalog.sort(compareStations);

  stationCache = {
    value: catalog,
    expiresAt: Date.now() + STATION_TTL_MS
  };

  return catalog;
}

async function loadCurrentStations(): Promise<StationCurrent[]> {
  const [catalog, statewideRows, byrdResponse] = await Promise.all([
    getStationCatalog(),
    fetchJson<StatewideCurrentApi[]>(STATEWIDE_CURRENT_URL),
    fetchJson<ByrdCurrentApi>(BYRD_CURRENT_URL)
  ]);

  const statewideMap = new Map(statewideRows.map((row) => [row.station_id, row]));
  const stations = catalog
    .map((station) => {
      if (station.stationId === "BYRD") {
        return normalizeByrdCurrent(station, statewideMap.get(station.stationId), byrdResponse);
      }

      return normalizeStatewideCurrent(station, statewideMap.get(station.stationId));
    })
    .sort(compareStations);

  currentCache = {
    value: stations,
    expiresAt: Date.now() + CURRENT_TTL_MS
  };

  return stations;
}

function normalizeStationInfo(station: StationInfoApi): StationInfo {
  return {
    stationId: station.station_id,
    stationName: station.station_name,
    county: station.county,
    location: station.location,
    networkId: station.network_id,
    providerId: station.provider_id,
    designLevel: station.design_level,
    latitude: station.lat,
    longitude: station.lon,
    elevationMeters: round(station.elevation),
    elevationFeet: Math.round(station.elevation * 3.28084)
  };
}

function normalizeStatewideCurrent(station: StationInfo, row?: StatewideCurrentApi): StationCurrent {
  const observedAt = row?.begin_date && row.begin_time ? `${row.begin_date}T${row.begin_time}` : "unknown";
  const pressureHpa = normalizeStatewidePressure(row?.bp_slp);

  return {
    ...station,
    observedAt,
    observedAtDisplay: row?.begin_date && row.begin_time ? `${row.begin_date} ${row.begin_time} local` : "Awaiting current data",
    conditions: {
      airTempC: toNullableNumber(row?.t1_air_150),
      airTempF: convertNullable(row?.t1_air_150, cToF),
      dewPointC: toNullableNumber(row?.td_150),
      dewPointF: convertNullable(row?.td_150, cToF),
      humidityPercent: toNullableNumber(row?.rh_150),
      pressureHpa,
      pressureInHg: pressureHpa === null ? null : round(hpaToInHg(pressureHpa)),
      windDirectionCardinal: row?.wd_1000 ?? null,
      windSpeedMps: toNullableNumber(row?.ws_1000),
      windSpeedMph: convertNullable(row?.ws_1000, mpsToMph),
      windGustMps: toNullableNumber(row?.wg_1000),
      windGustMph: convertNullable(row?.wg_1000, mpsToMph),
      solarRadiationWm2: toNullableNumber(row?.r_swin),
      precipitationDayMm: toNullableNumber(row?.p_day),
      precipitationDayIn: convertNullable(row?.p_day, mmToInches),
      precipitation1hMm: toNullableNumber(row?.p_1h),
      precipitation1hIn: convertNullable(row?.p_1h, mmToInches),
      precipitation24hMm: toNullableNumber(row?.p_24h),
      precipitation24hIn: convertNullable(row?.p_24h, mmToInches),
      soilTempC: toNullableNumber(row?.t_soil_5),
      soilTempF: convertNullable(row?.t_soil_5, cToF),
      soilMoisturePercent: toNullableNumber(row?.vw_soil_5)
    }
  };
}

function normalizeByrdCurrent(station: StationInfo, statewideRow: StatewideCurrentApi | undefined, response: ByrdCurrentApi): StationCurrent {
  const observation = response.data?.BYRD?.[0];
  const statewideCurrent = normalizeStatewideCurrent(station, statewideRow);
  const fallback = statewideCurrent.conditions;
  const temperatureF = toNullableNumber(observation?.t1_air_150);
  const dewPointF = toNullableNumber(observation?.td_150);
  const pressureInHg = toNullableNumber(observation?.bp_slp);
  const windSpeedMph = toNullableNumber(observation?.ws_1000);
  const windGustMph = toNullableNumber(observation?.wg_1000);
  const precipitationDayIn = toNullableNumber(observation?.p_day);
  const precipitation1hIn = toNullableNumber(observation?.p_1h);
  const precipitation24hIn = toNullableNumber(observation?.p_24h);
  const observedAt = observation?.obstime?.iso ?? statewideCurrent.observedAt;
  const observedAtDisplay =
    observation?.obstime?.str_day && observation.obstime.str_time
      ? `${observation.obstime.str_day} ${observation.obstime.str_time}`
      : statewideCurrent.observedAtDisplay;

  return {
    ...station,
    observedAt,
    observedAtDisplay,
    conditions: {
      airTempC: convertNullable(temperatureF, fToC) ?? fallback.airTempC,
      airTempF: temperatureF ?? fallback.airTempF,
      dewPointC: convertNullable(dewPointF, fToC) ?? fallback.dewPointC,
      dewPointF: dewPointF ?? fallback.dewPointF,
      humidityPercent: toNullableNumber(observation?.rh_150) ?? fallback.humidityPercent,
      pressureHpa: convertNullable(pressureInHg, inHgToHpa) ?? fallback.pressureHpa,
      pressureInHg: pressureInHg ?? fallback.pressureInHg,
      windDirectionCardinal: observation?.wd_1000_compass ?? fallback.windDirectionCardinal,
      windSpeedMps: convertNullable(windSpeedMph, mphToMps) ?? fallback.windSpeedMps,
      windSpeedMph: windSpeedMph ?? fallback.windSpeedMph,
      windGustMps: convertNullable(windGustMph, mphToMps) ?? fallback.windGustMps,
      windGustMph: windGustMph ?? fallback.windGustMph,
      solarRadiationWm2: toNullableNumber(observation?.r_swin) ?? fallback.solarRadiationWm2,
      precipitationDayMm: convertNullable(precipitationDayIn, inchesToMm) ?? fallback.precipitationDayMm,
      precipitationDayIn: precipitationDayIn ?? fallback.precipitationDayIn,
      precipitation1hMm: convertNullable(precipitation1hIn, inchesToMm) ?? fallback.precipitation1hMm,
      precipitation1hIn: precipitation1hIn ?? fallback.precipitation1hIn,
      precipitation24hMm: convertNullable(precipitation24hIn, inchesToMm) ?? fallback.precipitation24hMm,
      precipitation24hIn: precipitation24hIn ?? fallback.precipitation24hIn,
      soilTempC: fallback.soilTempC,
      soilTempF: fallback.soilTempF,
      soilMoisturePercent: fallback.soilMoisturePercent
    }
  };
}

function compareStations(left: StationInfo, right: StationInfo): number {
  if (left.stationId === "BYRD") {
    return -1;
  }

  if (right.stationId === "BYRD") {
    return 1;
  }

  return left.stationName.localeCompare(right.stationName);
}

function pickMetric(
  stations: StationCurrent[],
  key: keyof StationConditions,
  label: string,
  unit: string,
  transform: (value: number) => number
): SummaryMetric | null {
  let bestStation: StationCurrent | null = null;
  let bestValue: number | null = null;

  for (const station of stations) {
    const rawValue = station.conditions[key];

    if (typeof rawValue !== "number" || Number.isNaN(rawValue)) {
      continue;
    }

    if (bestValue === null || rawValue > bestValue) {
      bestValue = rawValue;
      bestStation = station;
    }
  }

  if (!bestStation || bestValue === null) {
    return null;
  }

  return {
    stationId: bestStation.stationId,
    stationName: bestStation.stationName,
    value: round(transform(bestValue)),
    unit,
    label
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "osu-weather-api/0.1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Upstream request failed with ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
}
