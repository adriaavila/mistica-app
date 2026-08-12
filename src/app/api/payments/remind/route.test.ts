import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as remind } from "./route";
import * as waha from "@/lib/server/waha";

const TEST_PASSWORD = "test-admin-password";

// Setup environment variables before loading modules
vi.hoisted(() => {
  process.env.ADMIN_PASSWORD = "test-admin-password";
  process.env.WAHA_BASE_URL = "http://waha-test.io";
  process.env.WAHA_API_KEY = "test-api-key";
});

// Mock server-only
vi.mock("server-only", () => ({}));

describe("Payments Remind Route Handler", () => {
  const authHeaders = { Authorization: `Bearer ${TEST_PASSWORD}` };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should block unauthorized requests with 401 status", async () => {
    const req = new Request("http://localhost/api/payments/remind", {
      method: "POST",
      body: JSON.stringify({ phone: "71234567", message: "Test message" }),
    });

    const res = await remind(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should enforce phone number presence", async () => {
    const req = new Request("http://localhost/api/payments/remind", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "Test message" }),
    });

    const res = await remind(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Phone number is required.");
  });

  it("should enforce message content presence", async () => {
    const req = new Request("http://localhost/api/payments/remind", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ phone: "71234567" }),
    });

    const res = await remind(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Message content is required.");
  });

  it("should validate phone format", async () => {
    const req = new Request("http://localhost/api/payments/remind", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ phone: "invalid-phone", message: "Test message" }),
    });

    const res = await remind(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid Bolivian phone number format");
  });

  it("should call sendWahaText on valid input", async () => {
    const sendSpy = vi.spyOn(waha, "sendWahaText").mockResolvedValue({ id: "msg-123" });

    const req = new Request("http://localhost/api/payments/remind", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ phone: "71234567", message: "Test message" }),
    });

    const res = await remind(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recipient).toBe("5917***4567");
    expect(sendSpy).toHaveBeenCalledWith({
      phone: "59171234567",
      message: "Test message",
      sessionName: "default",
    });
  });
});
