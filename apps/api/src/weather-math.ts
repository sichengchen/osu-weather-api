export function toNullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function convertNullable(
  value: string | number | null | undefined,
  convert: (value: number) => number
): number | null {
  const numeric = toNullableNumber(value);
  return numeric === null ? null : round(convert(numeric));
}

export function cToF(value: number): number {
  return value * (9 / 5) + 32;
}

export function fToC(value: number): number {
  return (value - 32) * (5 / 9);
}

export function mpsToMph(value: number): number {
  return value * 2.2369362921;
}

export function mphToMps(value: number): number {
  return value * 0.44704;
}

export function mmToInches(value: number): number {
  return value / 25.4;
}

export function inchesToMm(value: number): number {
  return value * 25.4;
}

export function hpaToInHg(value: number): number {
  return value * 0.0295299830714;
}

export function inHgToHpa(value: number): number {
  return value * 33.8638866667;
}

export function normalizeStatewidePressure(value: number | null | undefined): number | null {
  const numeric = toNullableNumber(value);

  if (numeric === null) {
    return null;
  }

  if (numeric >= 850 && numeric <= 1100) {
    return round(numeric);
  }

  if (numeric >= 85 && numeric <= 110) {
    return round(numeric * 10);
  }

  return null;
}

export function round(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}

