import { describe, expect, it } from "vitest";

import { addMonths } from "./format";

describe("addMonths (invoice due date)", () => {
  it("adds one month to the invoice date", () => {
    expect(addMonths("2026-11-03", 1)).toBe("2026-12-03");
  });

  it("clamps end-of-month dates to the next month's last day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29"); // leap year
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("keeps the day of month otherwise", () => {
    expect(addMonths("2026-10-27", 1)).toBe("2026-11-27");
  });

  it("rolls across year boundaries", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
});
