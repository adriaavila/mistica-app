import { vi } from "vitest";

// Mock server-only to prevent it from throwing during testing
vi.mock("server-only", () => ({}));

import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizePhone,
  maskPhone,
  getWahaStatus,
  startWahaSession,
  getWahaQr,
  sendWahaText,
  logoutWahaSession,
  getWahaDebugInfo,
} from "./waha";

vi.hoisted(() => {
  process.env.WAHA_BASE_URL = "http://waha-test.io";
  process.env.WAHA_API_KEY = "test-api-key";
});

describe("WAHA phone normalization and masking", () => {
  it("should normalize Bolivian mobile phones correctly", () => {
    expect(normalizePhone("71234567")).toBe("59171234567");
    expect(normalizePhone("61234567")).toBe("59161234567");
    expect(normalizePhone("+591 71234567")).toBe("59171234567");
    expect(normalizePhone("0059171234567")).toBe("59171234567");
    expect(normalizePhone("59171234567")).toBe("59171234567");
    expect(normalizePhone("41234567")).toBe(null);
    expect(normalizePhone("123")).toBe(null);
  });

  it("should mask phone numbers correctly", () => {
    expect(maskPhone("59171234567")).toBe("5917***4567");
    expect(maskPhone("123")).toBe("***");
  });
});

describe("WAHA API endpoints requests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getWahaStatus should parse online sessions", async () => {
    const mockSessions = [
      { name: "default", status: "WORKING" }
    ];

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockSessions,
    } as any);

    const status = await getWahaStatus();
    expect(status.online).toBe(true);
    expect(status.sessions).toEqual([{ name: "default", status: "WORKING" }]);
    expect(status.status).toBe("WORKING");
    expect(fetchSpy).toHaveBeenCalledWith("http://waha-test.io/api/sessions", expect.any(Object));

    const requestHeaders = fetchSpy.mock.calls[0][1]?.headers as Headers;
    expect(requestHeaders.get("X-Api-Key")).toBe("test-api-key");
  });

  it("getWahaStatus should handle errors gracefully", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network Error"));
    const status = await getWahaStatus();
    expect(status.online).toBe(false);
    expect(status.sessions).toEqual([]);
  });

  it("startWahaSession should call POST sessions", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => [],
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ name: "default", status: "STARTING" }),
      } as any);

    await startWahaSession("default");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://waha-test.io/api/sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "default" }),
      })
    );
  });

  it("startWahaSession should start an existing session", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => [{ name: "default", status: "STOPPED" }],
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ name: "default", status: "STARTING" }),
      } as any);

    await startWahaSession("default");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://waha-test.io/api/sessions/default/start",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("startWahaSession should start the session when create reports it already exists", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => [],
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ message: "Session 'default' already exists. Use PUT to update it." }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ name: "default", status: "STARTING" }),
      } as any);

    await startWahaSession("default");
    expect(fetchSpy).toHaveBeenLastCalledWith(
      "http://waha-test.io/api/sessions/default/start",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("startWahaSession should succeed when the existing session is already started", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => [{ name: "default", status: "STOPPED" }],
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ message: "Session 'default' is already started." }),
      } as any);

    await expect(startWahaSession("default")).resolves.toEqual({
      name: "default",
      status: "STARTED",
    });
    expect(fetchSpy).toHaveBeenLastCalledWith(
      "http://waha-test.io/api/sessions/default/start",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("getWahaQr should fetch base64 QR", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => [{ name: "default", status: "SCAN_QR_CODE" }],
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ qr: "data:image/png;base64,123" }),
      } as any);

    const qr = await getWahaQr("default");
    expect(qr.qr).toBe("data:image/png;base64,123");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://waha-test.io/api/default/auth/qr",
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
  });

  it("getWahaQr should format WAHA image data responses as a data URL", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => [{ name: "default", status: "SCAN_QR_CODE" }],
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ mimetype: "image/png", data: "abc123" }),
      } as any);

    const qr = await getWahaQr("default");
    expect(qr.qr).toBe("data:image/png;base64,abc123");
  });

  it("getWahaQr should explain when WhatsApp is already connected", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [{ name: "default", status: "WORKING" }],
    } as any);

    const qr = await getWahaQr("default");
    expect(qr.qr).toBe(null);
    expect(qr.message).toContain("already connected");
  });

  it("logoutWahaSession should call the WAHA logout endpoint", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ status: "STOPPED" }),
    } as any);

    await logoutWahaSession("default");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://waha-test.io/api/sessions/default/logout",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getWahaDebugInfo should return safe host diagnostics without the API key", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [{ name: "default", status: "SCAN_QR_CODE" }],
    } as any);

    const debug = await getWahaDebugInfo("default");
    expect(debug).toEqual({
      configured: true,
      baseUrlHost: "waha-test.io",
      canReachWaha: true,
      sessionName: "default",
      status: "SCAN_QR_CODE",
      lastError: null,
    });
    expect(JSON.stringify(debug)).not.toContain("test-api-key");
  });

  it("sendWahaText should call sendText endpoint with normalized phone", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: "msg-123" }),
    } as any);

    await sendWahaText({ phone: "71234567", message: "Hola", sessionName: "default" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://waha-test.io/api/sendText",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          chatId: "59171234567@c.us",
          text: "Hola",
          session: "default",
        }),
      })
    );
  });

  it("sendWahaText should reject invalid phones", async () => {
    await expect(
      sendWahaText({ phone: "41234567", message: "Hola" })
    ).rejects.toThrow("Invalid phone number provided for sending: 4123***4567");
  });
});
