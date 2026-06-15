import { describe, expect, it } from "vitest";

import { formatPriceLookup } from "../src/pricebook.js";

describe("pricebook telegram lookup", () => {
  it("formats sourced dated regional observations", () => {
    const text = formatPriceLookup("3/4 EMT", [
      {
        id: 1,
        canonical_name: "3/4 EMT conduit",
        score: 1,
        observations: [
          { price: 1.42, currency: "CAD", unit: "ft", region: "Halifax", source_name: "NexCore Quote", date_captured: "2026-06-08", age_days: 0, is_stale: false },
          { price: 0.72, currency: "USD", unit: "ft", region: "Florida", source_name: "Distributor", date_captured: "2026-06-08", age_days: 0, is_stale: false },
        ],
      },
    ]);
    expect(text).toContain("3/4 EMT conduit");
    expect(text).toContain("Halifax: 1.42 CAD/ft");
    expect(text).toContain("Florida: 0.72 USD/ft");
    expect(text).toContain("NexCore Quote");
    expect(text).toContain("2026-06-08");
  });
});
