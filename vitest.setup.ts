import { vi } from "vitest";

vi.mock("convex-test", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex-test")>();
  return {
    ...actual,
    convexTest: (schema?: unknown) =>
      actual.convexTest(schema as never).withIdentity({
        issuer: "https://mistica-app-fawn.vercel.app",
        subject: "mistica-admin",
      }),
  };
});
