export type NullableNumber = number | null;

export type StationInfo = {
  stationId: string;
  stationName: string;
  county: string;
  location: string;
  networkId: string;
  providerId: string;
  designLevel: number;
  latitude: number;
  longitude: number;
  elevationMeters: number;
  elevationFeet: number;
};

export type StationConditions = {
  airTempC: NullableNumber;
  airTempF: NullableNumber;
  dewPointC: NullableNumber;
  dewPointF: NullableNumber;
  humidityPercent: NullableNumber;
  pressureHpa: NullableNumber;
  pressureInHg: NullableNumber;
  windDirectionCardinal: string | null;
  windSpeedMps: NullableNumber;
  windSpeedMph: NullableNumber;
  windGustMps: NullableNumber;
  windGustMph: NullableNumber;
  solarRadiationWm2: NullableNumber;
  precipitationDayMm: NullableNumber;
  precipitationDayIn: NullableNumber;
  precipitation1hMm: NullableNumber;
  precipitation1hIn: NullableNumber;
  precipitation24hMm: NullableNumber;
  precipitation24hIn: NullableNumber;
  soilTempC: NullableNumber;
  soilTempF: NullableNumber;
  soilMoisturePercent: NullableNumber;
};

export type StationCurrent = StationInfo & {
  observedAt: string;
  observedAtDisplay: string;
  conditions: StationConditions;
};

export type SummaryMetric = {
  stationId: string;
  stationName: string;
  value: number;
  unit: string;
  label: string;
};

export type CurrentWeatherResponse = {
  fetchedAt: string;
  history: {
    captureIntervalSeconds: number;
    lastCaptureAt: string | null;
  };
  source: {
    stationCatalogUrl: string;
    statewideCurrentUrl: string;
    byrdCurrentUrl: string;
    metricInfoUrl: string;
  };
  summary: {
    stationCount: number;
    networkCount: number;
    warmest: SummaryMetric | null;
    windiest: SummaryMetric | null;
    wettest24h: SummaryMetric | null;
    sunniest: SummaryMetric | null;
  };
  stations: StationCurrent[];
};

export type HistoryPoint = {
  capturedAt: string;
  observedAt: string;
  observedAtDisplay: string;
  airTempC: NullableNumber;
  airTempF: NullableNumber;
  dewPointC: NullableNumber;
  dewPointF: NullableNumber;
  humidityPercent: NullableNumber;
  pressureHpa: NullableNumber;
  pressureInHg: NullableNumber;
  windSpeedMps: NullableNumber;
  windSpeedMph: NullableNumber;
  windGustMps: NullableNumber;
  windGustMph: NullableNumber;
  precipitationDayMm: NullableNumber;
  precipitationDayIn: NullableNumber;
  precipitation24hMm: NullableNumber;
  precipitation24hIn: NullableNumber;
  solarRadiationWm2: NullableNumber;
  soilTempC: NullableNumber;
  soilTempF: NullableNumber;
  soilMoisturePercent: NullableNumber;
};

export type StationHistoryResponse = {
  fetchedAt: string;
  station: StationInfo | null;
  history: {
    captureIntervalSeconds: number;
    snapshotCount: number;
    from: string;
    to: string;
  };
  points: HistoryPoint[];
};

