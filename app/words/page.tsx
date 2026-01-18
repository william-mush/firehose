"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface WordData {
  word: string;
  count: number;
}

interface AnalysisResult {
  words: WordData[];
  totalOccurrences: number;
  uniqueCount: number;
  entriesAnalyzed: number;
  mode: string;
  dateRange: {
    from: string | null;
    to: string | null;
  };
}

type Period = "all" | "2022" | "2023" | "2024" | "2025";

export default function WordsPage() {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [comparisonData, setComparisonData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"words" | "phrases">("words");
  const [limit, setLimit] = useState(200);
  const [period, setPeriod] = useState<Period>("all");
  const [comparePeriod, setComparePeriod] = useState<Period | "">("");
  const [includeStopWords, setIncludeStopWords] = useState(false);

  const getPeriodDates = (p: Period): { from?: string; to?: string } => {
    switch (p) {
      case "2022":
        return { from: "2022-01-01", to: "2022-12-31" };
      case "2023":
        return { from: "2023-01-01", to: "2023-12-31" };
      case "2024":
        return { from: "2024-01-01", to: "2024-12-31" };
      case "2025":
        return { from: "2025-01-01", to: "2025-12-31" };
      default:
        return {};
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        mode,
        includeStopWords: includeStopWords.toString(),
      });

      const dates = getPeriodDates(period);
      if (dates.from) params.set("from", dates.from);
      if (dates.to) params.set("to", dates.to);

      const response = await fetch(`/api/words?${params}`);
      const result = await response.json();
      setData(result);

      // Fetch comparison data if selected
      if (comparePeriod) {
        const compareParams = new URLSearchParams({
          limit: limit.toString(),
          mode,
          includeStopWords: includeStopWords.toString(),
        });
        const compareDates = getPeriodDates(comparePeriod as Period);
        if (compareDates.from) compareParams.set("from", compareDates.from);
        if (compareDates.to) compareParams.set("to", compareDates.to);

        const compareResponse = await fetch(`/api/words?${compareParams}`);
        const compareResult = await compareResponse.json();
        setComparisonData(compareResult);
      } else {
        setComparisonData(null);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, mode, period, comparePeriod, includeStopWords]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getComparisonRank = (word: string): number | null => {
    if (!comparisonData) return null;
    const index = comparisonData.words.findIndex((w) => w.word === word);
    return index === -1 ? null : index + 1;
  };

  const getComparisonCount = (word: string): number | null => {
    if (!comparisonData) return null;
    const found = comparisonData.words.find((w) => w.word === word);
    return found ? found.count : 0;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white">
              ← Back to Firehose
            </Link>
            <h1 className="text-xl font-bold">Word Frequency Analysis</h1>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="border-b border-gray-800 p-4 bg-gray-900">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Mode */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "words" | "phrases")}
              className="bg-gray-800 rounded px-3 py-2 text-sm"
            >
              <option value="words">Single Words</option>
              <option value="phrases">Phrases (2 words)</option>
            </select>
          </div>

          {/* Time Period */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Time Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="bg-gray-800 rounded px-3 py-2 text-sm"
            >
              <option value="all">All Time</option>
              <option value="2022">2022</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
            </select>
          </div>

          {/* Compare Period */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Compare To</label>
            <select
              value={comparePeriod}
              onChange={(e) => setComparePeriod(e.target.value as Period | "")}
              className="bg-gray-800 rounded px-3 py-2 text-sm"
            >
              <option value="">No Comparison</option>
              <option value="all">All Time</option>
              <option value="2022">2022</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
            </select>
          </div>

          {/* Limit */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Show Top</label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="bg-gray-800 rounded px-3 py-2 text-sm"
            >
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
              <option value="1000">1,000</option>
              <option value="5000">5,000</option>
              <option value="10000">All</option>
            </select>
          </div>

          {/* Stop Words Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="stopWords"
              checked={includeStopWords}
              onChange={(e) => setIncludeStopWords(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="stopWords" className="text-sm text-gray-400">
              Include common words (the, a, is...)
            </label>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {data && (
        <div className="border-b border-gray-800 p-4 flex gap-8 text-sm">
          <div>
            <span className="text-gray-500">Posts Analyzed:</span>{" "}
            <span className="font-mono">{data.entriesAnalyzed.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Total {mode === "phrases" ? "Phrases" : "Words"}:</span>{" "}
            <span className="font-mono">{data.totalOccurrences.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Unique:</span>{" "}
            <span className="font-mono">{data.uniqueCount.toLocaleString()}</span>
          </div>
          {comparisonData && (
            <>
              <div className="border-l border-gray-700 pl-8">
                <span className="text-blue-400">Compare Posts:</span>{" "}
                <span className="font-mono">{comparisonData.entriesAnalyzed.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Content */}
      <main className="p-4">
        {loading ? (
          <div className="text-center py-20 text-gray-500">Analyzing...</div>
        ) : data ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="py-2 px-4 w-16">Rank</th>
                  <th className="py-2 px-4">{mode === "phrases" ? "Phrase" : "Word"}</th>
                  <th className="py-2 px-4 text-right">Count</th>
                  <th className="py-2 px-4 text-right">% of Total</th>
                  {comparisonData && (
                    <>
                      <th className="py-2 px-4 text-right text-blue-400">Compare Rank</th>
                      <th className="py-2 px-4 text-right text-blue-400">Compare Count</th>
                      <th className="py-2 px-4 text-right">Change</th>
                    </>
                  )}
                  <th className="py-2 px-4 w-64">Bar</th>
                </tr>
              </thead>
              <tbody>
                {data.words.map((item, index) => {
                  const percentage = ((item.count / data.totalOccurrences) * 100).toFixed(2);
                  const barWidth = (item.count / data.words[0].count) * 100;
                  const compareRank = getComparisonRank(item.word);
                  const compareCount = getComparisonCount(item.word);
                  const rankChange = compareRank ? compareRank - (index + 1) : null;

                  return (
                    <tr
                      key={item.word}
                      className="border-b border-gray-800/50 hover:bg-gray-900"
                    >
                      <td className="py-2 px-4 font-mono text-gray-500">
                        {index + 1}
                      </td>
                      <td className="py-2 px-4 font-medium">{item.word}</td>
                      <td className="py-2 px-4 text-right font-mono">
                        {item.count.toLocaleString()}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-gray-500">
                        {percentage}%
                      </td>
                      {comparisonData && (
                        <>
                          <td className="py-2 px-4 text-right font-mono text-blue-400">
                            {compareRank || "—"}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-blue-400">
                            {compareCount !== null ? compareCount.toLocaleString() : "—"}
                          </td>
                          <td className="py-2 px-4 text-right font-mono">
                            {rankChange !== null ? (
                              <span
                                className={
                                  rankChange > 0
                                    ? "text-green-400"
                                    : rankChange < 0
                                    ? "text-red-400"
                                    : "text-gray-500"
                                }
                              >
                                {rankChange > 0 ? `↑${rankChange}` : rankChange < 0 ? `↓${Math.abs(rankChange)}` : "—"}
                              </span>
                            ) : (
                              <span className="text-yellow-400">NEW</span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="py-2 px-4">
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-red-500 h-2 rounded-full"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">No data available</div>
        )}
      </main>
    </div>
  );
}
