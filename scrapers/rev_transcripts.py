"""Rev.com transcripts scraper.

Scrapes political speech transcripts from rev.com/blog/transcripts.
"""

import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin
import httpx
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential

from config import (
    USER_AGENT,
    REQUEST_TIMEOUT,
    MAX_RETRIES,
    REV_TRANSCRIPTS_BASE_URL,
)
from db import EntryDB

SOURCE_NAME = "transcript"


class RevTranscriptsScraper:
    """Scraper for Rev.com transcripts."""

    def __init__(self, db: EntryDB, search_term: str = "trump"):
        """Initialize the scraper.

        Args:
            db: Database handler.
            search_term: Term to search for in transcripts.
        """
        self.db = db
        self.search_term = search_term
        self.client = httpx.Client(
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
        )

    def close(self):
        """Close the HTTP client."""
        self.client.close()

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    def _fetch_page(self, url: str) -> str:
        """Fetch a page with retry logic."""
        response = self.client.get(url)
        response.raise_for_status()
        return response.text

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse a date string from Rev.com.

        Args:
            date_str: Date string like "Jan 20, 2025".

        Returns:
            Parsed datetime or None.
        """
        try:
            # Clean up the date string
            date_str = date_str.strip()
            # Common formats on Rev.com
            for fmt in ["%b %d, %Y", "%B %d, %Y", "%m/%d/%Y"]:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            return None
        except Exception:
            return None

    def _scrape_transcript_list(self, page: int = 1) -> List[Dict[str, str]]:
        """Scrape a list of transcripts from the search/listing page.

        Args:
            page: Page number (1-indexed).

        Returns:
            List of transcript metadata with urls.
        """
        # Rev.com transcripts listing URL
        url = f"{REV_TRANSCRIPTS_BASE_URL}/blog/transcripts"
        if page > 1:
            url += f"/page/{page}"

        # Add search parameter if searching
        if self.search_term:
            url += f"?s={self.search_term}"

        try:
            html = self._fetch_page(url)
            soup = BeautifulSoup(html, "lxml")

            transcripts = []
            # Find transcript cards/items
            for item in soup.select("article.fl-post-feed-post"):
                link_elem = item.select_one("a.fl-post-feed-link")
                title_elem = item.select_one(".fl-post-feed-title")
                date_elem = item.select_one(".fl-post-feed-date")

                if link_elem:
                    transcript = {
                        "url": link_elem.get("href", ""),
                        "title": title_elem.get_text(strip=True) if title_elem else "",
                        "date_str": date_elem.get_text(strip=True) if date_elem else "",
                    }
                    transcripts.append(transcript)

            # Alternative selector for different page layouts
            if not transcripts:
                for item in soup.select(".post-item, .transcript-item"):
                    link_elem = item.select_one("a")
                    if link_elem and link_elem.get("href"):
                        transcript = {
                            "url": link_elem.get("href", ""),
                            "title": link_elem.get_text(strip=True),
                            "date_str": "",
                        }
                        transcripts.append(transcript)

            return transcripts
        except Exception as e:
            print(f"Error scraping transcript list: {e}")
            return []

    def _scrape_transcript(self, url: str) -> Optional[Dict[str, Any]]:
        """Scrape a single transcript page.

        Args:
            url: Transcript URL.

        Returns:
            Parsed transcript data or None.
        """
        try:
            html = self._fetch_page(url)
            soup = BeautifulSoup(html, "lxml")

            # Extract title
            title_elem = soup.select_one("h1.fl-heading")
            if not title_elem:
                title_elem = soup.select_one("h1")
            title = title_elem.get_text(strip=True) if title_elem else ""

            # Extract date
            date_elem = soup.select_one(".fl-post-info-date")
            if not date_elem:
                date_elem = soup.select_one("time, .post-date")
            date_str = date_elem.get_text(strip=True) if date_elem else ""
            timestamp = self._parse_date(date_str)

            # Extract transcript content
            content_elem = soup.select_one(".fl-rich-text")
            if not content_elem:
                content_elem = soup.select_one("article .entry-content")
            if not content_elem:
                content_elem = soup.select_one(".transcript-content")

            if not content_elem:
                return None

            # Get text content, preserving speaker labels
            text_parts = []
            for elem in content_elem.children:
                if hasattr(elem, "get_text"):
                    text = elem.get_text(separator=" ", strip=True)
                    if text:
                        text_parts.append(text)

            text_content = "\n\n".join(text_parts)
            if not text_content:
                text_content = content_elem.get_text(separator="\n", strip=True)

            if not text_content:
                return None

            # Generate external ID from URL slug
            slug = url.rstrip("/").split("/")[-1]
            external_id = f"rev_{slug}"

            # Try to extract event/venue info from title
            venue = None
            if " at " in title.lower():
                parts = title.lower().split(" at ")
                if len(parts) > 1:
                    venue = parts[1].split(" - ")[0].strip().title()

            return {
                "external_id": external_id,
                "timestamp": timestamp or datetime.now(),
                "source": SOURCE_NAME,
                "source_url": url,
                "entry_type": "transcript",
                "title": title,
                "text_content": text_content,
                "venue": venue,
                "metadata": {
                    "search_term": self.search_term,
                    "date_str": date_str,
                },
            }
        except Exception as e:
            print(f"Error scraping transcript {url}: {e}")
            return None

    def scrape_transcripts(
        self, max_pages: int = 5, max_transcripts: int = 50
    ) -> List[Dict[str, Any]]:
        """Scrape transcripts from the listing.

        Args:
            max_pages: Maximum pages to scrape.
            max_transcripts: Maximum transcripts to fetch.

        Returns:
            List of parsed transcripts.
        """
        transcripts = []

        for page in range(1, max_pages + 1):
            if len(transcripts) >= max_transcripts:
                break

            transcript_list = self._scrape_transcript_list(page)
            if not transcript_list:
                break

            for trans_meta in transcript_list:
                if len(transcripts) >= max_transcripts:
                    break

                url = trans_meta["url"]
                if not url:
                    continue

                # Generate external ID to check for duplicates
                slug = url.rstrip("/").split("/")[-1]
                ext_id = f"rev_{slug}"
                if self.db.entry_exists(ext_id):
                    continue

                # Scrape the full transcript
                transcript = self._scrape_transcript(url)
                if transcript:
                    transcripts.append(transcript)
                    print(f"Scraped: {transcript['title'][:60]}...")

        return transcripts

    def save_transcripts(self, transcripts: List[Dict[str, Any]]) -> int:
        """Save transcripts to the database.

        Args:
            transcripts: List of parsed transcripts.

        Returns:
            Number of new transcripts saved.
        """
        saved = 0
        for transcript in transcripts:
            entry_id = self.db.insert_entry(
                external_id=transcript["external_id"],
                timestamp=transcript["timestamp"],
                source=transcript["source"],
                source_url=transcript["source_url"],
                entry_type=transcript.get("entry_type"),
                venue=transcript.get("venue"),
                title=transcript.get("title"),
                text_content=transcript["text_content"],
                metadata=transcript.get("metadata"),
            )
            if entry_id:
                saved += 1

        return saved

    def run(self) -> int:
        """Run the scraper.

        Returns:
            Number of new transcripts saved.
        """
        print(f"Scraping Rev.com transcripts for: {self.search_term}")
        transcripts = self.scrape_transcripts()
        print(f"Found {len(transcripts)} new transcripts")
        saved = self.save_transcripts(transcripts)
        print(f"Saved {saved} new transcripts")
        return saved


def main():
    """Main entry point for the scraper."""
    db = EntryDB()
    try:
        scraper = RevTranscriptsScraper(db)
        scraper.run()
        scraper.close()
    finally:
        db.close()


if __name__ == "__main__":
    main()
