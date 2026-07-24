import { describe, expect, test } from "vitest";
import { normalizePhone, toChatId, fromChatId, maskPhone, buildWhatsAppUrl } from "./phone";

describe("normalizePhone", () => {
  test("adds 591 to 8-digit mobiles", () => {
    expect(normalizePhone("71234567")).toBe("59171234567");
    expect(normalizePhone("60212345")).toBe("59160212345");
  });

  test("keeps numbers that already carry the country code", () => {
    expect(normalizePhone("59171234567")).toBe("59171234567");
    expect(normalizePhone("+591 7123 4567")).toBe("59171234567");
    expect(normalizePhone("0059171234567")).toBe("59171234567");
  });

  test("rejects landlines and junk", () => {
    expect(normalizePhone("4441234")).toBeNull();   // Cochabamba landline
    expect(normalizePhone("22345678")).toBeNull();  // starts with 2
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });

  // The old copies in cobros/alumnos turned a leading 0 into +58 (Venezuela).
  // Every real number in this school is Bolivian; that branch must not come back.
  test("never produces a Venezuelan prefix", () => {
    expect(normalizePhone("071234567")).toBeNull();   // was "58" + "71234567"
    expect(normalizePhone("4121234567")).toBeNull();  // was "584121234567"
  });
});

describe("chatId round trip", () => {
  test("converts both ways", () => {
    expect(toChatId("59171234567")).toBe("59171234567@c.us");
    expect(fromChatId("59171234567@c.us")).toBe("59171234567");
    expect(fromChatId("59171234567@s.whatsapp.net")).toBe("59171234567");
  });

  test("rejects groups, status and channels", () => {
    expect(fromChatId("120363043211234567@g.us")).toBeNull();
    expect(fromChatId("status@broadcast")).toBeNull();
    expect(fromChatId("1234@newsletter")).toBeNull();
  });
});

describe("maskPhone", () => {
  test("hides the middle", () => {
    expect(maskPhone("59171234567")).toBe("5917***4567");
    expect(maskPhone("12345")).toBe("***");
  });
});

describe("buildWhatsAppUrl", () => {
  test("normalizes before building the link", () => {
    expect(buildWhatsAppUrl("71234567", "Hola")).toBe("https://wa.me/59171234567?text=Hola");
  });

  test("falls back to raw digits when the number is unusable", () => {
    expect(buildWhatsAppUrl("4441234", "Hola")).toBe("https://wa.me/4441234?text=Hola");
  });
});
