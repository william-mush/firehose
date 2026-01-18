import { NextRequest, NextResponse } from "next/server";
import { db, entries, SOURCES } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

const ARCHIVE_URL = "https://raw.githubusercontent.com/aristotle-tek/trump-truth-social-archive/main/data/truth_archive.json";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

interface TruthSocialPost {
  id: string;
  created_at: string;
  content: string;
  url?: string;
  media?: string[];
  reblogs_count?: number;
  favourites_count?: number;
  replies_count?: number;
}

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
    .replace(/\u00e2\u0080\u0099/g, "'")
    .replace(/\u00e2\u0080\u009c/g, '"')
    .replace(/\u00e2\u0080\u009d/g, '"')
    .trim();
}

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron or has the correct secret
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-vercel-cron");

  if (!cronHeader && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Starting sync from GitHub archive...");

    const response = await fetch(ARCHIVE_URL, {
      headers: { "Cache-Control": "no-cache" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch archive: ${response.status}`);
    }

    const posts: TruthSocialPost[] = await response.json();
    console.log(`Archive contains ${posts.length} posts`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches
    const batchSize = 100;

    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      const batchValues = [];

      for (const post of batch) {
        try {
          if (!post.content) {
            skipped++;
            continue;
          }

          const textContent = stripHtml(post.content);
          if (!textContent) {
            skipped++;
            continue;
          }

          const timestamp = new Date(post.created_at);
          if (isNaN(timestamp.getTime())) {
            errors++;
            continue;
          }

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
              account: "realDonaldTrump",
              reblogsCount: post.reblogs_count || 0,
              favouritesCount: post.favourites_count || 0,
              repliesCount: post.replies_count || 0,
              hasMedia: (post.media?.length || 0) > 0,
            },
          });
        } catch {
          errors++;
        }
      }

      if (batchValues.length > 0) {
        try {
          const result = await db
            .insert(entries)
            .values(batchValues)
            .onConflictDoNothing({ target: entries.externalId })
            .returning({ id: entries.id });

          imported += result.length;
          skipped += batchValues.length - result.length;
        } catch (error) {
          console.error("Error inserting batch:", error);
          errors += batchValues.length;
        }
      }
    }

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        totalInArchive: posts.length,
        newPostsImported: imported,
        skipped,
        errors,
      },
    };

    console.log("Sync complete:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
