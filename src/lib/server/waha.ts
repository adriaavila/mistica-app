import "server-only";

const WAHA_BASE_URL = process.env.WAHA_BASE_URL;
const WAHA_API_KEY = process.env.WAHA_API_KEY;

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
async function wahaRequest(path: string, options: RequestInit = {}): Promise<any> {
  if (!WAHA_BASE_URL) {
    throw new Error("WAHA_BASE_URL is not configured in environment variables.");
  }

  const baseUrl = WAHA_BASE_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${cleanPath}`;

  const headers = new Headers(options.headers);
  if (WAHA_API_KEY) {
    headers.set("X-Api-Key", WAHA_API_KEY);
  }

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
          errMsg = `WAHA Error: ${body.message}`;
        }
      } catch {
        // Fallback to default message if JSON parsing fails
      }
      throw new Error(errMsg);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`WAHA API request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

export interface WahaStatus {
  online: boolean;
  sessions: { name: string; status: string }[];
}

/**
 * Fetches the current online status of all sessions from WAHA.
 */
export async function getWahaStatus(): Promise<WahaStatus> {
  try {
    const sessions = await wahaRequest("/api/sessions");
    return {
      online: true,
      sessions: Array.isArray(sessions)
        ? sessions.map((s: any) => ({ name: s.name, status: s.status }))
        : [],
    };
  } catch (err: any) {
    // Log masked message in production logs
    console.error(`WAHA Status Check failed: ${err.message}`);
    return {
      online: false,
      sessions: [],
    };
  }
}

export async function startWahaSession(sessionName = "default"): Promise<any> {
  try {
    const startExistingSession = () => wahaRequest(`/api/sessions/${sessionName}/start`, {
      method: "POST",
    });

    const status = await getWahaStatus();
    const exists = status.sessions.some((s) => s.name === sessionName);

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
        body: JSON.stringify({ name: sessionName }),
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
    throw new Error(`Failed to start WAHA session "${sessionName}": ${errorMsg}`);
  }
}

/**
 * Retrieves the base64-encoded QR code for session authentication.
 * Returns null if the session is already working/connected.
 */
export async function getWahaQr(sessionName = "default"): Promise<string | null> {
  try {
    const data = await wahaRequest(`/api/${sessionName}/auth/qr`, {
      headers: {
        Accept: "application/json",
      },
    });
    return data?.qr || null;
  } catch (err: any) {
    // Return null if session is already working (API throws error like "Session is connected")
    console.log(`Failed to retrieve QR code for "${sessionName}" (possibly already connected): ${err.message}`);
    return null;
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
  sessionName = "default",
}: SendWahaTextArgs): Promise<any> {
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
        session: sessionName,
      }),
    });
  } catch (err: any) {
    throw new Error(`Failed to send WhatsApp message to ${maskedPhone}: ${err.message}`);
  }
}
