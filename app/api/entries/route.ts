import { NextRequest, NextResponse } from "next/server";
import { db, entries } from "@/lib/db";
import { desc, eq, gte, lte, and, ilike, inArray, SQL } from "drizzle-orm";

// Prevent static rendering during build
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
    const offset = parseInt(searchParams.get("offset") || "0");
    const sources = searchParams.get("sources")?.split(",").filter(Boolean);
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");
    const search = searchParams.get("search");
    const entryType = searchParams.get("type");

    // Build where conditions
    const conditions: SQL[] = [];

    if (sources && sources.length > 0) {
      conditions.push(inArray(entries.source, sources));
    }

    if (dateFrom) {
      conditions.push(gte(entries.timestamp, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(entries.timestamp, new Date(dateTo)));
    }

    if (search) {
      conditions.push(ilike(entries.textContent, `%${search}%`));
    }

    if (entryType) {
      conditions.push(eq(entries.entryType, entryType));
    }

    // Execute query
    const results = await db
      .select()
      .from(entries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(entries.timestamp))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const countResult = await db
      .select({ count: entries.id })
      .from(entries)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({
      entries: results,
      total: countResult.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch entries" },
      { status: 500 }
    );
  }
}

// POST endpoint for creating new entries (used by scrapers)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.timestamp || !body.source || !body.textContent) {
      return NextResponse.json(
        { error: "Missing required fields: timestamp, source, textContent" },
        { status: 400 }
      );
    }

    // Calculate word and character counts
    const textContent = body.textContent;
    const wordCount = textContent.split(/\s+/).filter(Boolean).length;
    const characterCount = textContent.length;

    // Insert entry
    const result = await db
      .insert(entries)
      .values({
        externalId: body.externalId,
        timestamp: new Date(body.timestamp),
        source: body.source,
        sourceUrl: body.sourceUrl,
        entryType: body.entryType,
        venue: body.venue,
        title: body.title,
        textContent: textContent,
        characterCount,
        wordCount,
        metadata: body.metadata,
      })
      .onConflictDoNothing({ target: entries.externalId })
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { message: "Entry already exists", duplicate: true },
        { status: 200 }
      );
    }

    return NextResponse.json({ entry: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating entry:", error);
    return NextResponse.json(
      { error: "Failed to create entry" },
      { status: 500 }
    );
  }
}
