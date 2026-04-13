import type { Context } from "hono";
import { Hono } from "hono";

import { buildCurrentWeatherResponse, getCurrentStations, getStationCatalog } from "./ohmesonet";
import {
  ensureInitialCapture,
  getHistoryCaptureIntervalSeconds,
  getLastHistoryCaptureAt,
  type HistoryRange,
  getStationHistory,
  maybeCaptureHistory
} from "./history";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => {
  return c.json({
    ok: true,
    captureIntervalSeconds: getHistoryCaptureIntervalSeconds(c.env)
  });
});

app.get("/api/stations", async (c) => {
  const stations = await getStationCatalog();

  return c.json({
    fetchedAt: new Date().toISOString(),
    count: stations.length,
    stations
  });
});

app.get("/api/current", async (c) => {
  const stations = await getCurrentStations();
  const lastCaptureAt = await getLastHistoryCaptureAt(c.env);
  c.executionCtx.waitUntil(maybeCaptureHistory(c.env, stations));

  return c.json(await buildCurrentWeatherResponse(lastCaptureAt, getHistoryCaptureIntervalSeconds(c.env)));
});

app.get("/api/stations/:stationId/current", async (c) => {
  const stationId = c.req.param("stationId").toUpperCase();
  const stations = await getCurrentStations();
  const station = stations.find((entry) => entry.stationId === stationId);

  if (!station) {
    return notFound(c, `Unknown station: ${stationId}`);
  }

  c.executionCtx.waitUntil(maybeCaptureHistory(c.env, stations));

  return c.json({
    fetchedAt: new Date().toISOString(),
    history: {
      captureIntervalSeconds: getHistoryCaptureIntervalSeconds(c.env),
      lastCaptureAt: await getLastHistoryCaptureAt(c.env)
    },
    station
  });
});

app.get("/api/history", async (c) => {
  const stationId = c.req.query("stationId")?.toUpperCase();
  const range = parseHistoryRange(c.req.query("from"), c.req.query("to"), c.req.query("hours"));

  if (!stationId) {
    return c.json(
      {
        error: "missing_station_id",
        message: "Provide a stationId query parameter, for example /api/history?stationId=BYRD&hours=72."
      },
      400
    );
  }

  if (!range.ok) {
    return c.json(
      {
        error: range.error,
        message: range.message
      },
      400
    );
  }

  await ensureInitialCapture(c.env);
  return c.json(await getStationHistory(c.env, stationId, range.value));
});

app.get("/api/stations/:stationId/history", async (c) => {
  const stationId = c.req.param("stationId").toUpperCase();
  const range = parseHistoryRange(c.req.query("from"), c.req.query("to"), c.req.query("hours"));

  if (!range.ok) {
    return c.json(
      {
        error: range.error,
        message: range.message
      },
      400
    );
  }

  await ensureInitialCapture(c.env);
  const history = await getStationHistory(c.env, stationId, range.value);

  if (!history.station) {
    return notFound(c, `Unknown station: ${stationId}`);
  }

  return c.json(history);
});

app.onError((error, c) => {
  console.error(JSON.stringify({ level: "error", route: c.req.path, message: error.message }));

  return c.json(
    {
      error: "internal_error",
      message: error.message
    },
    500
  );
});

function parseHours(input?: string): number {
  const parsed = Number.parseInt(input ?? "72", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 72;
  }

  return parsed;
}

function parseHistoryRange(
  fromInput?: string,
  toInput?: string,
  hoursInput?: string
):
  | { ok: true; value: HistoryRange }
  | { ok: false; error: "invalid_history_range"; message: string } {
  if (!fromInput && !toInput) {
    const now = new Date();
    const hours = parseHours(hoursInput);

    return {
      ok: true,
      value: {
        from: new Date(now.getTime() - hours * 60 * 60 * 1_000).toISOString(),
        to: now.toISOString()
      }
    };
  }

  if (!fromInput || !toInput) {
    return {
      ok: false,
      error: "invalid_history_range",
      message: "Provide both from and to query parameters when requesting a custom history range."
    };
  }

  const from = new Date(fromInput);
  const to = new Date(toInput);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return {
      ok: false,
      error: "invalid_history_range",
      message: "History range timestamps must be valid ISO-8601 date strings."
    };
  }

  if (from.getTime() >= to.getTime()) {
    return {
      ok: false,
      error: "invalid_history_range",
      message: "History range start time must be earlier than the end time."
    };
  }

  return {
    ok: true,
    value: {
      from: from.toISOString(),
      to: to.toISOString()
    }
  };
}

function notFound(c: Context, message: string) {
  return c.json(
    {
      error: "not_found",
      message
    },
    404
  );
}

export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledEvent, env: Env) => {
    await maybeCaptureHistory(env);
  }
};
