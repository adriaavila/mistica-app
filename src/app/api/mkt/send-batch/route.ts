import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { convex } from "@/lib/server/convex";
import { api } from "@/../convex/_generated/api";
import { sendWahaText, maskPhone } from "@/lib/server/waha";
import { Id } from "@/../convex/_generated/dataModel";

// In-memory safety lock to prevent concurrent batch send triggers on the same campaign
const activeBatches = new Set<string>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Body is empty or malformed
  }

  const { campaignId, limit } = body;

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required." }, { status: 400 });
  }

  let typedCampaignId: Id<"marketingCampaigns">;
  try {
    typedCampaignId = campaignId as Id<"marketingCampaigns">;
  } catch {
    return NextResponse.json({ error: "Invalid campaignId format." }, { status: 400 });
  }

  // Safety Lock to prevent double-clicks from running batches concurrently
  if (activeBatches.has(campaignId)) {
    return NextResponse.json(
      { error: "A batch send for this campaign is already in progress." },
      { status: 409 }
    );
  }

  activeBatches.add(campaignId);

  // Enforce batch limits
  let parsedLimit = typeof limit === "number" ? limit : parseInt(limit, 10);
  if (isNaN(parsedLimit) || parsedLimit <= 0) {
    parsedLimit = 10;
  }
  const maxLimit = 25;
  const batchLimit = Math.min(maxLimit, parsedLimit);

  let attempted = 0;
  let sent = 0;
  let failed = 0;

  try {
    // 1. Fetch campaign to check status (pause guard, etc.)
    const campaign = await convex.query(api.marketing.getMarketingCampaign, {
      campaignId: typedCampaignId,
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    if (campaign.status === "paused") {
      return NextResponse.json(
        { error: "Campaign is paused and cannot send messages." },
        { status: 400 }
      );
    }

    // 2. Fetch messages for the campaign
    const messages = await convex.query(api.marketing.listCampaignMessages, {
      campaignId: typedCampaignId,
    });

    // 3. Filter for pending messages
    const pendingMessages = messages.filter((m) => m.status === "pending");
    const totalPending = pendingMessages.length;

    // 4. Take up to batchLimit messages to process
    const messagesToProcess = pendingMessages.slice(0, batchLimit);

    for (let i = 0; i < messagesToProcess.length; i++) {
      const msg = messagesToProcess[i];
      attempted++;

      try {
        // Mark message as sending in Convex
        await convex.mutation(api.marketing.markMarketingMessageSending, {
          messageId: msg._id,
        });

        // Send text message through WAHA
        await sendWahaText({
          phone: msg.normalizedPhone,
          message: msg.message,
          sessionName: "default",
        });

        // Mark message as sent in Convex
        await convex.mutation(api.marketing.markMarketingMessageSent, {
          messageId: msg._id,
        });

        sent++;
        console.log(`[BATCH] Message sent successfully to ${maskPhone(msg.normalizedPhone)} (ID: ${msg._id})`);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown sending error";
        // Mark message as failed in Convex
        await convex.mutation(api.marketing.markMarketingMessageError, {
          messageId: msg._id,
          error: errMsg,
        });

        failed++;
        console.error(`[BATCH] Message failed to send to ${maskPhone(msg.normalizedPhone)} (ID: ${msg._id}): ${errMsg}`);
      }

      // If not the last message, wait for a random delay between 25 and 60 seconds (0 seconds in tests)
      if (i < messagesToProcess.length - 1) {
        const isTest = process.env.NODE_ENV === "test";
        const delaySeconds = isTest ? 0 : Math.floor(Math.random() * (60 - 25 + 1)) + 25;
        await sleep(delaySeconds * 1000);
      }
    }

    const remaining = Math.max(0, totalPending - messagesToProcess.length);
    console.log(`[BATCH] Batch completed. Attempted: ${attempted}, Sent: ${sent}, Failed: ${failed}, Remaining: ${remaining}`);

    return NextResponse.json({
      success: true,
      summary: {
        attempted,
        sent,
        failed,
        remaining,
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  } finally {
    // Release the safety lock
    activeBatches.delete(campaignId);
  }
}

