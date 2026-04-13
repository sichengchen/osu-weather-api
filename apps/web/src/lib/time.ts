const FRONTEND_TIME_ZONE = "America/New_York";

const shortDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  timeZone: FRONTEND_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short"
});

const compactDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  timeZone: FRONTEND_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

const frontendDateTimePartFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: FRONTEND_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});

export function formatFrontendTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return shortDateTimeFormatter.format(date);
}

export function formatFrontendTimestampCompact(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return compactDateTimeFormatter.format(date);
}

export function formatObservationTimestamp(rawValue: string, fallback: string): string {
  if (!rawValue || rawValue === "unknown") {
    return fallback;
  }

  const date = new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return shortDateTimeFormatter.format(date);
}

export function formatFrontendDateTimeInputValue(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = getFrontendDateTimeParts(date);

  return `${parts.year}-${padDateTimePart(parts.month)}-${padDateTimePart(parts.day)}T${padDateTimePart(parts.hour)}:${padDateTimePart(parts.minute)}`;
}

export function parseFrontendDateTimeInputValue(value: string): string | null {
  const match = value.match(
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2})$/
  );

  if (!match?.groups) {
    return null;
  }

  const year = Number.parseInt(match.groups.year, 10);
  const month = Number.parseInt(match.groups.month, 10);
  const day = Number.parseInt(match.groups.day, 10);
  const hour = Number.parseInt(match.groups.hour, 10);
  const minute = Number.parseInt(match.groups.minute, 10);
  const baseUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  let resolvedUtcMs = baseUtcMs;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetMinutes = getFrontendTimeZoneOffsetMinutes(new Date(resolvedUtcMs));
    const nextUtcMs = baseUtcMs - offsetMinutes * 60_000;

    if (nextUtcMs === resolvedUtcMs) {
      break;
    }

    resolvedUtcMs = nextUtcMs;
  }

  const resolvedIso = new Date(resolvedUtcMs).toISOString();

  return formatFrontendDateTimeInputValue(resolvedIso) === value ? resolvedIso : null;
}

export { FRONTEND_TIME_ZONE };

type FrontendDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getFrontendDateTimeParts(date: Date): FrontendDateTimeParts {
  const initialParts: FrontendDateTimeParts = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0
  };

  for (const part of frontendDateTimePartFormatter.formatToParts(date)) {
    if (part.type in initialParts) {
      const key = part.type as keyof FrontendDateTimeParts;
      initialParts[key] = Number.parseInt(part.value, 10);
    }
  }

  return initialParts;
}

function getFrontendTimeZoneOffsetMinutes(date: Date): number {
  const parts = getFrontendDateTimeParts(date);
  const zonedUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);

  return Math.round((zonedUtcMs - date.getTime()) / 60_000);
}

function padDateTimePart(value: number): string {
  return value.toString().padStart(2, "0");
}
