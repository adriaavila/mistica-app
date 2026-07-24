import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * WAHA reports media URLs using its own container-internal host
 * (http://localhost:3000/api/files/...). Convex Cloud is external, so the host
 * has to be swapped for the public one; the path and query are what identify
 * the file and must be preserved untouched.
 */
export const fetchAndStore = internalAction({
  args: { messageId: v.id("messages"), mediaUrl: v.string() },
  handler: async (ctx, { messageId, mediaUrl }) => {
    const baseUrl = process.env.WAHA_BASE_URL?.trim().replace(/\/$/, "");
    const apiKey = process.env.WAHA_API_KEY?.trim();
    if (!baseUrl || !apiKey) {
      await ctx.runMutation(internal.crm.setMediaError, {
        messageId,
        error: "WAHA no configurado",
      });
      return;
    }

    let publicUrl: string;
    try {
      const src = new URL(mediaUrl);
      publicUrl = `${baseUrl}${src.pathname}${src.search}`;
    } catch {
      await ctx.runMutation(internal.crm.setMediaError, { messageId, error: "URL inválida" });
      return;
    }

    try {
      const res = await fetch(publicUrl, { headers: { "X-Api-Key": apiKey } });
      if (!res.ok) {
        await ctx.runMutation(internal.crm.setMediaError, {
          messageId,
          // 404 here almost always means WHATSAPP_DOWNLOAD_MEDIA is off on the WAHA service.
          error: `No se pudo descargar (${res.status})`,
        });
        return;
      }
      const blob = await res.blob();
      const storageId = await ctx.storage.store(blob);
      await ctx.runMutation(internal.crm.attachMedia, {
        messageId,
        storageId,
        mimeType: blob.type || "application/octet-stream",
      });
    } catch (err) {
      await ctx.runMutation(internal.crm.setMediaError, {
        messageId,
        error: err instanceof Error ? err.message : "Error de descarga",
      });
    }
  },
});
