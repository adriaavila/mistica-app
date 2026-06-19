import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { convex } from "@/lib/server/convex";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { getSafeWahaError, normalizePhone, resolveWahaSessionName, sendWahaImage, sendWahaText, maskPhone } from "@/lib/server/waha";

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { phone, program, studentName, recipientName, campaignId } = body;
    const sessionName = resolveWahaSessionName(body.sessionName);

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    if (!campaignId && (!program || !["natacion", "aquagym"].includes(program))) {
      return NextResponse.json(
        { error: "Invalid program. Must be 'natacion' or 'aquagym'." },
        { status: 400 }
      );
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return NextResponse.json(
        { error: `Invalid Bolivian phone number format: ${maskPhone(phone)}` },
        { status: 400 }
      );
    }

    if (campaignId) {
      const typedCampaignId = campaignId as Id<"marketingCampaigns">;
      const [campaign, messages] = await Promise.all([
        convex.query(api.marketing.getMarketingCampaign, { campaignId: typedCampaignId }),
        convex.query(api.marketing.listCampaignMessages, { campaignId: typedCampaignId }),
      ]);
      if (!campaign) {
        return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
      }
      const sampleMessage = messages[0];
      if (!sampleMessage) {
        return NextResponse.json({ error: "Campaign has no prepared recipients." }, { status: 400 });
      }

      if (campaign.imageStorageId) {
        if (!campaign.imageUrl || !campaign.imageMimeType) {
          return NextResponse.json({ error: "Campaign image is unavailable." }, { status: 400 });
        }
        await sendWahaImage({
          phone: normalized,
          message: sampleMessage.message,
          imageUrl: campaign.imageUrl,
          mimetype: campaign.imageMimeType,
          filename: campaign.imageFileName,
          sessionName,
        });
      } else {
        await sendWahaText({ phone: normalized, message: sampleMessage.message, sessionName });
      }

      return NextResponse.json({
        success: true,
        message: sampleMessage.message,
        recipient: maskPhone(normalized),
      });
    }

    // Legacy Mother's Day test message
    let message = "";
    if (program === "natacion") {
      const sName = studentName || "un alumno";
      message = `Hola 💙\n\nDe parte de Mística Natación & Aquagym queremos enviar un saludo especial por el Día de la Madre.\n\nGracias por acompañar el proceso de ${sName} con tanto amor, constancia y confianza. Para nosotros es muy especial ver cómo cada alumno crece, aprende y gana seguridad en el agua 🌊\n\nCon cariño,\nEquipo Mística`;
    } else {
      const rName = recipientName || "Cliente";
      message = `Hola ${rName} 💙\n\nEn Mística Natación & Aquagym queremos enviarte un saludo especial por el Día de la Madre.\n\nGracias por ser parte de nuestra comunidad y por compartir con nosotras momentos de salud, movimiento, bienestar y alegría en el agua 🌊\n\nCon cariño,\nEquipo Mística`;
    }

    // Send the WhatsApp
    await sendWahaText({
      phone: normalized,
      message,
      sessionName,
    });

    return NextResponse.json({
      success: true,
      message,
      recipient: maskPhone(normalized),
    });
  } catch (err) {
    const safeError = getSafeWahaError(err);
    return NextResponse.json({ error: safeError.message, code: safeError.code }, { status: safeError.status });
  }
}
