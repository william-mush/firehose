import { NextRequest } from "next/server";
import { db, entries } from "@/lib/db";
import { desc, gt } from "drizzle-orm";

// Prevent static rendering during build
export const dynamic = "force-dynamic";

// Keep track of the last seen entry ID for polling
let lastSeenId: number | null = null;

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial heartbeat
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      // Get the latest entry ID to start from
      const latestEntry = await db
        .select({ id: entries.id })
        .from(entries)
        .orderBy(desc(entries.id))
        .limit(1);

      if (latestEntry.length > 0) {
        lastSeenId = latestEntry[0].id;
      }

      // Polling interval for new entries
      const pollInterval = setInterval(async () => {
        try {
          // Check for new entries
          const newEntries = await db
            .select()
            .from(entries)
            .where(lastSeenId ? gt(entries.id, lastSeenId) : undefined)
            .orderBy(desc(entries.id))
            .limit(10);

          if (newEntries.length > 0) {
            // Update last seen ID
            lastSeenId = newEntries[0].id;

            // Send each new entry as an SSE event
            for (const entry of newEntries.reverse()) {
              const data = JSON.stringify(entry);
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // Send periodic heartbeat to keep connection alive
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (error) {
          console.error("Error polling for new entries:", error);
        }
      }, 5000); // Poll every 5 seconds

      // Clean up on close
      request.signal.addEventListener("abort", () => {
        clearInterval(pollInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
