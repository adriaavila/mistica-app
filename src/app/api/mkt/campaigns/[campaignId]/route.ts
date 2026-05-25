import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { convex } from "@/lib/server/convex";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { campaignId } = await params;
    
    // Validate campaign ID shape
    let typedCampaignId: Id<"marketingCampaigns">;
    try {
      typedCampaignId = campaignId as Id<"marketingCampaigns">;
    } catch {
      return NextResponse.json({ error: "Invalid campaign ID format" }, { status: 400 });
    }

    const campaign = await convex.query(api.marketing.getMarketingCampaign, {
      campaignId: typedCampaignId,
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const messages = await convex.query(api.marketing.listCampaignMessages, {
      campaignId: typedCampaignId,
    });

    return NextResponse.json({
      campaign,
      messages,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
