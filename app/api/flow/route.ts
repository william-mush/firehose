import { NextRequest, NextResponse } from "next/server";
import { db, entries } from "@/lib/db";
import { sql, and, gte, lte, SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Harsh/inflammatory language patterns
const HARSH_PATTERNS = {
  insults: [
    "crooked", "sleepy", "crazy", "nasty", "stupid", "dumb", "idiot", "moron",
    "loser", "pathetic", "weak", "low iq", "lowlife", "slob", "pig", "dog",
    "rat", "snake", "traitor", "criminal", "crook", "corrupt", "disgrace",
    "disgusting", "horrible", "terrible", "worst", "fake", "phony", "fraud",
    "liar", "lying", "cheat", "cheater", "scum", "trash", "garbage", "joke",
    "clown", "puppet", "hack", "failed", "failing", "washed up", "low class",
    "no class", "sick", "deranged", "unhinged", "psycho", "wacko", "nutjob",
  ],
  aggressive: [
    "destroy", "attack", "fight", "war", "enemy", "enemies", "threat",
    "dangerous", "invasion", "invaders", "radical", "extreme", "violent",
    "crime", "criminal", "criminals", "killer", "killers", "murder",
    "death", "dead", "die", "dying", "hell", "damn", "hate", "hated",
  ],
  inflammatory: [
    "witch hunt", "hoax", "scam", "rigged", "stolen", "steal", "cheat",
    "weaponized", "persecution", "political prisoner", "third world",
    "banana republic", "communist", "fascist", "nazi", "gestapo",
    "deep state", "swamp", "corrupt", "corruption",
  ],
};

function containsHarshLanguage(text: string): boolean {
  const lowerText = text.toLowerCase();

  // Check for ALL CAPS words (shouting) - more than 3 consecutive caps words
  const capsPattern = /\b[A-Z]{2,}(?:\s+[A-Z]{2,}){2,}\b/;
  if (capsPattern.test(text)) return true;

  // Check for harsh patterns
  for (const category of Object.values(HARSH_PATTERNS)) {
    for (const pattern of category) {
      if (lowerText.includes(pattern)) return true;
    }
  }

  // Check for excessive exclamation marks (intensity)
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount >= 3) return true;

  return false;
}

function getHarshLanguageScore(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 0;

  // Score for ALL CAPS
  const capsWords = text.match(/\b[A-Z]{3,}\b/g) || [];
  score += capsWords.length * 2;

  // Score for harsh patterns
  for (const category of Object.values(HARSH_PATTERNS)) {
    for (const pattern of category) {
      if (lowerText.includes(pattern)) score += 3;
    }
  }

  // Score for exclamation marks
  const exclamationCount = (text.match(/!/g) || []).length;
  score += exclamationCount;

  return score;
}

// Get posts for the flow visualization
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const count = Math.min(parseInt(searchParams.get("count") || "10"), 50);
    const harshOnly = searchParams.get("harsh") === "true";

    // Date range parameters
    const fromDate = searchParams.get("from"); // YYYY-MM-DD
    const toDate = searchParams.get("to"); // YYYY-MM-DD
    const date = searchParams.get("date"); // Legacy: single date with days range
    const daysRange = parseInt(searchParams.get("days") || "3");

    // Build query conditions
    const conditions: SQL[] = [];

    // Prefer from/to parameters, fall back to date with daysRange
    if (fromDate && toDate) {
      conditions.push(gte(entries.timestamp, new Date(fromDate)));
      conditions.push(lte(entries.timestamp, new Date(toDate + "T23:59:59")));
    } else if (date) {
      const targetDate = new Date(date);
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - daysRange);
      const endDate = new Date(targetDate);
      endDate.setDate(endDate.getDate() + daysRange);

      conditions.push(gte(entries.timestamp, startDate));
      conditions.push(lte(entries.timestamp, endDate));
    }

    // Get entries (more than needed if filtering for harsh language)
    const fetchCount = harshOnly ? count * 5 : count;

    const results = await db
      .select({
        id: entries.id,
        textContent: entries.textContent,
        timestamp: entries.timestamp,
        source: entries.source,
      })
      .from(entries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(date ? entries.timestamp : sql`RANDOM()`)
      .limit(fetchCount);

    // Filter and transform
    let items = results.map((entry) => ({
      id: entry.id,
      content: entry.textContent,
      source: entry.source,
      timestamp: entry.timestamp,
      harshScore: getHarshLanguageScore(entry.textContent),
      isHarsh: containsHarshLanguage(entry.textContent),
    }));

    // Filter for harsh language if requested
    if (harshOnly) {
      items = items
        .filter((item) => item.isHarsh)
        .sort((a, b) => b.harshScore - a.harshScore)
        .slice(0, count);
    }

    return NextResponse.json({
      items,
      filters: {
        date: date || null,
        daysRange,
        harshOnly,
      },
      stats: {
        total: items.length,
        harshCount: items.filter(i => i.isHarsh).length,
      }
    });
  } catch (error) {
    console.error("Error fetching flow data:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
