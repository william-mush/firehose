"""American Presidency Project scraper.

Scrapes presidential documents from presidency.ucsb.edu.
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
    AMERICAN_PRESIDENCY_BASE_URL,
)
from db import EntryDB

SOURCE_NAME = "speech"


class AmericanPresidencyScraper:
    """Scraper for American Presidency Project documents."""

    # Document categories to scrape
    CATEGORIES = {
        "spoken-addresses-and-remarks": "speech",
        "press-conferences": "press_conference",
        "statements": "statement",
        "executive-orders": "executive_order",
        "proclamations": "proclamation",
        "presidential-memoranda": "memorandum",
    }

    def __init__(self, db: EntryDB, president: str = "donald-trump"):
        """Initialize the scraper.

        Args:
            db: Database handler.
            president: President name slug (e.g., "donald-trump").
        """
        self.db = db
        self.president = president
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
        """Parse a date string from the website.

        Args:
            date_str: Date string like "January 20, 2025".

        Returns:
            Parsed datetime or None.
        """
        try:
            # Common formats on the site
            for fmt in ["%B %d, %Y", "%b %d, %Y", "%Y-%m-%d"]:
                try:
                    return datetime.strptime(date_str.strip(), fmt)
                except ValueError:
                    continue
            return None
        except Exception:
            return None

    def _scrape_document_list(
        self, category: str, page: int = 0
    ) -> List[Dict[str, str]]:
        """Scrape a list of documents from a category page.

        Args:
            category: Category slug.
            page: Page number (0-indexed).

        Returns:
            List of document metadata with urls.
        """
        url = f"{AMERICAN_PRESIDENCY_BASE_URL}/documents/app-categories/{category}"
        if page > 0:
            url += f"?page={page}"

        # Filter by president
        url += f"&field_docs_person_target_id_1={self.president}"

        try:
            html = self._fetch_page(url)
            soup = BeautifulSoup(html, "lxml")

            documents = []
            # Find document links in the listing
            for item in soup.select(".view-content .views-row"):
                link_elem = item.select_one("a")
                date_elem = item.select_one(".date-display-single")

                if link_elem:
                    doc = {
                        "url": urljoin(AMERICAN_PRESIDENCY_BASE_URL, link_elem["href"]),
                        "title": link_elem.get_text(strip=True),
                        "date_str": date_elem.get_text(strip=True) if date_elem else "",
                    }
                    documents.append(doc)

            return documents
        except Exception as e:
            print(f"Error scraping document list: {e}")
            return []

    def _scrape_document(self, url: str) -> Optional[Dict[str, Any]]:
        """Scrape a single document page.

        Args:
            url: Document URL.

        Returns:
            Parsed document data or None.
        """
        try:
            html = self._fetch_page(url)
            soup = BeautifulSoup(html, "lxml")

            # Extract title
            title_elem = soup.select_one("h1.field-ds-doc-title")
            title = title_elem.get_text(strip=True) if title_elem else ""

            # Extract date
            date_elem = soup.select_one(".field-docs-start-date-time")
            date_str = date_elem.get_text(strip=True) if date_elem else ""
            timestamp = self._parse_date(date_str)

            # Extract content
            content_elem = soup.select_one(".field-docs-content")
            if not content_elem:
                return None

            # Get text content
            text_content = content_elem.get_text(separator="\n", strip=True)
            if not text_content:
                return None

            # Extract document ID from URL
            match = re.search(r"/documents/(\d+)", url)
            doc_id = match.group(1) if match else url.split("/")[-1]

            # Try to extract venue/location
            venue_elem = soup.select_one(".field-docs-location")
            venue = venue_elem.get_text(strip=True) if venue_elem else None

            return {
                "external_id": f"app_{doc_id}",
                "timestamp": timestamp or datetime.now(),
                "source": SOURCE_NAME,
                "source_url": url,
                "title": title,
                "text_content": text_content,
                "venue": venue,
                "metadata": {
                    "president": self.president,
                    "date_str": date_str,
                },
            }
        except Exception as e:
            print(f"Error scraping document {url}: {e}")
            return None

    def scrape_category(
        self, category: str, max_pages: int = 5, max_docs: int = 100
    ) -> List[Dict[str, Any]]:
        """Scrape documents from a category.

        Args:
            category: Category slug.
            max_pages: Maximum pages to scrape.
            max_docs: Maximum documents to fetch.

        Returns:
            List of parsed documents.
        """
        entry_type = self.CATEGORIES.get(category, "speech")
        documents = []

        for page in range(max_pages):
            if len(documents) >= max_docs:
                break

            doc_list = self._scrape_document_list(category, page)
            if not doc_list:
                break

            for doc_meta in doc_list:
                if len(documents) >= max_docs:
                    break

                # Check if already in database
                match = re.search(r"/documents/(\d+)", doc_meta["url"])
                if match:
                    ext_id = f"app_{match.group(1)}"
                    if self.db.entry_exists(ext_id):
                        continue

                # Scrape the full document
                doc = self._scrape_document(doc_meta["url"])
                if doc:
                    doc["entry_type"] = entry_type
                    documents.append(doc)
                    print(f"Scraped: {doc['title'][:60]}...")

        return documents

    def save_documents(self, documents: List[Dict[str, Any]]) -> int:
        """Save documents to the database.

        Args:
            documents: List of parsed documents.

        Returns:
            Number of new documents saved.
        """
        saved = 0
        for doc in documents:
            entry_id = self.db.insert_entry(
                external_id=doc["external_id"],
                timestamp=doc["timestamp"],
                source=doc["source"],
                source_url=doc["source_url"],
                entry_type=doc.get("entry_type"),
                venue=doc.get("venue"),
                title=doc.get("title"),
                text_content=doc["text_content"],
                metadata=doc.get("metadata"),
            )
            if entry_id:
                saved += 1

        return saved

    def run(self, categories: Optional[List[str]] = None) -> int:
        """Run the scraper.

        Args:
            categories: List of categories to scrape. If None, scrapes all.

        Returns:
            Total number of new documents saved.
        """
        if categories is None:
            categories = list(self.CATEGORIES.keys())

        total_saved = 0
        for category in categories:
            print(f"Scraping category: {category}")
            documents = self.scrape_category(category)
            print(f"Found {len(documents)} new documents")
            saved = self.save_documents(documents)
            print(f"Saved {saved} new documents")
            total_saved += saved

        return total_saved


def main():
    """Main entry point for the scraper."""
    db = EntryDB()
    try:
        scraper = AmericanPresidencyScraper(db)
        scraper.run()
        scraper.close()
    finally:
        db.close()


if __name__ == "__main__":
    main()
