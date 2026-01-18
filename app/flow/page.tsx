"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FlowEngine } from "@/lib/flow/FlowEngine";
import { flowModes } from "@/lib/flow/flowModes";
import Link from "next/link";

interface FlowItem {
  id: number;
  content: string;
  source: string;
  timestamp: string;
  isHarsh?: boolean;
  harshScore?: number;
  sentiment?: string;
}

export default function FlowPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FlowEngine | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentMode, setCurrentMode] = useState("wave");
  const [speed, setSpeed] = useState(1);
  const [spawnRate, setSpawnRate] = useState(200);
  const [stats, setStats] = useState({ activeWords: 0, pendingWords: 0, mode: "Wave" });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);

  // Filter states
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [timePeriod, setTimePeriod] = useState<"day" | "week" | "month" | "year" | "all">("all");
  const [harshOnly, setHarshOnly] = useState(false);
  const [sentimentColors, setSentimentColors] = useState(false);
  const [harshStats, setHarshStats] = useState({ total: 0, harshCount: 0 });
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);

  // Calculate date range based on selected date and time period
  const getDateRange = useCallback((date: string, period: string) => {
    if (!date || period === "all") return null;

    const target = new Date(date);
    let from: Date, to: Date;

    switch (period) {
      case "day":
        from = new Date(target);
        from.setHours(0, 0, 0, 0);
        to = new Date(target);
        to.setHours(23, 59, 59, 999);
        break;
      case "week":
        from = new Date(target);
        from.setDate(from.getDate() - 3);
        to = new Date(target);
        to.setDate(to.getDate() + 3);
        break;
      case "month":
        from = new Date(target.getFullYear(), target.getMonth(), 1);
        to = new Date(target.getFullYear(), target.getMonth() + 1, 0);
        break;
      case "year":
        from = new Date(target.getFullYear(), 0, 1);
        to = new Date(target.getFullYear(), 11, 31);
        break;
      default:
        return null;
    }

    return {
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
    };
  }, []);

  // Fetch more content from the API
  const fetchContent = useCallback(async () => {
    if (!engineRef.current) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({ count: "20" });

      if (selectedDate && timePeriod !== "all") {
        const range = getDateRange(selectedDate, timePeriod);
        if (range) {
          params.set("from", range.from);
          params.set("to", range.to);
          setDateRange(range);
        }
      } else {
        setDateRange(null);
      }

      if (harshOnly) params.set("harsh", "true");

      const response = await fetch(`/api/flow?${params}`);
      const data = await response.json();

      if (data.items) {
        data.items.forEach((item: FlowItem) => {
          let source = item.source;

          // Apply color coding based on mode
          if (sentimentColors && item.sentiment) {
            // Sentiment coloring: "sentiment_angry_truth_social"
            source = `sentiment_${item.sentiment}_${item.source}`;
          } else if (item.isHarsh) {
            // Harsh language highlighting
            source = "harsh_" + item.source;
          }

          engineRef.current?.addContent(item.content, source);
        });
      }

      if (data.stats) {
        setHarshStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching content:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, timePeriod, harshOnly, sentimentColors, getDateRange]);

  // Initialize engine
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new FlowEngine({
      container: containerRef.current,
      speed,
      spawnRate,
      mode: currentMode,
      maxWords: 150,
      onWordClick: (word) => {
        setSelectedWord(word.word);
        setTimeout(() => setSelectedWord(null), 2000);
      },
    });

    engineRef.current = engine;

    // Initial content fetch
    fetchContent();

    return () => {
      engine.destroy();
    };
  }, []);

  // Auto-fetch more content when running low
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const currentStats = engineRef.current?.getStats();
      if (currentStats && currentStats.pendingWords < 50) {
        fetchContent();
      }
      setStats(currentStats || { activeWords: 0, pendingWords: 0, mode: "Wave" });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, fetchContent]);

  // Handle mode change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setMode(currentMode);
      // Increase max words for redacted mode since words accumulate
      if (currentMode === "redacted") {
        engineRef.current.setMaxWords(800);
      } else {
        engineRef.current.setMaxWords(150);
      }
      fetchContent();
    }
  }, [currentMode, fetchContent]);

  // Handle speed change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSpeed(speed);
    }
  }, [speed]);

  // Handle spawn rate change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSpawnRate(spawnRate);
    }
  }, [spawnRate]);

  const togglePlayPause = () => {
    if (!engineRef.current) return;

    if (isRunning) {
      engineRef.current.stop();
    } else {
      engineRef.current.start();
    }
    setIsRunning(!isRunning);
  };

  const handleClear = () => {
    engineRef.current?.clear();
    setStats({ activeWords: 0, pendingWords: 0, mode: stats.mode });
  };

  const modeOptions = Object.keys(flowModes);

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold hover:text-red-400 transition-colors">
            FIREHOSE
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/words" className="text-sm text-gray-400 hover:text-white transition-colors">
              Word Analysis
            </Link>
            <button
              onClick={() => setShowControls(!showControls)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {showControls ? "Hide Controls" : "Show Controls"}
            </button>
          </div>
        </div>
      </nav>

      {/* Main visualization container - full viewport */}
      <div
        ref={containerRef}
        className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900"
        style={{ fontFamily: "Georgia, serif" }}
      ></div>

      {/* Selected word popup */}
      {selectedWord && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white/10 backdrop-blur-md rounded-lg px-8 py-4 text-2xl font-bold animate-pulse">
          {selectedWord}
        </div>
      )}

      {/* Control panel */}
      {showControls && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-sm border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-3">
            {/* Top row - main controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Play/Pause and Clear */}
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlayPause}
                  className={`px-5 py-2 rounded-lg font-bold transition-all ${
                    isRunning
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {isRunning ? "PAUSE" : "START"}
                </button>
                <button
                  onClick={handleClear}
                  className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-all text-sm"
                >
                  Clear
                </button>
                <button
                  onClick={fetchContent}
                  disabled={isLoading}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all text-sm"
                >
                  {isLoading ? "..." : "Load"}
                </button>
              </div>

              {/* Date and Period picker */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    if (timePeriod === "all") setTimePeriod("day");
                    engineRef.current?.clear();
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm w-36"
                />
                <select
                  value={timePeriod}
                  onChange={(e) => {
                    setTimePeriod(e.target.value as "day" | "week" | "month" | "year" | "all");
                    engineRef.current?.clear();
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
                {(selectedDate || timePeriod !== "all") && (
                  <button
                    onClick={() => {
                      setSelectedDate("");
                      setTimePeriod("all");
                      setDateRange(null);
                      engineRef.current?.clear();
                    }}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Color mode toggles */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={harshOnly}
                    onChange={(e) => {
                      setHarshOnly(e.target.checked);
                      if (e.target.checked) setSentimentColors(false);
                      engineRef.current?.clear();
                    }}
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className="text-sm text-red-400">🔥 Harsh</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sentimentColors}
                    onChange={(e) => {
                      setSentimentColors(e.target.checked);
                      if (e.target.checked) setHarshOnly(false);
                      engineRef.current?.clear();
                    }}
                    className="w-4 h-4 accent-purple-500"
                  />
                  <span className="text-sm text-purple-400">🎨 Sentiment</span>
                </label>
              </div>

              {/* Mode selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Mode:</label>
                <select
                  value={currentMode}
                  onChange={(e) => setCurrentMode(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  {modeOptions.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speed control */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Speed:</label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-20 accent-red-500"
                />
                <span className="text-sm w-8">{speed.toFixed(1)}x</span>
              </div>

              {/* Stats */}
              <div className="text-sm text-gray-400">
                <span className="text-green-400">{stats.activeWords}</span> active |{" "}
                <span className="text-blue-400">{stats.pendingWords}</span> queued
                {harshOnly && harshStats.harshCount > 0 && (
                  <span className="text-red-400 ml-2">| 🔥 {harshStats.harshCount}</span>
                )}
              </div>
            </div>

            {/* Bottom row - legend and info */}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/10 text-xs text-gray-500">
              {sentimentColors ? (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-[#ff4444]"></span> Angry
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-[#ff8c00]"></span> Fear
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-[#6699ff]"></span> Sad
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-[#44ff77]"></span> Positive
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-[#ffd700]"></span> Boastful
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-[#cccccc]"></span> Neutral
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-[#ff6b6b]"></span> Truth Social
                  </span>
                  {harshOnly && (
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-[#ff0000]"></span> Harsh
                    </span>
                  )}
                </>
              )}
              {dateRange && timePeriod !== "all" && (
                <span className="text-yellow-400">
                  📅 {timePeriod === "day" ? "Day" : timePeriod === "week" ? "Week" : timePeriod === "month" ? "Month" : "Year"}: {new Date(dateRange.from).toLocaleDateString()} - {new Date(dateRange.to).toLocaleDateString()}
                </span>
              )}
              <span className="ml-auto">Click any word to highlight</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {!isRunning && stats.activeWords === 0 && (
        <div className="fixed inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4 text-gray-500">Trump Word Flow</h2>
            <p className="text-gray-600 mb-4">Click START to begin the visualization</p>
            <p className="text-gray-700 text-sm">
              Words from {">"}24,000 Truth Social posts
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
