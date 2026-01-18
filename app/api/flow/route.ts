import { NextRequest, NextResponse } from "next/server";
import { db, entries } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Get random posts for the flow visualization
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const count = Math.min(parseInt(searchParams.get("count") || "10"), 50);

    // Get random entries
    const results = await db
      .select({
        id: entries.id,
        textContent: entries.textContent,
        timestamp: entries.timestamp,
        source: entries.source,
      })
      .from(entries)
      .orderBy(sql`RANDOM()`)
      .limit(count);

    // Transform to flow-friendly format
    const items = results.map((entry) => ({
      id: entry.id,
      content: entry.textContent,
      source: entry.source,
      timestamp: entry.timestamp,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching flow data:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
