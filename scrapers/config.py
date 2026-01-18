"""Configuration for scrapers."""

import os
from dotenv import load_dotenv

load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL")

# API endpoint for submitting entries (alternative to direct DB)
API_ENDPOINT = os.getenv("API_ENDPOINT", "http://localhost:3000/api/entries")
API_KEY = os.getenv("API_KEY")

# Scraping configuration
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAY = 5

# User agent for requests
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# Source URLs
TRUTH_SOCIAL_BASE_URL = "https://truthsocial.com"
AMERICAN_PRESIDENCY_BASE_URL = "https://www.presidency.ucsb.edu"
REV_TRANSCRIPTS_BASE_URL = "https://www.rev.com"

# Scraping intervals (in seconds)
SCRAPE_INTERVAL_TRUTH_SOCIAL = 300  # 5 minutes
SCRAPE_INTERVAL_SPEECHES = 3600  # 1 hour
SCRAPE_INTERVAL_TRANSCRIPTS = 3600  # 1 hour
