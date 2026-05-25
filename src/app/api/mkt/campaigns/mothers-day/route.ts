import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { convex } from "@/lib/server/convex";
import { api } from "@/../convex/_generated/api";

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { segment, name } = body;

    if (!segment || !["natacion", "aquagym", "all"].includes(segment)) {
      return NextResponse.json(
        { error: "Invalid segment. Must be 'natacion', 'aquagym', or 'all'." },
        { status: 400 }
      );
    }

    // 1. Create the campaign
    const campaignId = await convex.mutation(api.marketing.createMothersDayCampaign, {
      segment,
      name,
    });

    // 2. Prepare recipients and messages
    const prepResult = await convex.mutation(api.marketing.prepareMothersDayRecipients, {
      campaignId,
      segment,
    });

    return NextResponse.json({
      success: true,
      campaignId,
      preparedCount: prepResult.preparedCount,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
