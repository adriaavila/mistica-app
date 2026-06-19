import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { convex } from "@/lib/server/convex";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";

const ALLOWED_SEGMENTS = ["natacion", "aquagym", "all"] as const;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const messageTemplate = typeof body.messageTemplate === "string"
      ? body.messageTemplate.trim()
      : "";
    const segment = body.segment as (typeof ALLOWED_SEGMENTS)[number];
    const imageStorageId = body.imageStorageId as Id<"_storage"> | undefined;
    const imageMimeType = typeof body.imageMimeType === "string" ? body.imageMimeType : undefined;
    const imageFileName = typeof body.imageFileName === "string" ? body.imageFileName.slice(0, 160) : undefined;

    if (!name || name.length > 80) {
      return NextResponse.json({ error: "El nombre debe tener entre 1 y 80 caracteres." }, { status: 400 });
    }
    if (!ALLOWED_SEGMENTS.includes(segment)) {
      return NextResponse.json({ error: "El segmento seleccionado no es válido." }, { status: 400 });
    }
    const messageLimit = imageStorageId ? 1024 : 4096;
    if (!messageTemplate || messageTemplate.length > messageLimit) {
      return NextResponse.json(
        { error: `El mensaje debe tener entre 1 y ${messageLimit} caracteres.` },
        { status: 400 }
      );
    }
    if (imageStorageId && (!imageMimeType || !ALLOWED_IMAGE_TYPES.includes(imageMimeType))) {
      return NextResponse.json({ error: "La imagen debe ser JPG, PNG o WebP." }, { status: 400 });
    }

    const campaignId = await convex.mutation(api.marketing.createMarketingCampaign, {
      name,
      segment,
      messageTemplate,
      imageStorageId,
      imageMimeType,
      imageFileName,
    });
    const result = await convex.mutation(api.marketing.prepareMarketingRecipients, { campaignId });

    return NextResponse.json({
      success: true,
      campaignId,
      preparedCount: result.preparedCount,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "No se pudo crear la campaña.";
    return NextResponse.json({ error }, { status: 500 });
  }
}
