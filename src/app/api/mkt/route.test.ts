import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getStatus } from "./whatsapp/status/route";
import { POST as startSession } from "./whatsapp/start/route";
import { GET as getQr } from "./whatsapp/qr/route";
import { GET as getDebug } from "./whatsapp/debug/route";
import { POST as logoutSession } from "./whatsapp/logout/route";
import { POST as createCampaign } from "./campaigns/mothers-day/route";
import { POST as createCustomCampaign } from "./campaigns/route";
import { GET as getCampaignDetails } from "./campaigns/[campaignId]/route";
import { POST as sendTest } from "./send-test/route";
import { POST as sendBatch } from "./send-batch/route";
import { POST as pauseCampaign } from "./campaigns/pause/route";
import { convex } from "@/lib/server/convex";
import * as waha from "@/lib/server/waha";

// Setup environment variables before loading modules
vi.hoisted(() => {
  process.env.WAHA_BASE_URL = "http://waha-test.io";
  process.env.WAHA_API_KEY = "test-api-key";
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://convex-test.cloud";
});

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock Convex client
vi.mock("@/lib/server/convex", () => ({
  convex: {
    query: vi.fn(),
    mutation: vi.fn(),
  },
}));

describe("Marketing Route Handlers - Security & Auth", () => {
  it("should block unauthorized requests with 401 status", async () => {
    const req = new Request("http://localhost/api/mkt/whatsapp/status", {
      method: "GET",
    });

    const res = await getStatus(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should allow requests with correct authorization header", async () => {
    const req = new Request("http://localhost/api/mkt/whatsapp/status", {
      method: "GET",
      headers: {
        Authorization: "Bearer Mistica-Admin246",
      },
    });

    vi.spyOn(waha, "getWahaStatus").mockResolvedValue({
      online: true,
      sessions: [{ name: "default", status: "WORKING" }],
      sessionName: "default",
      status: "WORKING",
    });

    const res = await getStatus(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.online).toBe(true);
  });
});

describe("Marketing Route Handlers - WhatsApp Management", () => {
  const authHeaders = { Authorization: "Bearer Mistica-Admin246" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("POST whatsapp/start should trigger waha start and return status", async () => {
    const startSpy = vi.spyOn(waha, "startWahaSession").mockResolvedValue({ status: "STARTING" });
    const statusSpy = vi.spyOn(waha, "getWahaStatus").mockResolvedValue({
      online: true,
      sessions: [{ name: "default", status: "STARTING" }],
      sessionName: "default",
      status: "STARTING",
    });

    const req = new Request("http://localhost/api/mkt/whatsapp/start", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ sessionName: "default" }),
    });

    const res = await startSession(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions[0].status).toBe("STARTING");
    expect(startSpy).toHaveBeenCalledWith("default");
  });

  it("GET whatsapp/qr should return QR code string", async () => {
    const qrSpy = vi.spyOn(waha, "getWahaQr").mockResolvedValue({
      qr: "data:image/png;base64,123",
      sessionName: "default",
      status: "SCAN_QR_CODE",
      message: null,
    });

    const req = new Request("http://localhost/api/mkt/whatsapp/qr?sessionName=default", {
      method: "GET",
      headers: authHeaders,
    });

    const res = await getQr(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.qr).toBe("data:image/png;base64,123");
    expect(qrSpy).toHaveBeenCalledWith("default");
  });

  it("GET whatsapp/debug should return safe diagnostics", async () => {
    const debugSpy = vi.spyOn(waha, "getWahaDebugInfo").mockResolvedValue({
      configured: true,
      baseUrlHost: "waha.example.com",
      canReachWaha: true,
      sessionName: "default",
      status: "WORKING",
      lastError: null,
    });

    const req = new Request("http://localhost/api/mkt/whatsapp/debug", {
      method: "GET",
      headers: authHeaders,
    });

    const res = await getDebug(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.baseUrlHost).toBe("waha.example.com");
    expect(JSON.stringify(body)).not.toContain("test-api-key");
    expect(debugSpy).toHaveBeenCalledWith("default");
  });

  it("POST whatsapp/logout should logout and return status", async () => {
    const logoutSpy = vi.spyOn(waha, "logoutWahaSession").mockResolvedValue({ status: "STOPPED" });
    vi.spyOn(waha, "getWahaStatus").mockResolvedValue({
      online: true,
      sessions: [{ name: "default", status: "STOPPED" }],
      sessionName: "default",
      status: "STOPPED",
    });

    const req = new Request("http://localhost/api/mkt/whatsapp/logout", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ sessionName: "default" }),
    });

    const res = await logoutSession(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("STOPPED");
    expect(logoutSpy).toHaveBeenCalledWith("default");
  });
});

