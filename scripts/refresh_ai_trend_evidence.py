"""Manual one-time refresh of the AI Trend Signal sample, never on a page load.

Run from the integration repository root with APP_DB_PATH set to an isolated DB.
Public Himalayas calls remain subject to its documented usage rules.
"""
from src.services.signal_employment_service import get_employment_dashboard, refresh_employment
from src.services.sources.himalayas import HimalayasSource
from src.services.skill_connections import process_skill_connections

if __name__ == "__main__":
    result = refresh_employment(HimalayasSource())
    print(f"Himalayas snapshot: {result.posting_count} retained postings; status: {result.refresh_status}")
    if result.posting_count:
        print("Connection extraction:", process_skill_connections())
    else:
        print("No live postings available. The app will display an honest empty state.")
