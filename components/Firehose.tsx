"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import type { Entry } from "@/lib/db/schema";

interface FirehoseProps {
  initialEntries?: Entry[];
  autoScroll?: boolean;
  scrollSpeed?: number;
}

interface FilterState {
  sources: string[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  truth_social: "border-red-500",
  speech: "border-blue-500",
  transcript: "border-green-500",
  press_release: "border-yellow-500",
  executive_order: "border-purple-500",
};

const SOURCE_LABELS: Record<string, string> = {
  truth_social: "Truth Social",
  speech: "Speech",
  transcript: "Transcript",
  press_release: "Press Release",
  executive_order: "Executive Order",
};

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export default function Firehose({
  initialEntries = [],
  autoScroll = true,
  scrollSpeed = 60,
}: FirehoseProps) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ sources: [] });
  const [showFilters, setShowFilters] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch entries from API
  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.sources.length > 0) {
        params.set("sources", filters.sources.join(","));
      }
      if (filters.dateFrom) {
        params.set("from", filters.dateFrom);
      }
      if (filters.dateTo) {
        params.set("to", filters.dateTo);
      }
      if (filters.search) {
        params.set("search", filters.search);
      }

      const response = await fetch(`/api/entries?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch entries");

      const data = await response.json();
      setEntries(data.entries);
    } catch (error) {
      console.error("Error fetching entries:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Initial fetch
  useEffect(() => {
    if (initialEntries.length === 0) {
      fetchEntries();
    }
  }, [fetchEntries, initialEntries.length]);

  // SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource("/api/stream");

    eventSource.onmessage = (event) => {
      try {
        const newEntry = JSON.parse(event.data) as Entry;
        setEntries((prev) => [newEntry, ...prev]);
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = () => {
      console.error("SSE connection error");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Handle source filter toggle
  const toggleSource = (source: string) => {
    setFilters((prev) => ({
      ...prev,
      sources: prev.sources.includes(source)
        ? prev.sources.filter((s) => s !== source)
        : [...prev.sources, source],
    }));
  };

  // Apply filters
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEntries();
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, fetchEntries]);

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-xl font-bold tracking-wider">FIREHOSE</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/flow"
            className="px-3 py-1 rounded text-sm bg-red-600 hover:bg-red-500 transition-colors"
          >
            Word Flow
          </Link>
          <Link
            href="/words"
            className="px-3 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700"
          >
            Analysis
          </Link>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1 rounded text-sm ${
              showFilters ? "bg-white text-black" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            Filters
          </button>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1 rounded text-sm ${
              isPaused ? "bg-yellow-600" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
          <span className="text-gray-500 text-sm">
            {entries.length.toLocaleString()} entries
          </span>
        </div>
      </header>

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 border-b border-gray-800 bg-gray-900">
          <div className="flex flex-wrap gap-4">
            {/* Source Filters */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Sources</label>
              <div className="flex gap-2">
                {Object.entries(SOURCE_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleSource(key)}
                    className={`px-2 py-1 rounded text-xs ${
                      filters.sources.includes(key)
                        ? "bg-white text-black"
                        : "bg-gray-800 hover:bg-gray-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-xs text-gray-500 mb-2">Date Range</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.dateFrom || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                  }
                  className="px-2 py-1 rounded bg-gray-800 text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={filters.dateTo || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                  }
                  className="px-2 py-1 rounded bg-gray-800 text-sm"
                />
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-2">Search</label>
              <input
                type="text"
                value={filters.search || ""}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                placeholder="Search text content..."
                className="w-full px-2 py-1 rounded bg-gray-800 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Scrolling Firehose */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        style={{
          scrollBehavior: isPaused ? "auto" : "smooth",
        }}
      >
        {isLoading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading entries...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No entries found
          </div>
        ) : (
          <div ref={scrollRef} className="divide-y divide-gray-800">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className={`p-4 hover:bg-gray-900 transition-colors border-l-4 ${
                  SOURCE_COLORS[entry.source] || "border-gray-500"
                }`}
              >
                {/* Entry Header */}
                <div className="flex items-center gap-3 mb-2 text-sm">
                  <span className="px-2 py-0.5 rounded bg-gray-800 text-xs">
                    {SOURCE_LABELS[entry.source] || entry.source}
                  </span>
                  <time className="text-gray-500">
                    {formatDate(entry.timestamp)}
                  </time>
                  {entry.venue && (
                    <span className="text-gray-600">@ {entry.venue}</span>
                  )}
                  {entry.wordCount && (
                    <span className="text-gray-600">
                      {entry.wordCount.toLocaleString()} words
                    </span>
                  )}
                </div>

                {/* Entry Title */}
                {entry.title && (
                  <h2 className="font-semibold mb-2 text-gray-200">
                    {entry.title}
                  </h2>
                )}

                {/* Entry Content */}
                <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {truncateText(entry.textContent)}
                </p>

                {/* Entry Footer */}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
                  {entry.sourceUrl && (
                    <a
                      href={entry.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-gray-400"
                    >
                      View Source
                    </a>
                  )}
                  {entry.externalId && (
                    <span>ID: {entry.externalId}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <footer className="p-2 border-t border-gray-800 text-xs text-gray-600 flex justify-between">
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
        <span>
          {entries.reduce((sum, e) => sum + (e.wordCount || 0), 0).toLocaleString()} total words
        </span>
      </footer>
    </div>
  );
}
