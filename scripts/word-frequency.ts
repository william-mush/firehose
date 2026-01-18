/**
 * Analyze word frequency across all entries.
 */

import { db, entries } from "../lib/db";

interface WordCount {
  word: string;
  count: number;
}

// Common stop words to optionally filter out
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

async function analyzeWordFrequency(includeStopWords: boolean = false): Promise<WordCount[]> {
  console.log("Fetching all entries from database...");

  const allEntries = await db
    .select({ textContent: entries.textContent })
    .from(entries);

  console.log(`Analyzing ${allEntries.length} entries...`);

  const wordCounts = new Map<string, number>();

  for (const entry of allEntries) {
    if (!entry.textContent) continue;

    // Tokenize: lowercase, remove URLs, mentions, special chars
    const text = entry.textContent
      .toLowerCase()
      .replace(/https?:\/\/[^\s]+/g, "") // Remove URLs
      .replace(/@[\w]+/g, "") // Remove mentions
      .replace(/[^a-z\s'-]/g, " ") // Keep only letters, spaces, apostrophes, hyphens
      .replace(/\s+/g, " "); // Normalize whitespace

    const words = text.split(" ").filter(w => w.length > 1);

    for (const word of words) {
      // Skip stop words if requested
      if (!includeStopWords && STOP_WORDS.has(word)) continue;

      // Skip very short words and numbers
      if (word.length < 2) continue;

      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // Convert to array and sort by count
  const sorted = Array.from(wordCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

  return sorted;
}

async function main() {
  const args = process.argv.slice(2);
  const includeStopWords = args.includes("--include-stop-words");
  const limit = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] || "500");

  try {
    const results = await analyzeWordFrequency(includeStopWords);

    console.log(`\n${"=".repeat(50)}`);
    console.log(`WORD FREQUENCY ANALYSIS`);
    console.log(`Total unique words: ${results.length.toLocaleString()}`);
    console.log(`Showing top ${limit} words${includeStopWords ? " (including stop words)" : ""}`);
    console.log(`${"=".repeat(50)}\n`);

    console.log("Rank\tCount\t\tWord");
    console.log("-".repeat(40));

    const topWords = results.slice(0, limit);
    for (let i = 0; i < topWords.length; i++) {
      const { word, count } = topWords[i];
      const rank = (i + 1).toString().padStart(4);
      const countStr = count.toLocaleString().padStart(8);
      console.log(`${rank}\t${countStr}\t\t${word}`);
    }

    // Summary stats
    const totalWords = results.reduce((sum, w) => sum + w.count, 0);
    console.log(`\n${"=".repeat(50)}`);
    console.log(`Total word occurrences: ${totalWords.toLocaleString()}`);
    console.log(`Unique words: ${results.length.toLocaleString()}`);
    console.log(`${"=".repeat(50)}`);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
