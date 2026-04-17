# API Docs

## Overview

The API exposes live Ohio Mesonet station data plus history snapshots stored in D1.

Base path:

```text
/api
```

Responses are JSON. Timestamps are ISO 8601 unless otherwise noted.

## Endpoints

### `GET /api/health`

Returns a lightweight health payload for the Worker and the configured history capture interval.

Example response:

```json
{
  "ok": true,
  "captureIntervalSeconds": 600
}
```

### `GET /api/stations`

Returns the station catalog used by the app.

Example response shape:

```json
{
  "fetchedAt": "2026-04-13T19:00:00.000Z",
  "count": 14,
  "stations": [
    {
      "stationId": "BYRD",
      "stationName": "Byrd Polar Research Center",
      "county": "Franklin",
      "location": "5 NW Columbus",
      "networkId": "UHI",
      "providerId": "SCOO",
      "designLevel": 1,
      "latitude": 40.002764,
      "longitude": -83.038476,
      "elevationMeters": 239,
      "elevationFeet": 784
    }
  ]
}
```

### `GET /api/current`

Returns the latest current statewide snapshot written by the scheduled refresh job, including:

- fetch metadata
- history capture metadata
- source feed URLs
- summary metrics
- current conditions for every station

Example response shape:

```json
{
  "fetchedAt": "2026-04-13T19:00:00.000Z",
  "history": {
    "captureIntervalSeconds": 600,
    "lastCaptureAt": "2026-04-13T18:50:00.000Z"
  },
  "source": {
    "stationCatalogUrl": "https://www.ohmesonet.org/api/dataBackend/stationInfos",
    "statewideCurrentUrl": "https://www.ohmesonet.org/api/dataBackend/current-0-all-locations&1950-07-19-2022-09-04",
    "byrdCurrentUrl": "https://api.dev.ohmesonet.org/v2/obs/current?station_id[]=BYRD&units=imperial",
    "metricInfoUrl": "https://www.ohmesonet.org/api/dataBackend/metricInfos"
  },
  "summary": {
    "stationCount": 14,
    "networkCount": 4,
    "warmest": null,
    "windiest": null,
    "wettest24h": null,
    "sunniest": null
  },
  "stations": []
}
```

### `GET /api/stations/:stationId/current`

Returns a single station’s current conditions plus the same history metadata used by the UI.

Example:

```text
/api/stations/BYRD/current
```

### `GET /api/stations/:stationId/history?from=2026-04-10T19:00:00.000Z&to=2026-04-13T19:00:00.000Z`

Returns historical snapshots for a single station within the requested time range.

Query parameters:

- `from`
  Optional ISO-8601 start timestamp for a custom range.
  Must be provided together with `to`.

- `to`
  Optional ISO-8601 end timestamp for a custom range.
  Must be provided together with `from`.

- `hours`
  Integer hour range used when `from` and `to` are omitted.
  Defaults to `72`.
  Minimum value is `1`.

Example:

```text
/api/stations/BYRD/history?from=2026-04-10T19:00:00.000Z&to=2026-04-13T19:00:00.000Z
```

Example response shape:

```json
{
  "fetchedAt": "2026-04-13T19:00:00.000Z",
  "station": {
    "stationId": "BYRD",
    "stationName": "Byrd Polar Research Center",
    "county": "Franklin",
    "location": "5 NW Columbus",
    "networkId": "UHI",
    "providerId": "SCOO",
    "designLevel": 1,
    "latitude": 40.002764,
    "longitude": -83.038476,
    "elevationMeters": 239,
    "elevationFeet": 784
  },
  "history": {
    "captureIntervalSeconds": 600,
    "snapshotCount": 15,
    "from": "2026-04-10T19:00:00.000Z",
    "to": "2026-04-13T19:00:00.000Z"
  },
  "points": []
}
```

### `GET /api/history?stationId=BYRD&from=2026-04-10T19:00:00.000Z&to=2026-04-13T19:00:00.000Z`

Legacy query-string variant of the per-station history endpoint.

Required query parameters:

- `stationId`

Optional query parameters:

- `from`
- `to`
- `hours`

If `stationId` is missing, the API returns `400`.

## Current Condition Fields

Current station records include:

- air temperature
- dew point
- relative humidity
- sea level pressure
- wind direction
- wind speed
- wind gust
- solar radiation
- precipitation since midnight
- precipitation in the last hour
- precipitation over 24 hours
- soil temperature
- soil moisture

Field names and exact response types are shared in [`packages/shared/src/index.ts`](../packages/shared/src/index.ts).

## History Fields

History points mirror the weather fields used by the frontend charts, including:

- air temperature
- dew point
- relative humidity
- pressure
- wind speed
- wind gust
- solar radiation
- 24-hour precipitation
- soil temperature
- soil moisture

## Errors

Standard error shape:

```json
{
  "error": "not_found",
  "message": "Unknown station: XXXX"
}
```

Possible statuses:

- `400` for invalid or missing query parameters
- `404` for unknown stations
- `503` when the scheduled current snapshot has not been populated yet
- `500` for internal or upstream failures

## Notes

- `BYRD` blends the dedicated BYRD current feed with statewide fallback data when some fields are missing upstream.
- History is stored in D1.
- Current snapshots and live history captures are written by the scheduled refresh job.
- Imported CSV backfills can coexist with live captures in the same history table.
- Soil metrics may be `null` for stations or windows where upstream data is unavailable.
