"""Truth Social scraper.

Scrapes posts from Truth Social accounts.
Note: Truth Social API requires authentication for most endpoints.
This scraper may need adjustment based on API access.
"""

import re
from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx
from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential

from config import (
    USER_AGENT,
    REQUEST_TIMEOUT,
    MAX_RETRIES,
    TRUTH_SOCIAL_BASE_URL,
)
from db import EntryDB

SOURCE_NAME = "truth_social"


class TruthSocialScraper:
    """Scraper for Truth Social posts."""

    def __init__(self, db: EntryDB, account: str = "realDonaldTrump"):
        """Initialize the scraper.

        Args:
            db: Database handler.
            account: Truth Social account to scrape (without @).
        """
        self.db = db
        self.account = account
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

    def _parse_post(self, post_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse a post from API response.

        Args:
            post_data: Raw post data from API.

        Returns:
            Parsed post data or None if invalid.
        """
        try:
            # Extract text content (strip HTML if present)
            content = post_data.get("content", "")
            if content:
                soup = BeautifulSoup(content, "lxml")
                content = soup.get_text(separator=" ", strip=True)

            if not content:
                return None

            # Parse timestamp
            created_at = post_data.get("created_at")
            if created_at:
                timestamp = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            else:
                timestamp = datetime.utcnow()

            return {
                "external_id": f"truth_{post_data.get('id', '')}",
                "timestamp": timestamp,
                "source": SOURCE_NAME,
                "source_url": f"{TRUTH_SOCIAL_BASE_URL}/@{self.account}/posts/{post_data.get('id')}",
                "entry_type": "post",
                "text_content": content,
                "metadata": {
                    "account": self.account,
                    "reblogs_count": post_data.get("reblogs_count", 0),
                    "favourites_count": post_data.get("favourites_count", 0),
                    "replies_count": post_data.get("replies_count", 0),
                    "is_reblog": post_data.get("reblog") is not None,
                },
            }
        except Exception as e:
            print(f"Error parsing post: {e}")
            return None

    def scrape_recent(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Scrape recent posts from the account.

        Note: This requires API access. For public access, we may need
        to use alternative methods like RSS feeds if available.

        Args:
            limit: Maximum number of posts to fetch.

        Returns:
            List of parsed posts.
        """
        posts = []

        # Try the public API endpoint
        # Note: This may require authentication or may not be available
        api_url = f"{TRUTH_SOCIAL_BASE_URL}/api/v1/accounts/{self.account}/statuses"

        try:
            response = self.client.get(api_url, params={"limit": limit})
            if response.status_code == 200:
                data = response.json()
                for post_data in data:
                    parsed = self._parse_post(post_data)
                    if parsed:
                        posts.append(parsed)
        except Exception as e:
            print(f"Error fetching from API: {e}")
            # Fallback to web scraping could be implemented here

        return posts

    def save_posts(self, posts: List[Dict[str, Any]]) -> int:
        """Save posts to the database.

        Args:
            posts: List of parsed posts.

        Returns:
            Number of new posts saved.
        """
        saved = 0
        for post in posts:
            entry_id = self.db.insert_entry(
                external_id=post["external_id"],
                timestamp=post["timestamp"],
                source=post["source"],
                source_url=post["source_url"],
                entry_type=post["entry_type"],
                text_content=post["text_content"],
                metadata=post["metadata"],
            )
            if entry_id:
                saved += 1
                print(f"Saved new post: {post['external_id']}")

        return saved

    def run(self) -> int:
        """Run the scraper.

        Returns:
            Number of new posts saved.
        """
        print(f"Scraping Truth Social account: @{self.account}")
        posts = self.scrape_recent()
        print(f"Found {len(posts)} posts")
        saved = self.save_posts(posts)
        print(f"Saved {saved} new posts")
        return saved


def main():
    """Main entry point for the scraper."""
    db = EntryDB()
    try:
        scraper = TruthSocialScraper(db)
        scraper.run()
        scraper.close()
    finally:
        db.close()


if __name__ == "__main__":
    main()
