import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";

export async function POST(req: Request) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const fields = [
      "activeCount",
      "overdueCount",
      "expiringSoon",
      "collectedThisMonth",
      "expectedThisMonth",
      "collectionRate",
    ] as const;
    if (fields.some((field) => !Number.isFinite(body[field]) || body[field] < 0 || body[field] > 1_000_000_000)) {
      return NextResponse.json({ error: "Invalid metrics" }, { status: 400 });
    }
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://mistica.app",
        "X-Title": "Mistica App"
      },
      body: JSON.stringify({
        model: "google/gemma-2-9b-it:free",
        messages: [
          {
            role: "system",
            content: "Eres el asistente inteligente de Mistica, una academia de natación. Sugieres la acción prioritaria en español. Debe ser un texto ultra-corto (máximo 120 caracteres), accionable, proactivo y profesional, sin rodeos."
          },
          {
            role: "user",
            content: `Estado actual:
- Alumnos activos: ${body.activeCount}
- Cobros en mora: ${body.overdueCount}
- Cobros por vencer: ${body.expiringSoon}
- Cobrado: ${body.collectedThisMonth} Bs
- Esperado: ${body.expectedThisMonth} Bs
- Tasa cobranza: ${body.collectionRate}%

Escribe una sugerencia concreta de 1 oración corta.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      return NextResponse.json({ error: "Failed to fetch OpenRouter response" }, { status: response.status });
    }

    const data = await response.json();
    const suggestion = data.choices?.[0]?.message?.content?.trim();

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("AI Route error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
