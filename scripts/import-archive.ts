/**
 * Import Truth Social archive data into the database.
 *
 * Usage:
 *   npm run import-archive -- --file=./data/archive.json
 *   npm run import-archive -- --url=https://example.com/archive.json
 */

import { db, entries, SOURCES } from "../lib/db";
import { readFileSync } from "fs";
import { resolve } from "path";

interface TruthSocialPost {
  id: string;
  created_at: string;
  content: string;
  url?: string;
  reblogs_count?: number;
  favourites_count?: number;
  replies_count?: number;
  reblog?: object;
  account?: {
    username?: string;
  };
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
}

/**
 * Strip HTML tags from content.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Import posts from a JSON file.
 */
async function importFromFile(filePath: string): Promise<ImportStats> {
  const absolutePath = resolve(process.cwd(), filePath);
  console.log(`Reading archive from: ${absolutePath}`);

  const fileContent = readFileSync(absolutePath, "utf-8");
  const posts: TruthSocialPost[] = JSON.parse(fileContent);

  return importPosts(posts);
}

/**
 * Import posts from a URL.
 */
async function importFromUrl(url: string): Promise<ImportStats> {
  console.log(`Fetching archive from: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch archive: ${response.status}`);
  }

  const posts: TruthSocialPost[] = await response.json();
  return importPosts(posts);
}

/**
 * Import an array of posts into the database.
 */
async function importPosts(posts: TruthSocialPost[]): Promise<ImportStats> {
  const stats: ImportStats = {
    total: posts.length,
    imported: 0,
    skipped: 0,
    errors: 0,
  };

  console.log(`Processing ${stats.total} posts...`);

  // Process in batches to avoid overwhelming the database
  const batchSize = 100;

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    const batchValues = [];

    for (const post of batch) {
      try {
        // Skip posts without content
        if (!post.content) {
          stats.skipped++;
          continue;
        }

        // Strip HTML from content
        const textContent = stripHtml(post.content);
        if (!textContent) {
          stats.skipped++;
          continue;
        }

        // Parse timestamp
        const timestamp = new Date(post.created_at);
        if (isNaN(timestamp.getTime())) {
          console.warn(`Invalid timestamp for post ${post.id}: ${post.created_at}`);
          stats.errors++;
          continue;
        }

        // Calculate counts
        const wordCount = textContent.split(/\s+/).filter(Boolean).length;
        const characterCount = textContent.length;

        batchValues.push({
          externalId: `truth_${post.id}`,
          timestamp,
          source: SOURCES.TRUTH_SOCIAL,
          sourceUrl: post.url || `https://truthsocial.com/@realDonaldTrump/posts/${post.id}`,
          entryType: "post",
          textContent,
          characterCount,
          wordCount,
          metadata: {
            account: post.account?.username || "realDonaldTrump",
            reblogsCount: post.reblogs_count || 0,
            favouritesCount: post.favourites_count || 0,
            repliesCount: post.replies_count || 0,
            isReblog: post.reblog !== undefined && post.reblog !== null,
          },
        });
      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
        stats.errors++;
      }
    }

    // Insert batch
    if (batchValues.length > 0) {
      try {
        const result = await db
          .insert(entries)
          .values(batchValues)
          .onConflictDoNothing({ target: entries.externalId })
          .returning({ id: entries.id });

        stats.imported += result.length;
        stats.skipped += batchValues.length - result.length;
      } catch (error) {
        console.error("Error inserting batch:", error);
        stats.errors += batchValues.length;
      }
    }

    // Progress update
    const progress = Math.round(((i + batch.length) / posts.length) * 100);
    process.stdout.write(`\rProgress: ${progress}% (${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors)`);
  }

  console.log("\n");
  return stats;
}

/**
 * Main function.
 */
async function main() {
  const args = process.argv.slice(2);

  let filePath: string | undefined;
  let url: string | undefined;

  for (const arg of args) {
    if (arg.startsWith("--file=")) {
      filePath = arg.slice(7);
    } else if (arg.startsWith("--url=")) {
      url = arg.slice(6);
    }
  }

  if (!filePath && !url) {
    console.error("Usage:");
    console.error("  npm run import-archive -- --file=./data/archive.json");
    console.error("  npm run import-archive -- --url=https://example.com/archive.json");
    process.exit(1);
  }

  try {
    let stats: ImportStats;

    if (filePath) {
      stats = await importFromFile(filePath);
    } else {
      stats = await importFromUrl(url!);
    }

    console.log("Import complete:");
    console.log(`  Total posts: ${stats.total}`);
    console.log(`  Imported: ${stats.imported}`);
    console.log(`  Skipped (duplicates/empty): ${stats.skipped}`);
    console.log(`  Errors: ${stats.errors}`);

    process.exit(0);
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  }
}

main();
