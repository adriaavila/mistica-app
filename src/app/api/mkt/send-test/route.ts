import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { normalizePhone, sendWahaText, maskPhone } from "@/lib/server/waha";

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { phone, program, studentName, recipientName } = body;

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    if (!program || !["natacion", "aquagym"].includes(program)) {
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

    // Build the test message
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
      sessionName: "default",
    });

    return NextResponse.json({
      success: true,
      message,
      recipient: maskPhone(normalized),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
