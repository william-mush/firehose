import { pgTable, serial, varchar, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

export const entries = pgTable(
  "entries",
  {
    id: serial("id").primaryKey(),
    externalId: varchar("external_id", { length: 255 }).unique(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    source: varchar("source", { length: 50 }).notNull(),
    sourceUrl: text("source_url"),
    entryType: varchar("entry_type", { length: 50 }),
    venue: varchar("venue", { length: 100 }),
    title: text("title"),
    textContent: text("text_content").notNull(),
    characterCount: integer("character_count"),
    wordCount: integer("word_count"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    timestampIdx: index("idx_timestamp").on(table.timestamp),
    sourceIdx: index("idx_source").on(table.source),
    typeIdx: index("idx_type").on(table.entryType),
  })
);

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

// Source types for the firehose
export const SOURCES = {
  TRUTH_SOCIAL: "truth_social",
  SPEECH: "speech",
  TRANSCRIPT: "transcript",
  PRESS_RELEASE: "press_release",
  EXECUTIVE_ORDER: "executive_order",
} as const;

export type Source = (typeof SOURCES)[keyof typeof SOURCES];
