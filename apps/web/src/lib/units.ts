import type { HistoryPoint, StationConditions, StationInfo } from "@osu-weather/shared";

export type UnitSystem = "imperial" | "metric";

const UNIT_STORAGE_KEY = "weather-unit-system";

export function getInitialUnitSystem(): UnitSystem {
  if (typeof window === "undefined") {
    return "imperial";
  }

  const stored = window.localStorage.getItem(UNIT_STORAGE_KEY);
  return stored === "metric" ? "metric" : "imperial";
}

export function persistUnitSystem(unitSystem: UnitSystem): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(UNIT_STORAGE_KEY, unitSystem);
}

export function formatTemperature(conditions: StationConditions | null | undefined, unitSystem: UnitSystem, precision = 0): string {
  return formatTemperatureValue(conditions?.airTempC, conditions?.airTempF, unitSystem, precision);
}

export function formatDewPoint(conditions: StationConditions | null | undefined, unitSystem: UnitSystem, precision = 0): string {
  return formatTemperatureValue(conditions?.dewPointC, conditions?.dewPointF, unitSystem, precision);
}

export function formatSoilTemperature(conditions: StationConditions | null | undefined, unitSystem: UnitSystem, precision = 0): string {
  return formatTemperatureValue(conditions?.soilTempC, conditions?.soilTempF, unitSystem, precision);
}

export function formatHumidity(conditions: StationConditions | null | undefined): string {
  return formatNullable(conditions?.humidityPercent, "%", 0);
}

export function formatWindSpeed(conditions: StationConditions | null | undefined, unitSystem: UnitSystem, precision?: number): string {
  return formatWindValue(conditions?.windSpeedMps, conditions?.windSpeedMph, unitSystem, precision);
}

export function formatWindGust(conditions: StationConditions | null | undefined, unitSystem: UnitSystem, precision?: number): string {
  return formatWindValue(conditions?.windGustMps, conditions?.windGustMph, unitSystem, precision);
}

export function formatWindDirection(conditions: StationConditions | null | undefined): string {
  return conditions?.windDirectionCardinal ?? "--";
}

export function formatPressure(conditions: StationConditions | null | undefined, unitSystem: UnitSystem): string {
  const value = unitSystem === "metric" ? conditions?.pressureHpa : conditions?.pressureInHg;
  return formatNullable(value, unitSystem === "metric" ? " hPa" : " inHg", unitSystem === "metric" ? 0 : 2);
}

export function formatRainDay(conditions: StationConditions | null | undefined, unitSystem: UnitSystem): string {
  return formatRainValue(conditions?.precipitationDayMm, conditions?.precipitationDayIn, unitSystem);
}

export function formatRain1h(conditions: StationConditions | null | undefined, unitSystem: UnitSystem): string {
  return formatRainValue(conditions?.precipitation1hMm, conditions?.precipitation1hIn, unitSystem);
}

export function formatRain24h(conditions: StationConditions | null | undefined, unitSystem: UnitSystem): string {
  return formatRainValue(conditions?.precipitation24hMm, conditions?.precipitation24hIn, unitSystem);
}

export function formatSolarRadiation(conditions: StationConditions | null | undefined): string {
  return formatNullable(conditions?.solarRadiationWm2, " W/m²", 0);
}

export function formatSoilMoisture(conditions: StationConditions | null | undefined): string {
  return formatNullable(conditions?.soilMoisturePercent, "%", 0);
}

export function formatElevation(station: StationInfo | null | undefined, unitSystem: UnitSystem): string {
  if (!station) {
    return "--";
  }

  const value = unitSystem === "metric" ? station.elevationMeters : station.elevationFeet;
  return `${value.toFixed(unitSystem === "metric" ? 0 : 0)} ${unitSystem === "metric" ? "m" : "ft"}`;
}

export function getTemperatureChartConfig(unitSystem: UnitSystem) {
  return {
    unit: unitSystem === "metric" ? "°C" : "°F",
    accessor: (point: HistoryPoint) => (unitSystem === "metric" ? point.airTempC : point.airTempF)
  };
}

export function getDewPointChartConfig(unitSystem: UnitSystem) {
  return {
    unit: unitSystem === "metric" ? "°C" : "°F",
    accessor: (point: HistoryPoint) => (unitSystem === "metric" ? point.dewPointC : point.dewPointF)
  };
}

export function getWindChartConfig(unitSystem: UnitSystem) {
  return {
    unit: unitSystem === "metric" ? "m/s" : "mph",
    accessor: (point: HistoryPoint) => (unitSystem === "metric" ? point.windSpeedMps : point.windSpeedMph)
  };
}

export function getWindGustChartConfig(unitSystem: UnitSystem) {
  return {
    unit: unitSystem === "metric" ? "m/s" : "mph",
    accessor: (point: HistoryPoint) => (unitSystem === "metric" ? point.windGustMps : point.windGustMph)
  };
}

export function getRainChartConfig(unitSystem: UnitSystem) {
  return {
    unit: unitSystem === "metric" ? "mm" : "in",
    accessor: (point: HistoryPoint) => (unitSystem === "metric" ? point.precipitation24hMm : point.precipitation24hIn)
  };
}

export function getPressureChartConfig(unitSystem: UnitSystem) {
  return {
    unit: unitSystem === "metric" ? "hPa" : "inHg",
    accessor: (point: HistoryPoint) => (unitSystem === "metric" ? point.pressureHpa : point.pressureInHg)
  };
}

export function getSoilTemperatureChartConfig(unitSystem: UnitSystem) {
  return {
    unit: unitSystem === "metric" ? "°C" : "°F",
    accessor: (point: HistoryPoint) => (unitSystem === "metric" ? point.soilTempC : point.soilTempF)
  };
}

export function getSolarChartConfig() {
  return {
    unit: "W/m²",
    accessor: (point: HistoryPoint) => point.solarRadiationWm2
  };
}

function formatTemperatureValue(
  metricValue: number | null | undefined,
  imperialValue: number | null | undefined,
  unitSystem: UnitSystem,
  precision: number
): string {
  const value = unitSystem === "metric" ? metricValue : imperialValue;
  return formatNullable(value, unitSystem === "metric" ? "°C" : "°F", precision);
}

function formatWindValue(
  metricValue: number | null | undefined,
  imperialValue: number | null | undefined,
  unitSystem: UnitSystem,
  precision?: number
): string {
  const value = unitSystem === "metric" ? metricValue : imperialValue;
  const fallbackPrecision = unitSystem === "metric" ? 1 : 0;
  return formatNullable(value, unitSystem === "metric" ? " m/s" : " mph", precision ?? fallbackPrecision);
}

function formatRainValue(
  metricValue: number | null | undefined,
  imperialValue: number | null | undefined,
  unitSystem: UnitSystem
): string {
  const value = unitSystem === "metric" ? metricValue : imperialValue;
  return formatNullable(value, unitSystem === "metric" ? " mm" : " in", unitSystem === "metric" ? 1 : 2);
}

function formatNullable(value: number | null | undefined, suffix: string, precision: number): string {
  if (value === null || value === undefined) {
    return "--";
  }

  return `${value.toFixed(precision)}${suffix}`;
}
