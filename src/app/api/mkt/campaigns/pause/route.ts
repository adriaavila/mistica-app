import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { convex } from "@/lib/server/convex";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { campaignId, paused } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }

    const campaign = await convex.query(api.marketing.getMarketingCampaign, {
      campaignId: campaignId as Id<"marketingCampaigns">,
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const status = paused ? "paused" : "ready";
    await convex.mutation(api.marketing.setMarketingCampaignStatus, {
      campaignId: campaignId as Id<"marketingCampaigns">,
      status,
    });

    return NextResponse.json({ success: true, status });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
