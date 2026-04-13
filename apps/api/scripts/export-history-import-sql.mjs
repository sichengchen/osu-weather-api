import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const [, , csvPath, outputPathArg] = process.argv;

if (!csvPath) {
  console.error("Usage: node apps/api/scripts/export-history-import-sql.mjs <csv-path> [sql-output-path]");
  process.exit(1);
}

const resolvedCsvPath = path.resolve(csvPath);
const resolvedOutputPath = path.resolve(outputPathArg ?? path.join("dist", "weather-history-import.sql"));
const BATCH_SIZE = 100;
const INSERT_COLUMNS = [
  "station_id",
  "captured_at",
  "observed_at",
  "observed_at_display",
  "air_temp_c",
  "air_temp_f",
  "dew_point_c",
  "dew_point_f",
  "humidity_percent",
  "pressure_hpa",
  "pressure_in_hg",
  "wind_speed_mps",
  "wind_speed_mph",
  "wind_gust_mps",
  "wind_gust_mph",
  "precipitation_day_mm",
  "precipitation_day_in",
  "precipitation_24h_mm",
  "precipitation_24h_in",
  "solar_radiation_wm2",
  "soil_temp_c",
  "soil_temp_f",
  "soil_moisture_percent",
  "source"
];

await mkdir(path.dirname(resolvedOutputPath), { recursive: true });

const reader = readline.createInterface({
  input: createReadStream(resolvedCsvPath, { encoding: "utf8" }),
  crlfDelay: Infinity
});
const writer = createWriteStream(resolvedOutputPath, { encoding: "utf8" });

let headerMap = null;
let lineNumber = 0;
let importedRows = 0;
let skippedRows = 0;
let batch = [];
let earliestObservedAt = null;
let latestObservedAt = null;
const stations = new Set();

for await (const line of reader) {
  lineNumber += 1;

  if (lineNumber === 1) {
    headerMap = buildHeaderMap(parseCsvLine(line));
    continue;
  }

  if (!line.trim()) {
    continue;
  }

  const fields = parseCsvLine(line);
  const row = toHistoryRow(fields, headerMap);

  if (!row) {
    skippedRows += 1;
    continue;
  }

  stations.add(row.station_id);
  earliestObservedAt = earliestObservedAt === null || row.observed_at < earliestObservedAt ? row.observed_at : earliestObservedAt;
  latestObservedAt = latestObservedAt === null || row.observed_at > latestObservedAt ? row.observed_at : latestObservedAt;
  batch.push(row);

  if (batch.length >= BATCH_SIZE) {
    writer.write(buildInsertStatement(batch));
    importedRows += batch.length;
    batch = [];
  }
}

if (batch.length > 0) {
  writer.write(buildInsertStatement(batch));
  importedRows += batch.length;
}

writer.end();

await new Promise((resolve, reject) => {
  writer.on("finish", resolve);
  writer.on("error", reject);
});

console.log(
  JSON.stringify(
    {
      csvPath: resolvedCsvPath,
      sqlPath: resolvedOutputPath,
      importedRows,
      skippedRows,
      stationCount: stations.size,
      stations: [...stations].sort(),
      earliestObservedAt,
      latestObservedAt
    },
    null,
    2
  )
);

