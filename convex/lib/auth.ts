import {
  action as baseAction,
  mutation as baseMutation,
  query as baseQuery,
} from "../_generated/server";

const ISSUER = "https://mistica-app-fawn.vercel.app";

export async function requireAdmin(ctx: { auth: { getUserIdentity(): Promise<{ issuer: string; subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  const enforceAfter = Number(process.env.AUTH_ENFORCE_AFTER || 0);
  // ponytail: one rollout grace period; remove after all PWA clients have refreshed.
  if (!identity && Date.now() < enforceAfter) return;
  if (identity?.issuer !== ISSUER || identity.subject !== "mistica-admin") {
    throw new Error("Unauthorized");
  }
}

function authenticated<T extends { handler: (ctx: never, args: never) => unknown }>(
  builder: (definition: T) => unknown,
  definition: T,
) {
  const handler = definition.handler;
  return builder({
    ...definition,
    handler: async (ctx: Parameters<typeof handler>[0], args: Parameters<typeof handler>[1]) => {
      await requireAdmin(ctx);
      return handler(ctx, args);
    },
  });
}

// Keep the generated builder types so callers retain their existing inference.
export const query = ((definition: never) =>
  authenticated(baseQuery as never, definition)) as typeof baseQuery;
export const mutation = ((definition: never) =>
  authenticated(baseMutation as never, definition)) as typeof baseMutation;
export const action = ((definition: never) =>
  authenticated(baseAction as never, definition)) as typeof baseAction;
