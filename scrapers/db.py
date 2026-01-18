"""Database operations for scrapers."""

import json
from datetime import datetime
from typing import Optional, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import httpx

from config import DATABASE_URL, API_ENDPOINT, API_KEY


class EntryDB:
    """Database handler for entries."""

    def __init__(self, use_api: bool = False):
        """Initialize database connection or API client.

        Args:
            use_api: If True, use API endpoint instead of direct DB connection.
        """
        self.use_api = use_api
        self._conn = None

    @property
    def conn(self):
        """Get database connection (lazy initialization)."""
        if self._conn is None or self._conn.closed:
            if not DATABASE_URL:
                raise ValueError("DATABASE_URL is not configured")
            self._conn = psycopg2.connect(DATABASE_URL)
        return self._conn

    def close(self):
        """Close database connection."""
        if self._conn and not self._conn.closed:
            self._conn.close()

    def insert_entry(
        self,
        timestamp: datetime,
        source: str,
        text_content: str,
        external_id: Optional[str] = None,
        source_url: Optional[str] = None,
        entry_type: Optional[str] = None,
        venue: Optional[str] = None,
        title: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[int]:
        """Insert a new entry into the database.

        Returns:
            Entry ID if inserted, None if duplicate.
        """
        # Calculate counts
        word_count = len(text_content.split())
        character_count = len(text_content)

        if self.use_api:
            return self._insert_via_api(
                timestamp=timestamp,
                source=source,
                text_content=text_content,
                external_id=external_id,
                source_url=source_url,
                entry_type=entry_type,
                venue=venue,
                title=title,
                metadata=metadata,
                word_count=word_count,
                character_count=character_count,
            )

        return self._insert_via_db(
            timestamp=timestamp,
            source=source,
            text_content=text_content,
            external_id=external_id,
            source_url=source_url,
            entry_type=entry_type,
            venue=venue,
            title=title,
            metadata=metadata,
            word_count=word_count,
            character_count=character_count,
        )

    def _insert_via_db(
        self,
        timestamp: datetime,
        source: str,
        text_content: str,
        external_id: Optional[str],
        source_url: Optional[str],
        entry_type: Optional[str],
        venue: Optional[str],
        title: Optional[str],
        metadata: Optional[Dict[str, Any]],
        word_count: int,
        character_count: int,
    ) -> Optional[int]:
        """Insert entry directly into database."""
        with self.conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    INSERT INTO entries (
                        external_id, timestamp, source, source_url,
                        entry_type, venue, title, text_content,
                        character_count, word_count, metadata
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (external_id) DO NOTHING
                    RETURNING id
                    """,
                    (
                        external_id,
                        timestamp,
                        source,
                        source_url,
                        entry_type,
                        venue,
                        title,
                        text_content,
                        character_count,
                        word_count,
                        json.dumps(metadata) if metadata else None,
                    ),
                )
                result = cur.fetchone()
                self.conn.commit()
                return result[0] if result else None
            except Exception as e:
                self.conn.rollback()
                raise e

    def _insert_via_api(
        self,
        timestamp: datetime,
        source: str,
        text_content: str,
        external_id: Optional[str],
        source_url: Optional[str],
        entry_type: Optional[str],
        venue: Optional[str],
        title: Optional[str],
        metadata: Optional[Dict[str, Any]],
        word_count: int,
        character_count: int,
    ) -> Optional[int]:
        """Insert entry via API endpoint."""
        headers = {"Content-Type": "application/json"}
        if API_KEY:
            headers["Authorization"] = f"Bearer {API_KEY}"

        payload = {
            "timestamp": timestamp.isoformat(),
            "source": source,
            "textContent": text_content,
            "externalId": external_id,
            "sourceUrl": source_url,
            "entryType": entry_type,
            "venue": venue,
            "title": title,
            "metadata": metadata,
        }

        response = httpx.post(API_ENDPOINT, json=payload, headers=headers, timeout=30)
        response.raise_for_status()

        data = response.json()
        if data.get("duplicate"):
            return None
        return data.get("entry", {}).get("id")

    def get_latest_external_id(self, source: str) -> Optional[str]:
        """Get the most recent external_id for a source."""
        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT external_id FROM entries
                WHERE source = %s AND external_id IS NOT NULL
                ORDER BY timestamp DESC
                LIMIT 1
                """,
                (source,),
            )
            result = cur.fetchone()
            return result[0] if result else None

    def entry_exists(self, external_id: str) -> bool:
        """Check if an entry with the given external_id exists."""
        with self.conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM entries WHERE external_id = %s LIMIT 1",
                (external_id,),
            )
            return cur.fetchone() is not None