describe("Marketing Route Handlers - Campaign CRUD", () => {
  const authHeaders = { Authorization: "Bearer Mistica-Admin246" };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("POST campaigns/mothers-day should create and prepare campaign", async () => {
    const mutationSpy = vi.spyOn(convex, "mutation")
      .mockResolvedValueOnce("campaign-123" as any) // createMothersDayCampaign
      .mockResolvedValueOnce({ preparedCount: 15 } as any); // prepareMothersDayRecipients

    const req = new Request("http://localhost/api/mkt/campaigns/mothers-day", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ segment: "natacion", name: "Día de la Madre Natación" }),
    });

    const res = await createCampaign(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.campaignId).toBe("campaign-123");
    expect(body.preparedCount).toBe(15);
  });

  it("GET campaigns/[campaignId] should retrieve campaign details and messages", async () => {
    const querySpy = vi.spyOn(convex, "query")
      .mockResolvedValueOnce({ _id: "campaign-123", name: "Día de la Madre" } as any) // getMarketingCampaign
      .mockResolvedValueOnce([{ _id: "msg-1", message: "Hola" }] as any); // listCampaignMessages

    const req = new Request("http://localhost/api/mkt/campaigns/campaign-123", {
      method: "GET",
      headers: authHeaders,
    });

    const res = await getCampaignDetails(req, {
      params: Promise.resolve({ campaignId: "campaign-123" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.campaign.name).toBe("Día de la Madre");
    expect(body.messages.length).toBe(1);
  });

  it("POST campaigns should validate and create a custom campaign", async () => {
    const mutationSpy = vi.spyOn(convex, "mutation")
      .mockResolvedValueOnce("campaign-custom" as never)
      .mockResolvedValueOnce({ preparedCount: 8 } as never);
    const req = new Request("http://localhost/api/mkt/campaigns", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Vacaciones",
        segment: "all",
        messageTemplate: "Hola {{nombre}}",
      }),
    });

    const res = await createCustomCampaign(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      campaignId: "campaign-custom",
      preparedCount: 8,
    });
    expect(mutationSpy).toHaveBeenLastCalledWith(
      expect.any(Object),
      { campaignId: "campaign-custom" }
    );
  });

  it("POST campaigns should enforce the image caption limit", async () => {
    const req = new Request("http://localhost/api/mkt/campaigns", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Mensaje largo",
        segment: "all",
        messageTemplate: "x".repeat(1025),
        imageStorageId: "storage-1",
        imageMimeType: "image/jpeg",
      }),
    });
    const res = await createCustomCampaign(req);
    expect(res.status).toBe(400);
  });
});

