import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.hoisted(() => {
  process.env.ADMIN_PASSWORD = "test-admin-password";
});
vi.mock("server-only", () => ({}));

describe("AI suggestion route", () => {
  it("rejects anonymous requests", async () => {
    const response = await POST(new Request("https://mistica.example/api/ai-suggestion", {
      method: "POST",
      body: "{}",
    }));
    expect(response.status).toBe(401);
  });

  it("rejects invalid metrics before calling the provider", async () => {
    const response = await POST(new Request("https://mistica.example/api/ai-suggestion", {
      method: "POST",
      headers: {
        authorization: "Bearer test-admin-password",
        "content-type": "application/json",
      },
      body: JSON.stringify({ activeCount: "many" }),
    }));
    expect(response.status).toBe(400);
  });
});
