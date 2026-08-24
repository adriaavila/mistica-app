import { describe, expect, it } from "vitest";
import { formatTime } from "./utils";

describe("formatTime", () => {
  it("renders stored 24h times the way the school writes them", () => {
    expect(formatTime("06:30")).toBe("6:30 am");
    expect(formatTime("15:30")).toBe("3:30 pm");
    expect(formatTime("12:00")).toBe("12:00 pm");
    expect(formatTime("00:15")).toBe("12:15 am");
    expect(formatTime("19:00")).toBe("7:00 pm");
  });
});
