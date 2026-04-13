import { describe, expect, it } from "vitest";

import {
  cToF,
  hpaToInHg,
  inHgToHpa,
  mmToInches,
  normalizeStatewidePressure,
  round,
  toNullableNumber
} from "./weather-math";

describe("weather math", () => {
  it("normalizes pressure values already in hPa", () => {
    expect(normalizeStatewidePressure(1016.38)).toBe(1016.38);
  });

  it("normalizes pressure values that arrive as truncated kilopascals", () => {
    expect(normalizeStatewidePressure(101.38)).toBe(1013.8);
  });

  it("drops invalid statewide pressure values", () => {
    expect(normalizeStatewidePressure(67.098)).toBeNull();
    expect(normalizeStatewidePressure(null)).toBeNull();
  });

  it("converts between pressure units consistently", () => {
    expect(round(hpaToInHg(1013.25))).toBe(29.92);
    expect(round(inHgToHpa(30.17))).toBe(1021.67);
  });

  it("converts precipitation from millimeters to inches", () => {
    expect(round(mmToInches(25.4))).toBe(1);
  });

  it("converts celsius to fahrenheit", () => {
    expect(round(cToF(24.39))).toBe(75.9);
  });

  it("parses nullable feed numbers", () => {
    expect(toNullableNumber("16.5")).toBe(16.5);
    expect(toNullableNumber("")).toBeNull();
  });
});

