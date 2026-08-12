import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.ADMIN_PASSWORD = "test-admin-password";
  process.env.SESSION_SECRET = "test-session-secret-that-is-not-the-password";
});
vi.mock("server-only", () => ({}));

let auth: typeof import("./auth");

beforeAll(async () => {
  auth = await import("./auth");
});

describe("admin session", () => {
  it("accepts signed sessions without storing the password", () => {
    const token = auth.createSessionToken();
    const request = new Request("https://mistica.example", {
      headers: { cookie: `${auth.SESSION_COOKIE}=${token}` },
    });

    expect(token).not.toContain("test-admin-password");
    expect(auth.verifyAuth(request)).toBe(true);
  });

  it("keeps legacy cookies valid during the migration", () => {
    const request = new Request("https://mistica.example", {
      headers: { cookie: `${auth.SESSION_COOKIE}=test-admin-password` },
    });

    expect(auth.verifyAuth(request)).toBe(true);
    expect(auth.isLegacySession(request)).toBe(true);
  });
});
