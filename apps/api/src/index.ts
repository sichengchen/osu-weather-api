import type { Context } from "hono";
import { Hono } from "hono";

import {
  getCurrentWeatherSnapshot,
  getStationCatalogFromSnapshot,
  getStationCurrentFromSnapshot,
  getStationInfoFromSnapshot,
  refreshCurrentWeatherSnapshot
} from "./current-snapshot";
import { getCurrentStations } from "./ohmesonet";
import {
  getHistoryCaptureIntervalSeconds,
  type HistoryRange,
  getStationHistory,
  getLastHistoryCaptureAt,
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
  const snapshot = await getCurrentWeatherSnapshot(c.env);

  if (!snapshot) {
    return currentSnapshotUnavailable(c);
  }

  return c.json({
    fetchedAt: snapshot.fetchedAt,
    count: snapshot.stations.length,
    stations: getStationCatalogFromSnapshot(snapshot)
  });
});

app.get("/api/current", async (c) => {
  const snapshot = await getCurrentWeatherSnapshot(c.env);

  if (!snapshot) {
    return currentSnapshotUnavailable(c);
  }

  return c.json(snapshot);
});

app.get("/api/stations/:stationId/current", async (c) => {
  const stationId = c.req.param("stationId").toUpperCase();
  const snapshot = await getCurrentWeatherSnapshot(c.env);

  if (!snapshot) {
    return currentSnapshotUnavailable(c);
  }

  const station = getStationCurrentFromSnapshot(snapshot, stationId);

  if (!station) {
    return notFound(c, `Unknown station: ${stationId}`);
  }

  return c.json({
    fetchedAt: snapshot.fetchedAt,
    history: snapshot.history,
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

  const snapshot = await getCurrentWeatherSnapshot(c.env);

  if (!snapshot) {
    return currentSnapshotUnavailable(c);
  }

  const station = getStationInfoFromSnapshot(snapshot, stationId);

  if (!station) {
    return notFound(c, `Unknown station: ${stationId}`);
  }

  return c.json(await getStationHistory(c.env, stationId, range.value, station));
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

  const snapshot = await getCurrentWeatherSnapshot(c.env);

  if (!snapshot) {
    return currentSnapshotUnavailable(c);
  }

  const station = getStationInfoFromSnapshot(snapshot, stationId);

  if (!station) {
    return notFound(c, `Unknown station: ${stationId}`);
  }

  const history = await getStationHistory(c.env, stationId, range.value, station);
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
  scheduled: async (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(refreshCurrentSnapshotAndHistory(env));
  }
};

async function refreshCurrentSnapshotAndHistory(env: Env): Promise<void> {
  const stations = await getCurrentStations();
  const captureResult = await maybeCaptureHistory(env, stations);

  await refreshCurrentWeatherSnapshot(env, {
    stations,
    captureIntervalSeconds: getHistoryCaptureIntervalSeconds(env),
    lastCaptureAt: captureResult.capturedAt ?? (await getLastHistoryCaptureAt(env))
  });
}

function currentSnapshotUnavailable(c: Context) {
  return c.json(
    {
      error: "current_snapshot_unavailable",
      message: "Current weather snapshot unavailable. Wait for the scheduled refresh to populate D1."
    },
    503
  );
}
