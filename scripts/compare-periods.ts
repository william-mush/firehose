/**
 * Compare word frequency between two time periods.
 */

import { db, entries } from "../lib/db";
import { gte, lte, and } from "drizzle-orm";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
  "be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "it", "its",
  "this", "that", "these", "those", "i", "you", "he", "she", "we", "they",
  "what", "which", "who", "all", "some", "no", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "also", "now", "here",
  "there", "then", "if", "about", "into", "out", "up", "down", "any",
  "my", "your", "his", "her", "our", "their", "me", "him", "us", "them"
]);

async function getWordCounts(from: Date, to: Date): Promise<Map<string, number>> {
  const results = await db
    .select({ textContent: entries.textContent })
    .from(entries)
    .where(and(gte(entries.timestamp, from), lte(entries.timestamp, to)));

  const counts = new Map<string, number>();

  for (const entry of results) {
    if (!entry.textContent) continue;

    const text = entry.textContent
      .toLowerCase()
      .replace(/https?:\/\/[^\s]+/g, "")
      .replace(/@[\w]+/g, "")
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ");

    const words = text.split(" ").filter(w => w.length > 2 && !STOP_WORDS.has(w));

    for (const word of words) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return counts;
}

async function main() {
  console.log("Comparing word usage: 2023 vs 2024\n");

  const counts2023 = await getWordCounts(new Date("2023-01-01"), new Date("2023-12-31"));
  const counts2024 = await getWordCounts(new Date("2024-01-01"), new Date("2024-12-31"));

  console.log(`2023: ${counts2023.size.toLocaleString()} unique words`);
  console.log(`2024: ${counts2024.size.toLocaleString()} unique words\n`);

  // Find words that increased most
  const changes: { word: string; count2023: number; count2024: number; change: number; pctChange: number }[] = [];

  const allWords = new Set([...counts2023.keys(), ...counts2024.keys()]);

  for (const word of allWords) {
    const c2023 = counts2023.get(word) || 0;
    const c2024 = counts2024.get(word) || 0;

    if (c2023 >= 10 || c2024 >= 10) { // Only words with decent frequency
      const change = c2024 - c2023;
      const pctChange = c2023 > 0 ? ((c2024 - c2023) / c2023) * 100 : (c2024 > 0 ? 1000 : 0);
      changes.push({ word, count2023: c2023, count2024: c2024, change, pctChange });
    }
  }

  // Sort by absolute change
  const increased = changes.filter(c => c.change > 0).sort((a, b) => b.change - a.change).slice(0, 30);
  const decreased = changes.filter(c => c.change < 0).sort((a, b) => a.change - b.change).slice(0, 30);

  console.log("=" .repeat(70));
  console.log("WORDS THAT INCREASED MOST (2023 → 2024)");
  console.log("=" .repeat(70));
  console.log("Word".padEnd(20) + "2023".padStart(10) + "2024".padStart(10) + "Change".padStart(10) + "%Change".padStart(12));
  console.log("-".repeat(70));

  for (const item of increased) {
    console.log(
      item.word.padEnd(20) +
      item.count2023.toLocaleString().padStart(10) +
      item.count2024.toLocaleString().padStart(10) +
      ("+" + item.change.toLocaleString()).padStart(10) +
      ("+" + item.pctChange.toFixed(0) + "%").padStart(12)
    );
  }

  console.log("\n" + "=".repeat(70));
  console.log("WORDS THAT DECREASED MOST (2023 → 2024)");
  console.log("=".repeat(70));
  console.log("Word".padEnd(20) + "2023".padStart(10) + "2024".padStart(10) + "Change".padStart(10) + "%Change".padStart(12));
  console.log("-".repeat(70));

  for (const item of decreased) {
    console.log(
      item.word.padEnd(20) +
      item.count2023.toLocaleString().padStart(10) +
      item.count2024.toLocaleString().padStart(10) +
      item.change.toLocaleString().padStart(10) +
      (item.pctChange.toFixed(0) + "%").padStart(12)
    );
  }

  // New words in 2024
  const newIn2024 = changes
    .filter(c => c.count2023 === 0 && c.count2024 >= 20)
    .sort((a, b) => b.count2024 - a.count2024)
    .slice(0, 20);

  if (newIn2024.length > 0) {
    console.log("\n" + "=".repeat(70));
    console.log("NEW WORDS IN 2024 (not used in 2023)");
    console.log("=".repeat(70));
    for (const item of newIn2024) {
      console.log(`${item.word.padEnd(25)} ${item.count2024.toLocaleString()} uses`);
    }
  }

  process.exit(0);
}

main();
