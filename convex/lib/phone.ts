/**
 * Single source of truth for phone handling. Bolivia only (mobiles are 8 digits
 * starting with 6 or 7; landlines start with 2/3/4 and cannot receive WhatsApp).
 *
 * Mirrors src/lib/server/waha.ts so a number normalized here always matches the
 * chatId WAHA delivers on the webhook — otherwise every inbound message would
 * open a duplicate conversation.
 */

export function normalizePhone(phone: string): string | null {
  let cleaned = (phone ?? "").replace(/\D/g, "");

  if (cleaned.startsWith("00591")) {
    cleaned = cleaned.slice(2);
  }

  // 8 digits starting with 6 or 7 -> mobile without country code
  if (cleaned.length === 8 && (cleaned.startsWith("6") || cleaned.startsWith("7"))) {
    return "591" + cleaned;
  }

  // 11 digits starting with 5916 or 5917 -> mobile with country code
  if (cleaned.length === 11 && (cleaned.startsWith("5916") || cleaned.startsWith("5917"))) {
    return cleaned;
  }

  return null;
}

/** "59171234567" -> "59171234567@c.us" (WAHA's chat identifier). */
export function toChatId(normalizedPhone: string): string {
  return `${normalizedPhone}@c.us`;
}

/** "59171234567@c.us" -> "59171234567". Returns null for groups/status/channels. */
export function fromChatId(chatId: string): string | null {
  const [user, domain] = chatId.split("@");
  if (domain !== "c.us" && domain !== "s.whatsapp.net") return null;
  return /^\d+$/.test(user) ? user : null;
}

/** 59171234567 -> 5917***4567. Use in every log line that touches a number. */
export function maskPhone(phone: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length <= 6) return "***";
  const startLen = digits.length >= 12 ? 5 : 4;
  return `${digits.substring(0, startLen)}***${digits.substring(digits.length - 4)}`;
}

/** wa.me deep link, used as the manual fallback when WAHA is down. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizePhone(phone);
  const target = normalized ?? phone.replace(/\D/g, "");
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}
