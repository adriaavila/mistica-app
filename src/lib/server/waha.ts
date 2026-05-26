import "server-only";

export const DEFAULT_WAHA_SESSION = "default";
export const ALLOWED_WAHA_SESSIONS = ["default"] as const;

export type WahaSessionName = typeof ALLOWED_WAHA_SESSIONS[number];
export type WahaErrorCode =
  | "missing_base_url"
  | "missing_api_key"
  | "service_unreachable"
  | "invalid_api_key"
  | "session_not_started"
  | "qr_not_available"
  | "already_connected"
  | "unexpected_response"
  | "waha_error";

export class WahaClientError extends Error {
  code: WahaErrorCode;
  status?: number;
  safeMessage: string;

  constructor(code: WahaErrorCode, safeMessage: string, status?: number) {
    super(safeMessage);
    this.name = "WahaClientError";
    this.code = code;
    this.status = status;
    this.safeMessage = safeMessage;
  }
}

function getWahaConfig() {
  const baseUrl = process.env.WAHA_BASE_URL?.trim();
  const apiKey = process.env.WAHA_API_KEY?.trim();

  if (!baseUrl) {
    throw new WahaClientError(
      "missing_base_url",
      "WAHA_BASE_URL is missing. Configure the Coolify WAHA service URL on the server."
    );
  }

  if (!apiKey) {
    throw new WahaClientError(
      "missing_api_key",
      "WAHA_API_KEY is missing. Configure the WAHA API key on the server."
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    apiKey,
  };
}

export function isAllowedWahaSession(sessionName: string): sessionName is WahaSessionName {
  return ALLOWED_WAHA_SESSIONS.includes(sessionName as WahaSessionName);
}

export function resolveWahaSessionName(sessionName?: string | null): WahaSessionName {
  const requested = sessionName?.trim() || DEFAULT_WAHA_SESSION;
  if (isAllowedWahaSession(requested)) {
    return requested;
  }
  throw new WahaClientError(
    "waha_error",
    `Invalid WAHA session "${requested}". Allowed sessions: ${ALLOWED_WAHA_SESSIONS.join(", ")}.`
  );
}

export function getSafeWahaBaseUrlHost(): string | null {
  const baseUrl = process.env.WAHA_BASE_URL?.trim();
  if (!baseUrl) {
    return null;
  }
  try {
    const url = new URL(baseUrl);
    return url.host;
  } catch {
    return "invalid-url";
  }
}

export function getSafeWahaError(err: unknown): { code: WahaErrorCode; message: string; status: number } {
  if (err instanceof WahaClientError) {
    return {
      code: err.code,
      message: err.safeMessage,
      status: err.status ?? errorCodeToHttpStatus(err.code),
    };
  }

  const message = err instanceof Error ? err.message : "Unknown WAHA error.";
  return {
    code: "waha_error",
    message,
    status: 500,
  };
}

function errorCodeToHttpStatus(code: WahaErrorCode): number {
  switch (code) {
    case "missing_base_url":
    case "missing_api_key":
    case "unexpected_response":
      return 500;
    case "invalid_api_key":
      return 502;
    case "service_unreachable":
      return 503;
    case "session_not_started":
    case "qr_not_available":
    case "already_connected":
      return 409;
    default:
      return 500;
  }
}

function isSessionAlreadyStartedMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("session") && normalizedMessage.includes("already started");
}

function isAlreadyConnectedMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("session") && (
    normalizedMessage.includes("connected") ||
    normalizedMessage.includes("working") ||
    normalizedMessage.includes("already logged")
  );
}

function isSessionNotStartedMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return normalizedMessage.includes("session") && (
    normalizedMessage.includes("not started") ||
    normalizedMessage.includes("stopped") ||
    normalizedMessage.includes("not running")
  );
}

/**
 * Normalizes a phone number for Bolivia.
 * Rules:
 * - Strip all non-digits.
 * - If phone has 8 digits and starts with 6 or 7, prepend country code '591'.
 * - If phone has 11 digits and starts with 5916 or 5917, keep as is.
 * - If phone starts with 00591, remove the '00' to keep '591...'.
 * - Reject landlines (landlines usually start with 2, 3, or 4).
 * - Return null for invalid phones.
 */
export function normalizePhone(phone: string): string | null {
  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("00591")) {
    cleaned = cleaned.slice(2);
  }

  // Case 1: 8 digits starting with 6 or 7 -> mobile phone
  if (cleaned.length === 8 && (cleaned.startsWith("6") || cleaned.startsWith("7"))) {
    return "591" + cleaned;
  }

  // Case 2: 11 digits starting with 5916 or 5917 -> mobile phone with country code
  if (cleaned.length === 11 && (cleaned.startsWith("5916") || cleaned.startsWith("5917"))) {
    return cleaned;
  }

  // Reject landlines and other formats
  return null;
}

