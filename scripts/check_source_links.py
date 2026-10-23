"""Read-only link checks against registered provider pages; writes verification metadata only."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def check(source):
    try:
        with urlopen(Request(source['url'], headers={'User-Agent': '3AM-source-audit/1.0'}), timeout=30) as response:
            response.read(1024)
            return {'source_id': source['source_id'], 'url': source['url'], 'status': response.status, 'final_url': response.url}
    except Exception as exc:
        return {'source_id': source['source_id'], 'url': source['url'], 'status': 'unavailable', 'reason': str(exc)}


if __name__ == '__main__':
    sources = json.loads((ROOT / 'data/sources/learning_sources.json').read_text(encoding='utf-8'))['sources']
    with ThreadPoolExecutor(max_workers=4) as pool:
        checks = list(pool.map(check, sources))
    (ROOT / 'data/sources/link_check_log.json').write_text(json.dumps({
        'schema_version': '1.0', 'checked_at': datetime.now(timezone.utc).isoformat(),
        'method': 'GET first 1024 bytes; confirms transport availability only, not syllabus correctness', 'checks': checks}, indent=2) + '\n', encoding='utf-8')
    for item in checks:
        print(item['source_id'], item['status'])
