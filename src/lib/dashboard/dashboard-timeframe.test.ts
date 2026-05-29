import { describe, expect, it } from "vitest";

import {
  getDashboardTimeframeRange,
  parseDashboardTimeframe,
  toDashboardTimeframeSearchParams,
} from "./dashboard-timeframe";

describe("dashboard timeframe", () => {
  const referenceDate = new Date("2026-04-16T12:00:00.000Z");

  it("defaults to the current timeframe when no params are given", () => {
    expect(parseDashboardTimeframe(undefined, referenceDate)).toEqual({
      mode: "current",
      from: null,
      to: null,
    });
  });

  it("parses the rolling 14-day mode from URL params", () => {
    const timeframe = parseDashboardTimeframe(
      new URLSearchParams({ timeframe: "14d" }),
      referenceDate
    );

    expect(timeframe).toEqual({
      mode: "14d",
      from: null,
      to: null,
    });
    expect(getDashboardTimeframeRange(timeframe, referenceDate)).toEqual({
      from: "2026-04-03",
      to: "2026-04-16",
    });
  });

  it("parses the next-30-day mode from URL params", () => {
    const timeframe = parseDashboardTimeframe(
      new URLSearchParams({ timeframe: "30d" }),
      referenceDate
    );

    expect(timeframe).toEqual({
      mode: "30d",
      from: null,
      to: null,
    });
    expect(getDashboardTimeframeRange(timeframe, referenceDate)).toEqual({
      from: "2026-04-16",
      to: "2026-05-15",
    });
    expect(toDashboardTimeframeSearchParams(timeframe)).toEqual({
      timeframe: "30d",
    });
  });

  it("treats frei as a custom from/to range", () => {
    const timeframe = parseDashboardTimeframe(
      new URLSearchParams({
        timeframe: "frei",
        from: "2026-04-01",
        to: "2026-04-12",
      }),
      referenceDate
    );

    expect(timeframe).toEqual({
      mode: "frei",
      from: "2026-04-01",
      to: "2026-04-12",
    });
    expect(toDashboardTimeframeSearchParams(timeframe)).toEqual({
      timeframe: "frei",
      from: "2026-04-01",
      to: "2026-04-12",
    });
  });

  it("normalizes invalid custom ranges to a safe default window", () => {
    expect(
      parseDashboardTimeframe(
        new URLSearchParams({
          timeframe: "frei",
          from: "invalid",
        }),
        referenceDate
      )
    ).toEqual({
      mode: "frei",
      from: "2026-04-03",
      to: "2026-04-16",
    });
  });
});