describe("Marketing Route Handlers - Messaging Operations", () => {
  const authHeaders = { Authorization: "Bearer Mistica-Admin246" };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(global, "setTimeout").mockImplementation((cb: any) => {
      if (typeof cb === "function") cb();
      return 0 as any;
    });
  });

  it("POST send-test should format message and trigger sendWahaText", async () => {
    const sendSpy = vi.spyOn(waha, "sendWahaText").mockResolvedValue({ id: "msg-123" });

    const req = new Request("http://localhost/api/mkt/send-test", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        phone: "71234567",
        program: "natacion",
        studentName: "Carlitos",
        sessionName: "default",
      }),
    });

    const res = await sendTest(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("Carlitos");
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "59171234567",
        sessionName: "default",
      })
    );
  });

  it("POST send-batch should process pending messages and respect locks", async () => {
    // Mock Convex responses
    const mockMessages = [
      { _id: "msg-1", status: "pending", normalizedPhone: "59171234567", message: "Msg 1" },
      { _id: "msg-2", status: "pending", normalizedPhone: "59171234568", message: "Msg 2" },
    ];

    vi.spyOn(convex, "query").mockResolvedValue(mockMessages as any);
    const mutationSpy = vi.spyOn(convex, "mutation").mockResolvedValue({} as any);
    const sendSpy = vi.spyOn(waha, "sendWahaText").mockResolvedValue({ id: "ok" });

    const req = new Request("http://localhost/api/mkt/send-batch", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        campaignId: "campaign-123",
        limit: 5,
        sessionName: "default",
      }),
    });

    const res = await sendBatch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.summary.attempted).toBe(2);
    expect(body.summary.sent).toBe(2);
    expect(body.summary.failed).toBe(0);
    expect(body.summary.remaining).toBe(0);

    // Verify database updates
    expect(mutationSpy).toHaveBeenCalledWith(expect.any(Object), { messageId: "msg-1" });
    expect(sendSpy).toHaveBeenCalledTimes(2);

    // Verify duplicate execution lock returns 409 Conflict
    const req1 = new Request("http://localhost/api/mkt/send-batch", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        campaignId: "campaign-123",
        limit: 5,
      }),
    });

    const req2 = new Request("http://localhost/api/mkt/send-batch", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        campaignId: "campaign-123",
      }),
    });

    // Run concurrently to simulate double-click
    // Let's mock a long-running execution using microtask yielding to allow the other request to start
    vi.spyOn(convex, "query").mockImplementation(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      return mockMessages as any;
    });

    const promise1 = sendBatch(req1);
    const promise2 = sendBatch(req2);

    const [res1, res2] = await Promise.all([promise1, promise2]);
    
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);
  });

  it("POST send-batch should abort with 400 if campaign is paused", async () => {
    vi.spyOn(convex, "query").mockResolvedValueOnce({ _id: "campaign-123", status: "paused" } as any);

    const req = new Request("http://localhost/api/mkt/send-batch", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        campaignId: "campaign-123",
      }),
    });

    const res = await sendBatch(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Campaign is paused and cannot send messages.");
  });

  it("POST send-batch should use sendWahaImage for campaigns with media", async () => {
    vi.spyOn(convex, "query")
      .mockResolvedValueOnce({
        _id: "campaign-123",
        status: "ready",
        imageStorageId: "storage-1",
        imageUrl: "https://storage.example/image.jpg",
        imageMimeType: "image/jpeg",
        imageFileName: "image.jpg",
      } as never)
      .mockResolvedValueOnce([
        { _id: "msg-1", status: "pending", normalizedPhone: "59171234567", message: "Hola" },
      ] as never);
    vi.spyOn(convex, "mutation").mockResolvedValue({} as never);
    const imageSpy = vi.spyOn(waha, "sendWahaImage").mockResolvedValue({ id: "ok" });

    const req = new Request("http://localhost/api/mkt/send-batch", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ campaignId: "campaign-123", limit: 1 }),
    });
    const res = await sendBatch(req);
    expect(res.status).toBe(200);
    expect(imageSpy).toHaveBeenCalledWith(expect.objectContaining({
      message: "Hola",
      imageUrl: "https://storage.example/image.jpg",
      mimetype: "image/jpeg",
    }));
  });

  it("POST campaigns/pause should toggle campaign status", async () => {
    const querySpy = vi.spyOn(convex, "query").mockResolvedValue({ _id: "campaign-123", status: "ready" } as any);
    const mutationSpy = vi.spyOn(convex, "mutation").mockResolvedValue({} as any);

    const req = new Request("http://localhost/api/mkt/campaigns/pause", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ campaignId: "campaign-123", paused: true }),
    });

    const res = await pauseCampaign(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("paused");
    expect(mutationSpy).toHaveBeenCalledWith(expect.any(Object), {
      campaignId: "campaign-123",
      status: "paused",
    });
  });

  it("GET whatsapp/status should return simulated status in dry run mode", async () => {
    const originalDryRun = process.env.MKT_DRY_RUN;
    process.env.MKT_DRY_RUN = "true";

    const req = new Request("http://localhost/api/mkt/whatsapp/status", {
      method: "GET",
      headers: authHeaders,
    });

    const res = await getStatus(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.online).toBe(true);
    expect(body.dryRun).toBe(true);
    expect(body.sessions[0].status).toBe("WORKING");
    expect(body.sessionName).toBe("default");

    process.env.MKT_DRY_RUN = originalDryRun;
  });

  it("sendWahaText should bypass WAHA request in dry-run mode", async () => {
    const originalDryRun = process.env.MKT_DRY_RUN;
    process.env.MKT_DRY_RUN = "true";

    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await waha.sendWahaText({ phone: "71234567", message: "Hola dry run", sessionName: "default" }) as { dryRun?: boolean };
    expect(result.dryRun).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    process.env.MKT_DRY_RUN = originalDryRun;
  });
});
