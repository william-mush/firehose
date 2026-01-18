"""Scraper orchestrator.

Coordinates all scrapers and manages scheduling.
"""

import time
import signal
import sys
from datetime import datetime
from typing import Callable
import schedule

from config import (
    SCRAPE_INTERVAL_TRUTH_SOCIAL,
    SCRAPE_INTERVAL_SPEECHES,
    SCRAPE_INTERVAL_TRANSCRIPTS,
)
from db import EntryDB
from truth_social import TruthSocialScraper
from american_presidency import AmericanPresidencyScraper
from rev_transcripts import RevTranscriptsScraper


class ScraperOrchestrator:
    """Orchestrator for running all scrapers on schedule."""

    def __init__(self, use_api: bool = False):
        """Initialize the orchestrator.

        Args:
            use_api: If True, use API endpoint instead of direct DB connection.
        """
        self.use_api = use_api
        self.running = False
        self._setup_signal_handlers()

    def _setup_signal_handlers(self):
        """Set up graceful shutdown handlers."""
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)

    def _handle_shutdown(self, signum, frame):
        """Handle shutdown signals gracefully."""
        print(f"\nReceived signal {signum}, shutting down...")
        self.running = False

    def _run_with_logging(self, name: str, func: Callable[[], int]):
        """Run a scraper function with logging.

        Args:
            name: Scraper name for logging.
            func: Function to run.
        """
        start_time = datetime.now()
        print(f"\n{'='*50}")
        print(f"[{start_time.isoformat()}] Starting {name} scraper")
        print(f"{'='*50}")

        try:
            count = func()
            elapsed = (datetime.now() - start_time).total_seconds()
            print(f"[{name}] Completed in {elapsed:.1f}s, saved {count} new entries")
        except Exception as e:
            print(f"[{name}] Error: {e}")

    def run_truth_social(self):
        """Run the Truth Social scraper."""
        db = EntryDB(use_api=self.use_api)
        try:
            scraper = TruthSocialScraper(db)
            return scraper.run()
        finally:
            scraper.close()
            db.close()

    def run_american_presidency(self):
        """Run the American Presidency Project scraper."""
        db = EntryDB(use_api=self.use_api)
        try:
            scraper = AmericanPresidencyScraper(db)
            return scraper.run()
        finally:
            scraper.close()
            db.close()

    def run_rev_transcripts(self):
        """Run the Rev.com transcripts scraper."""
        db = EntryDB(use_api=self.use_api)
        try:
            scraper = RevTranscriptsScraper(db)
            return scraper.run()
        finally:
            scraper.close()
            db.close()

    def run_all_once(self):
        """Run all scrapers once (for testing/initial population)."""
        self._run_with_logging("Truth Social", self.run_truth_social)
        self._run_with_logging("American Presidency", self.run_american_presidency)
        self._run_with_logging("Rev Transcripts", self.run_rev_transcripts)

    def start_scheduled(self):
        """Start the scheduled scraping loop."""
        print("Setting up scraper schedules...")

        # Schedule Truth Social (most frequent)
        schedule.every(SCRAPE_INTERVAL_TRUTH_SOCIAL).seconds.do(
            self._run_with_logging, "Truth Social", self.run_truth_social
        )

        # Schedule American Presidency Project (hourly)
        schedule.every(SCRAPE_INTERVAL_SPEECHES).seconds.do(
            self._run_with_logging, "American Presidency", self.run_american_presidency
        )

        # Schedule Rev.com transcripts (hourly)
        schedule.every(SCRAPE_INTERVAL_TRANSCRIPTS).seconds.do(
            self._run_with_logging, "Rev Transcripts", self.run_rev_transcripts
        )

        print(f"Truth Social: every {SCRAPE_INTERVAL_TRUTH_SOCIAL}s")
        print(f"American Presidency: every {SCRAPE_INTERVAL_SPEECHES}s")
        print(f"Rev Transcripts: every {SCRAPE_INTERVAL_TRANSCRIPTS}s")

        # Run initial scrape
        print("\nRunning initial scrape...")
        self.run_all_once()

        # Start the scheduling loop
        print("\nStarting scheduled scraping loop...")
        self.running = True

        while self.running:
            schedule.run_pending()
            time.sleep(1)

        print("Scraper orchestrator stopped.")


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Firehose scraper orchestrator")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run all scrapers once and exit",
    )
    parser.add_argument(
        "--scraper",
        choices=["truth", "presidency", "rev"],
        help="Run a specific scraper once",
    )
    parser.add_argument(
        "--use-api",
        action="store_true",
        help="Use API endpoint instead of direct DB connection",
    )

    args = parser.parse_args()

    orchestrator = ScraperOrchestrator(use_api=args.use_api)

    if args.scraper:
        if args.scraper == "truth":
            orchestrator._run_with_logging("Truth Social", orchestrator.run_truth_social)
        elif args.scraper == "presidency":
            orchestrator._run_with_logging(
                "American Presidency", orchestrator.run_american_presidency
            )
        elif args.scraper == "rev":
            orchestrator._run_with_logging(
                "Rev Transcripts", orchestrator.run_rev_transcripts
            )
    elif args.once:
        orchestrator.run_all_once()
    else:
        orchestrator.start_scheduled()


if __name__ == "__main__":
    main()
