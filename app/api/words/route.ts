import { NextRequest, NextResponse } from "next/server";
import { db, entries } from "@/lib/db";
import { gte, lte, and, SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Common stop words to filter out
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
  "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare", "ought",
  "used", "it", "its", "this", "that", "these", "those", "i", "you", "he",
  "she", "we", "they", "what", "which", "who", "whom", "whose", "where",
  "when", "why", "how", "all", "each", "every", "both", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "also", "now", "here",
  "there", "then", "once", "if", "because", "until", "while", "about",
  "into", "through", "during", "before", "after", "above", "below",
  "between", "under", "again", "further", "out", "off", "over", "up",
  "down", "any", "my", "your", "his", "her", "our", "their", "me", "him",
  "us", "them", "am", "being", "get", "got", "go", "going", "went", "come",
  "came", "make", "made", "take", "took", "see", "saw", "know", "knew",
  "think", "thought", "want", "let", "put", "say", "said", "like", "just",
  "even", "back", "well", "way", "much", "many", "still", "since", "long",
  "right", "man", "men", "thing", "things", "something", "nothing", "anything",
  "everything", "someone", "anyone", "everyone", "one", "two", "three",
  "first", "new", "old", "high", "little", "big", "great", "good", "bad",
  "last", "next", "sure", "really", "always", "never", "ever", "yet",
  "already", "though", "although", "however", "therefore", "thus", "hence",
  "else", "whether", "either", "neither", "per", "via", "etc", "vs", "re",
  "been", "being", "having", "doing", "getting", "going", "coming", "making",
  "taking", "seeing", "knowing", "thinking", "wanting", "saying", "looking",
  "using", "trying", "asking", "telling", "working", "calling", "playing",
  "running", "living", "moving", "standing", "sitting", "happening"
]);

interface WordCount {
  word: string;
  count: number;
}

function tokenize(text: string, includeStopWords: boolean): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/@[\w]+/g, "")
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/\s+/g, " ");

  return cleaned.split(" ").filter(w => {
    if (w.length < 2) return false;
    if (!includeStopWords && STOP_WORDS.has(w)) return false;
    return true;
  });
}

function extractBigrams(text: string, includeStopWords: boolean): string[] {
  const words = tokenize(text, true); // Keep stop words for context in bigrams
  const bigrams: string[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    // Filter bigrams where both words are stop words
    if (!includeStopWords && STOP_WORDS.has(words[i]) && STOP_WORDS.has(words[i + 1])) {
      continue;
    }
    bigrams.push(bigram);
  }

  return bigrams;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 10000);
    const includeStopWords = searchParams.get("includeStopWords") === "true";
    const mode = searchParams.get("mode") || "words"; // "words" or "phrases"
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");

    // Build query conditions
    const conditions: SQL[] = [];
    if (dateFrom) {
      conditions.push(gte(entries.timestamp, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(entries.timestamp, new Date(dateTo)));
    }

    // Fetch entries
    const allEntries = await db
      .select({ textContent: entries.textContent, timestamp: entries.timestamp })
      .from(entries)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const counts = new Map<string, number>();

    for (const entry of allEntries) {
      if (!entry.textContent) continue;

      const tokens = mode === "phrases"
        ? extractBigrams(entry.textContent, includeStopWords)
        : tokenize(entry.textContent, includeStopWords);

      for (const token of tokens) {
        counts.set(token, (counts.get(token) || 0) + 1);
      }
    }

    // Sort by count
    const sorted: WordCount[] = Array.from(counts.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const totalOccurrences = Array.from(counts.values()).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      words: sorted,
      totalOccurrences,
      uniqueCount: counts.size,
      entriesAnalyzed: allEntries.length,
      mode,
      dateRange: {
        from: dateFrom || null,
        to: dateTo || null,
      },
    });
  } catch (error) {
    console.error("Error analyzing word frequency:", error);
    return NextResponse.json(
      { error: "Failed to analyze word frequency" },
      { status: 500 }
    );
  }
}