/**
 * Masks a phone number for secure logging (e.g. 59171234567 -> 5917***4567).
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 6) {
    return "***";
  }
  const startLen = digits.length >= 12 ? 5 : 4;
  const start = digits.substring(0, startLen);
  const end = digits.substring(digits.length - 4);
  return `${start}***${end}`;
}

/**
 * Base fetch requester to WAHA API with timeout and error handling.
 */
async function wahaRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const { baseUrl, apiKey } = getWahaConfig();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${cleanPath}`;

  const headers = new Headers(options.headers);
  headers.set("X-Api-Key", apiKey);

  const controller = new AbortController();
  const timeoutMs = 15000; // 15 seconds timeout
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errMsg = `WAHA API returned status ${response.status}`;
      try {
        const body = await response.json();
        if (body && body.message) {
          errMsg = String(body.message);
        }
      } catch {
        // Fallback to default message if JSON parsing fails
      }
      if (response.status === 401 || response.status === 403) {
        throw new WahaClientError(
          "invalid_api_key",
          "WAHA rejected the API key. Check WAHA_API_KEY in the app and WHATSAPP_API_KEY in Coolify.",
          response.status
        );
      }
      throw new WahaClientError("waha_error", `WAHA Error: ${errMsg}`, response.status);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return response;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new WahaClientError(
        "service_unreachable",
        `WAHA service did not respond within ${timeoutMs}ms. Check the Coolify service and networking.`
      );
    }
    if (err instanceof WahaClientError) {
      throw err;
    }
    if (err instanceof TypeError) {
      throw new WahaClientError(
        "service_unreachable",
        "WAHA service is unreachable. Check WAHA_BASE_URL, Coolify deployment status, and network access."
      );
    }
    throw err;
  }
}

export interface WahaStatus {
  online: boolean;
  sessions: { name: string; status: string }[];
  sessionName?: string;
  status?: string | null;
  lastError?: string;
}

export interface WahaDebugInfo {
  configured: boolean;
  baseUrlHost: string | null;
  canReachWaha: boolean;
  sessionName: string;
  status: string | null;
  lastError: string | null;
}

export interface WahaQrResult {
  qr: string | null;
  sessionName: string;
  status: string | null;
  message: string | null;
}

/**
 * Fetches the current online status of all sessions from WAHA.
 */
export async function getWahaStatus(sessionName = DEFAULT_WAHA_SESSION): Promise<WahaStatus> {
  const resolvedSession = resolveWahaSessionName(sessionName);
  try {
    const sessions = await wahaRequest("/api/sessions");
    if (!Array.isArray(sessions)) {
      throw new WahaClientError(
        "unexpected_response",
        "WAHA returned an unexpected sessions response. Expected an array."
      );
    }
    const parsedSessions = sessions.map((session) => {
      const value = session as { name?: unknown; status?: unknown };
      return { name: String(value.name), status: String(value.status) };
    });
    const activeSession = parsedSessions.find((s) => s.name === resolvedSession);
    return {
      online: true,
      sessions: parsedSessions,
      sessionName: resolvedSession,
      status: activeSession?.status ?? "NOT_CREATED",
    };
  } catch (err: unknown) {
    // Log masked message in production logs
    const safeError = getSafeWahaError(err);
    console.error(`WAHA Status Check failed: ${safeError.message}`);
    return {
      online: false,
      sessions: [],
      sessionName: resolvedSession,
      status: null,
      lastError: safeError.message,
    };
  }
}

export async function startWahaSession(sessionName = DEFAULT_WAHA_SESSION): Promise<unknown> {
  const resolvedSession = resolveWahaSessionName(sessionName);
  try {
    const startExistingSession = () => wahaRequest(`/api/sessions/${resolvedSession}/start`, {
      method: "POST",
    });

    const status = await getWahaStatus(resolvedSession);
    if (!status.online) {
      throw new WahaClientError("service_unreachable", status.lastError || "WAHA service is not reachable.");
    }
    const exists = status.sessions.some((s) => s.name === resolvedSession);

    if (exists) {
      // Session exists, just start it
      return await startExistingSession();
    }

    try {
      // Session doesn't exist, create it
      return await wahaRequest("/api/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: resolvedSession }),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      const normalizedMessage = errorMsg.toLowerCase();
      if (normalizedMessage.includes("session") && normalizedMessage.includes("already exists")) {
        return await startExistingSession();
      }
      throw err;
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    if (isSessionAlreadyStartedMessage(errorMsg)) {
      return { name: resolvedSession, status: "STARTED" };
    }
    const safeError = getSafeWahaError(err);
    throw new WahaClientError(
      safeError.code,
      `Failed to start WAHA session "${resolvedSession}": ${safeError.message}`,
      safeError.status
    );
  }
}

/**
 * Retrieves the base64-encoded QR code for session authentication.
 * Returns null if the session is already working/connected.
 */
export async function getWahaQr(sessionName = DEFAULT_WAHA_SESSION): Promise<WahaQrResult> {
  const resolvedSession = resolveWahaSessionName(sessionName);
  const status = await getWahaStatus(resolvedSession);
  if (!status.online) {
    throw new WahaClientError("service_unreachable", status.lastError || "WAHA service is not reachable.");
  }

  const sessionStatus = status.status ?? null;
  if (sessionStatus === "WORKING") {
    return {
      qr: null,
      sessionName: resolvedSession,
      status: sessionStatus,
      message: "WhatsApp is already connected for this session.",
    };
  }
  if (sessionStatus === "NOT_CREATED" || sessionStatus === "STOPPED") {
    return {
      qr: null,
      sessionName: resolvedSession,
      status: sessionStatus,
      message: "Session is not started. Start the session before requesting a QR code.",
    };
  }

  try {
    const data = await wahaRequest(`/api/${resolvedSession}/auth/qr`, {
      headers: {
        Accept: "application/json",
      },
    });
    const qrData = data as { qr?: unknown; mimetype?: unknown; data?: unknown } | null;
    if (qrData?.qr) {
      return { qr: String(qrData.qr), sessionName: resolvedSession, status: sessionStatus, message: null };
    }
    if (qrData?.mimetype && qrData?.data) {
      return {
        qr: `data:${String(qrData.mimetype)};base64,${String(qrData.data)}`,
        sessionName: resolvedSession,
        status: sessionStatus,
        message: null,
      };
    }
    throw new WahaClientError(
      "unexpected_response",
      "WAHA returned an unexpected QR response. Expected { qr } or { mimetype, data }."
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    if (isAlreadyConnectedMessage(errorMsg)) {
      return {
        qr: null,
        sessionName: resolvedSession,
        status: "WORKING",
        message: "WhatsApp is already connected for this session.",
      };
    }
    if (isSessionNotStartedMessage(errorMsg)) {
      throw new WahaClientError(
        "session_not_started",
        "Session is not started. Start the session before requesting a QR code."
      );
    }
    if (err instanceof WahaClientError) {
      throw err;
    }
    throw new WahaClientError("qr_not_available", `QR is not available yet: ${errorMsg}`);
  }
}

export async function logoutWahaSession(sessionName = DEFAULT_WAHA_SESSION): Promise<unknown> {
  const resolvedSession = resolveWahaSessionName(sessionName);
  try {
    return await wahaRequest(`/api/sessions/${resolvedSession}/logout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    const safeError = getSafeWahaError(err);
    throw new WahaClientError(
      safeError.code,
      `Failed to logout WAHA session "${resolvedSession}": ${safeError.message}`,
      safeError.status
    );
  }
}

