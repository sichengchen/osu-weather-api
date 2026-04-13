# OSU Weather API

OSU Weather API provides live Ohio Mesonet station conditions, adds BYRD observations from the Byrd Polar and Climate Research Center feed, stores recent weather history in Cloudflare D1, and exposes both API endpoints and a web dashboard for exploring current conditions and trends.

View [Dashboard](https://osu-weather.scchan.moe)

## API Routes

Full endpoint details and response examples: [API docs](./docs/API.md)

Demo API base URL: `https://osu-weather.scchan.moe`

- `GET /api/health`: service health and history capture interval
- `GET /api/stations`: station catalog
- `GET /api/current`: statewide current conditions plus summary metrics
- `GET /api/stations/:stationId/current`: current conditions for one station
- `GET /api/history?stationId=BYRD&hours=72`: recent history for one station
- `GET /api/history?stationId=BYRD&from=2026-04-13T00:00:00Z&to=2026-04-13T12:00:00Z`: custom history range
- `GET /api/stations/:stationId/history?hours=72`: station history by path parameter

## Overview

- `apps/api`: Hono-based Cloudflare Worker API
- `apps/web`: React + Tailwind dashboard built with Vite
- `packages/shared`: shared TypeScript models used by the API and frontend

## Features

- Serves live statewide current conditions for Ohio Mesonet stations
- Merges BYRD into the current conditions feed
- Captures historical snapshots into D1 on a configurable interval
- Exposes station catalog, current conditions, and per-station history endpoints
- Ships a browser UI for exploring stations and recent trends

## Requirements

- Node.js 20 or newer
- npm 11 or newer

## Local Development

Install dependencies:

```bash
npm install
```

Start the API and frontend together:

```bash
npm run dev
```

Local URLs:

- API: `http://127.0.0.1:8787`
- Web app: `http://127.0.0.1:5173`

Useful root commands:

```bash
npm run dev
npm run dev:api
npm run dev:web
npm run types
npm run lint
npm run test
npm run check
npm run build
npm run deploy
```

## Repository Layout

```text
apps/
  api/      Cloudflare Worker source and Wrangler config
  web/      React frontend
packages/
  shared/   Shared API and UI types
```

## Configuration

`apps/api/wrangler.jsonc` defines the Worker bindings and defaults:

- `WEATHER_DB`: D1 database for historical observations
- `HISTORY_CAPTURE_INTERVAL_SECONDS`: minimum seconds between captures
- `triggers.crons`: scheduled Worker trigger for background history capture

The default capture interval is `600` seconds.

## Cloudflare Deployment

1. Create a D1 database for `WEATHER_DB`.
2. Replace the placeholder `database_id` and `preview_database_id` values in [apps/api/wrangler.jsonc](/Users/sichengchen/src/osu-bpcrc-weather-api/apps/api/wrangler.jsonc).
3. Apply migrations:

```bash
npm --workspace @osu-weather/api run db:migrate:remote
```

4. If you are backfilling historical CSV data, generate a SQL import file:

```bash
npm run history:sql -- ~/Downloads/all-locations_2026-01-01-2026-12-31_2026.csv /tmp/weather-history-import.sql
```

5. Import the SQL file into D1:

```bash
npx wrangler d1 execute WEATHER_DB --remote --config apps/api/wrangler.jsonc --file /tmp/weather-history-import.sql
```

6. Build and deploy:

```bash
npm run deploy
```

The bundled importer skips malformed rows, which is useful for CSV exports that end with an upstream HTML error page instead of clean CSV.

## Data Sources

- [Byrd weather page](https://byrd.osu.edu/wx)
- [OH Mesonet station catalog](https://www.ohmesonet.org/api/dataBackend/stationInfos)
- [OH Mesonet statewide current feed](https://www.ohmesonet.org/api/dataBackend/current-0-all-locations&1950-07-19-2022-09-04)
- [OH Mesonet BYRD current feed](https://api.dev.ohmesonet.org/v2/obs/current?station_id[]=BYRD&units=imperial)
- [OH Mesonet metric metadata](https://www.ohmesonet.org/api/dataBackend/metricInfos)
