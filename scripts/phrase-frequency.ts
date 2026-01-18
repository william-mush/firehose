/**
 * Analyze phrase (bigram/trigram) frequency across all entries.
 */

import { db, entries } from "../lib/db";

interface PhraseCount {
  phrase: string;
  count: number;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
  "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "it", "its",
  "this", "that", "these", "those", "i", "you", "he", "she", "we", "they",
  "what", "which", "who", "all", "each", "every", "both", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "also", "now", "here",
  "there", "then", "if", "because", "about", "into", "through", "during",
  "before", "after", "above", "below", "between", "under", "again", "out",
  "off", "over", "up", "down", "any", "my", "your", "his", "her", "our",
  "their", "me", "him", "us", "them", "am", "being"
]);

async function analyzePhraseFrequency(ngramSize: number = 2): Promise<PhraseCount[]> {
  console.log("Fetching all entries from database...");

  const allEntries = await db
    .select({ textContent: entries.textContent })
    .from(entries);

  console.log(`Analyzing ${allEntries.length} entries for ${ngramSize}-grams...`);

  const phraseCounts = new Map<string, number>();

  for (const entry of allEntries) {
    if (!entry.textContent) continue;

    const text = entry.textContent
      .toLowerCase()
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/@[\w]+/g, "")
      .replace(/[^a-z\s'-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const words = text.split(" ").filter(w => w.length > 1);

    // Extract n-grams
    for (let i = 0; i <= words.length - ngramSize; i++) {
      const ngram = words.slice(i, i + ngramSize);

      // Skip if all words are stop words
      if (ngram.every(w => STOP_WORDS.has(w))) continue;

      // Skip if first or last word is a stop word (for cleaner phrases)
      if (STOP_WORDS.has(ngram[0]) || STOP_WORDS.has(ngram[ngram.length - 1])) continue;

      const phrase = ngram.join(" ");
      phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
    }
  }

  // Filter to phrases that appear at least 5 times
  const filtered = Array.from(phraseCounts.entries())
    .filter(([_, count]) => count >= 5)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count);

  return filtered;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "500");
  const ngramSize = parseInt(args.find(a => a.startsWith("--ngram="))?.split("=")[1] || "2");

  try {
    const results = await analyzePhraseFrequency(ngramSize);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`PHRASE FREQUENCY ANALYSIS (${ngramSize}-grams)`);
    console.log(`Total unique phrases: ${results.length.toLocaleString()}`);
    console.log(`Showing top ${Math.min(limit, results.length)} phrases`);
    console.log(`${"=".repeat(60)}\n`);

    console.log("Rank\tCount\t\tPhrase");
    console.log("-".repeat(60));

    const topPhrases = results.slice(0, limit);
    for (let i = 0; i < topPhrases.length; i++) {
      const { phrase, count } = topPhrases[i];
      const rank = (i + 1).toString().padStart(4);
      const countStr = count.toLocaleString().padStart(6);
      console.log(`${rank}\t${countStr}\t\t${phrase}`);
    }

    const totalPhrases = results.reduce((sum, p) => sum + p.count, 0);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Total phrase occurrences: ${totalPhrases.toLocaleString()}`);
    console.log(`${"=".repeat(60)}`);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
