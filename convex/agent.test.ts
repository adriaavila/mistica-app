import { describe, expect, it } from "vitest";
import { decideAgentReply } from "./agent";

describe("supervised WhatsApp agent", () => {
  it("uses stored prices and hands uncertain questions to a human", () => {
    expect(decideAgentReply("cuanto cuesta", [{ name: "Natación", price: 300 }], []).reply)
      .toContain("Bs 300");
    expect(decideAgentReply("puedes hacerme descuento", [], []).handoff).toBe(true);
    expect(decideAgentReply("no me escriban", [], []).pause).toBe(true);
  });
});