function buildHeaderMap(columns) {
  return new Map(columns.map((value, index) => [value, index]));
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === "\"") {
      const nextCharacter = line[index + 1];

      if (inQuotes && nextCharacter === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

function toHistoryRow(fields, headers) {
  const recordNumber = getField(fields, headers, "Record Number");

  if (!/^\d+$/.test(recordNumber)) {
    return null;
  }

  const stationId = getField(fields, headers, "Station ID").toUpperCase();
  const rawObservedAt = getField(fields, headers, "Observation Timestamp (UTC)");
  const observedAt = normalizeUtcTimestamp(rawObservedAt);

  if (!stationId || !observedAt) {
    return null;
  }

  const temperatureF = parseNullableNumber(getField(fields, headers, "Temperature (F)"));
  const dewPointF = parseNullableNumber(getField(fields, headers, "Dewpoint (F)"));
  const windSpeedMph = parseNullableNumber(getField(fields, headers, "Wind Speed (mph)"));
  const windGustMph = parseNullableNumber(getField(fields, headers, "Wind Gust (mph)"));
  const pressureInHg = parseNullableNumber(getField(fields, headers, "Sea Level Pressure (in. Hg)"));
  const precipitationIn = parseNullableNumber(getField(fields, headers, "Precipitation (in)"));
  const soilTempF = parseNullableNumber(getField(fields, headers, "Soil Temperature at 2 in. (F)"));

  return {
    station_id: stationId,
    captured_at: observedAt,
    observed_at: observedAt,
    observed_at_display: `${rawObservedAt} UTC`,
    air_temp_c: toNullableCelsius(temperatureF),
    air_temp_f: temperatureF,
    dew_point_c: toNullableCelsius(dewPointF),
    dew_point_f: dewPointF,
    humidity_percent: parseNullableNumber(getField(fields, headers, "Relative Humidity (%)")),
    pressure_hpa: toNullableHpa(pressureInHg),
    pressure_in_hg: pressureInHg,
    wind_speed_mps: toNullableMetersPerSecond(windSpeedMph),
    wind_speed_mph: windSpeedMph,
    wind_gust_mps: toNullableMetersPerSecond(windGustMph),
    wind_gust_mph: windGustMph,
    precipitation_day_mm: toNullableMillimeters(precipitationIn),
    precipitation_day_in: precipitationIn,
    precipitation_24h_mm: null,
    precipitation_24h_in: null,
    solar_radiation_wm2: parseNullableNumber(getField(fields, headers, "Solar Radiation (W/m^2)")),
    soil_temp_c: toNullableCelsius(soilTempF),
    soil_temp_f: soilTempF,
    soil_moisture_percent: parseNullableNumber(getField(fields, headers, "Soil moisture at 2 in. (%)")),
    source: "csv_backfill"
  };
}

function getField(fields, headers, name) {
  const index = headers.get(name);
  return typeof index === "number" ? (fields[index] ?? "") : "";
}

function normalizeUtcTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  return value.replace(" ", "T") + "Z";
}

function parseNullableNumber(value) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableCelsius(value) {
  return value === null ? null : roundNumber((value - 32) / 1.8);
}

function toNullableHpa(value) {
  return value === null ? null : roundNumber(value * 33.8639);
}

function toNullableMetersPerSecond(value) {
  return value === null ? null : roundNumber(value * 0.44704);
}

function toNullableMillimeters(value) {
  return value === null ? null : roundNumber(value * 25.4);
}

function roundNumber(value) {
  return Math.round(value * 100) / 100;
}

function escapeSql(value) {
  return value.replaceAll("'", "''");
}

function toSqlValue(value) {
  if (value === null) {
    return "NULL";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "NULL";
  }

  return `'${escapeSql(value)}'`;
}

function buildInsertStatement(rows) {
  const valuesSql = rows
    .map((row) => `(${INSERT_COLUMNS.map((column) => toSqlValue(row[column])).join(", ")})`)
    .join(",\n");

  return [
    `INSERT INTO weather_history (${INSERT_COLUMNS.join(", ")})`,
    "VALUES",
    valuesSql,
    "ON CONFLICT (station_id, captured_at) DO UPDATE SET",
    "  observed_at = excluded.observed_at,",
    "  observed_at_display = excluded.observed_at_display,",
    "  air_temp_c = excluded.air_temp_c,",
    "  air_temp_f = excluded.air_temp_f,",
    "  dew_point_c = excluded.dew_point_c,",
    "  dew_point_f = excluded.dew_point_f,",
    "  humidity_percent = excluded.humidity_percent,",
    "  pressure_hpa = excluded.pressure_hpa,",
    "  pressure_in_hg = excluded.pressure_in_hg,",
    "  wind_speed_mps = excluded.wind_speed_mps,",
    "  wind_speed_mph = excluded.wind_speed_mph,",
    "  wind_gust_mps = excluded.wind_gust_mps,",
    "  wind_gust_mph = excluded.wind_gust_mph,",
    "  precipitation_day_mm = excluded.precipitation_day_mm,",
    "  precipitation_day_in = excluded.precipitation_day_in,",
    "  precipitation_24h_mm = excluded.precipitation_24h_mm,",
    "  precipitation_24h_in = excluded.precipitation_24h_in,",
    "  solar_radiation_wm2 = excluded.solar_radiation_wm2,",
    "  soil_temp_c = excluded.soil_temp_c,",
    "  soil_temp_f = excluded.soil_temp_f,",
    "  soil_moisture_percent = excluded.soil_moisture_percent,",
    "  source = excluded.source;",
    ""
  ].join("\n");
}