export async function getWahaDebugInfo(sessionName = DEFAULT_WAHA_SESSION): Promise<WahaDebugInfo> {
  const resolvedSession = resolveWahaSessionName(sessionName);
  const configured = Boolean(process.env.WAHA_BASE_URL?.trim() && process.env.WAHA_API_KEY?.trim());
  const baseUrlHost = getSafeWahaBaseUrlHost();

  try {
    const status = await getWahaStatus(resolvedSession);
    return {
      configured,
      baseUrlHost,
      canReachWaha: status.online,
      sessionName: resolvedSession,
      status: status.status ?? null,
      lastError: status.lastError ?? null,
    };
  } catch (err) {
    const safeError = getSafeWahaError(err);
    return {
      configured,
      baseUrlHost,
      canReachWaha: false,
      sessionName: resolvedSession,
      status: null,
      lastError: safeError.message,
    };
  }
}

export interface SendWahaTextArgs {
  phone: string;
  message: string;
  sessionName?: string;
}

/**
 * Sends a text message to a phone number via WAHA.
 */
export async function sendWahaText({
  phone,
  message,
  sessionName = DEFAULT_WAHA_SESSION,
}: SendWahaTextArgs): Promise<unknown> {
  const resolvedSession = resolveWahaSessionName(sessionName);
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new Error(`Invalid phone number provided for sending: ${maskPhone(phone)}`);
  }

  const chatId = `${normalized}@c.us`;
  const maskedPhone = maskPhone(normalized);

  if (process.env.MKT_DRY_RUN === "true") {
    console.log(`[DRY RUN] Bypassing WhatsApp message send to ${maskedPhone}. Message: ${message.replace(/\n/g, " ")}`);
    return { id: `dry-run-${Date.now()}`, dryRun: true };
  }

  try {
    return await wahaRequest("/api/sendText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId,
        text: message,
        session: resolvedSession,
      }),
    });
  } catch (err: unknown) {
    const safeError = getSafeWahaError(err);
    throw new Error(`Failed to send WhatsApp message to ${maskedPhone}: ${safeError.message}`);
  }
}
