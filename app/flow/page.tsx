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

  // Fetch more content from the API
  const fetchContent = useCallback(async () => {
    if (!engineRef.current) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/flow?count=20");
      const data = await response.json();

      if (data.items) {
        data.items.forEach((item: FlowItem) => {
          engineRef.current?.addContent(item.content, item.source);
        });
      }
    } catch (error) {
      console.error("Error fetching content:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Play/Pause and Clear */}
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlayPause}
                  className={`px-6 py-2 rounded-lg font-bold transition-all ${
                    isRunning
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {isRunning ? "PAUSE" : "START"}
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-all"
                >
                  Clear
                </button>
                <button
                  onClick={fetchContent}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {isLoading ? "Loading..." : "Load More"}
                </button>
              </div>

              {/* Mode selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Mode:</label>
                <select
                  value={currentMode}
                  onChange={(e) => setCurrentMode(e.target.value)}
                  className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm"
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
                  className="w-24 accent-red-500"
                />
                <span className="text-sm w-10">{speed.toFixed(1)}x</span>
              </div>

              {/* Spawn rate control */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Density:</label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={500 - spawnRate + 50}
                  onChange={(e) => setSpawnRate(500 - parseInt(e.target.value) + 50)}
                  className="w-24 accent-red-500"
                />
              </div>

              {/* Stats */}
              <div className="text-sm text-gray-400">
                <span className="text-green-400">{stats.activeWords}</span> active |{" "}
                <span className="text-blue-400">{stats.pendingWords}</span> queued
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#ff6b6b]"></span> Truth Social
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#4ecdc4]"></span> Presidency Project
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#ffe66d]"></span> Transcripts
              </span>
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
