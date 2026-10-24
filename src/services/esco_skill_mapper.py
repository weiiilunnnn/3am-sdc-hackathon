"""Version-pinned ESCO normalization for CV review.

Prefers the official full ESCO index already in the project's main/KW Git branch.
An optional official ESCO skills_en.csv remains supported. No made-up IDs and
no network access on user requests. Local Pathwaay vocabulary is a fallback.
"""
from __future__ import annotations

import csv
import gzip
import hashlib
import json
import os
import re
from functools import lru_cache
from pathlib import Path

from src.data.skills_taxonomy import find_skill_by_label

ESCO_VERSION = '1.2.1'
ESCO_SOURCE_URL = 'https://esco.ec.europa.eu/en/use-esco/download'
ESCO_URI = re.compile(r'^https?://data\.europa\.eu/esco/skill/[0-9a-fA-F-]{36}$')
MAX_INDEX_BYTES = 32 * 1024 * 1024
MAX_DECOMPRESSED_BYTES = 250 * 1024 * 1024


def _clean(value: str) -> str:
    return re.sub(r'\s+', ' ', value.casefold().strip())


def _root() -> Path:
    return Path(__file__).resolve().parents[2]


def _locations() -> list[tuple[Path, str]]:
    """User override first; otherwise prefer the teammate's full index."""
    custom_csv = os.getenv('ESCO_SKILLS_CSV', '').strip()
    custom_index = (os.getenv('ESCO_INDEX_GZ') or os.getenv('ESCO_INDEX_PATH') or '').strip()
    if custom_csv:
        return [(Path(custom_csv).expanduser(), 'official_csv')]
    if custom_index:
        return [(Path(custom_index).expanduser(), 'kw_main_full_index')]
    return [
        (_root() / 'data/index/esco_v1.2.1_en.json.gz', 'kw_main_full_index'),
        (_root() / 'src/data/esco/skills_en.csv', 'official_csv'),
    ]


def _add_alias(labels: dict[str, dict[str, str]], label: str, uri: str, preferred: str) -> None:
    if isinstance(label, str):
        key = _clean(label)
        if key:
            labels.setdefault(key, {})[uri] = preferred


def _finish(labels: dict[str, dict[str, str]]) -> dict[str, tuple[tuple[str, str], ...]]:
    return {key: tuple(sorted(values.items())) for key, values in labels.items()}


@lru_cache(maxsize=4)
def _read_csv(path: str, mtime_ns: int, size: int) -> tuple[dict, int]:
    del mtime_ns, size
    labels: dict[str, dict[str, str]] = {}
    unique: set[str] = set()
    with open(path, encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not {'conceptUri', 'preferredLabel'}.issubset(reader.fieldnames or ()):
            raise ValueError('Official CSV needs conceptUri and preferredLabel columns.')
        for row in reader:
            uri, preferred = (row.get('conceptUri') or '').strip(), (row.get('preferredLabel') or '').strip()
            if not ESCO_URI.fullmatch(uri) or not preferred:
                continue
            unique.add(uri)
            _add_alias(labels, preferred, uri, preferred)
            alt = (row.get('altLabels') or row.get('alternativeLabels') or '').strip()
            for label in re.split(r'\n|\r|\|', alt):
                _add_alias(labels, label, uri, preferred)
    return _finish(labels), len(unique)


@lru_cache(maxsize=2)
def _read_index(path: str, mtime_ns: int, size: int, manifest_mtime: int) -> tuple[dict, int]:
    del mtime_ns, manifest_mtime
    source = Path(path)
    if size > MAX_INDEX_BYTES:
        raise ValueError('ESCO index exceeds maximum compressed size')
    manifest_path = source.with_suffix('.manifest.json')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest.get('esco_release') != 'v1.2.1' or manifest.get('language') != 'en':
        raise ValueError('Unexpected ESCO version or language')
    artifact = source.read_bytes()
    if hashlib.sha256(artifact).hexdigest() != manifest.get('artifact_sha256'):
        raise ValueError('ESCO index failed teammate manifest integrity check')
    with gzip.open(source, 'rb') as stream:
        raw = stream.read(MAX_DECOMPRESSED_BYTES + 1)
        if len(raw) > MAX_DECOMPRESSED_BYTES:
            raise ValueError('ESCO index exceeds maximum decompressed size')
    payload = json.loads(raw)
    catalogue = payload.get('catalogue', {}) if isinstance(payload, dict) else {}
    records = catalogue.get('skills') if isinstance(catalogue, dict) else None
    if not isinstance(records, list) or len(records) != manifest.get('skill_count'):
        raise ValueError('ESCO index has an unexpected skill count')
    labels: dict[str, dict[str, str]] = {}
    ids: set[str] = set()
    for record in records:
        if not isinstance(record, dict):
            raise ValueError('ESCO index has an invalid record')
        uri, preferred = record.get('skill_id'), record.get('name')
        if not isinstance(uri, str) or not isinstance(preferred, str) or not preferred:
            raise ValueError('ESCO index has an invalid skill identity')
        # The shared catalogue also contains ISCED education classifications.
        # Verify the complete artifact above, but only index skill concepts.
        if uri.startswith('http://data.europa.eu/esco/isced-f/'):
            continue
        if not ESCO_URI.fullmatch(uri):
            raise ValueError('ESCO index has an invalid skill identity')
        if uri in ids:
            raise ValueError('Duplicate ESCO identifier in index')
        ids.add(uri)
        _add_alias(labels, preferred, uri, preferred)
        aliases = record.get('aliases', [])
        if not isinstance(aliases, list):
            raise ValueError('Invalid alias list in ESCO index')
        for alias in aliases:
            _add_alias(labels, alias, uri, preferred)
    return _finish(labels), len(ids)


def _snapshot() -> tuple[dict, int, str, str | None]:
    for path, origin in _locations():
        try:
            stat = path.stat()
            if not path.is_file():
                continue
            if origin == 'kw_main_full_index':
                manifest = path.with_suffix('.manifest.json')
                labels, count = _read_index(str(path), stat.st_mtime_ns, stat.st_size, manifest.stat().st_mtime_ns)
            else:
                if stat.st_size > 100 * 1024 * 1024:
                    continue
                labels, count = _read_csv(str(path), stat.st_mtime_ns, stat.st_size)
            if count:
                return labels, count, origin, str(path)
        except (OSError, ValueError, UnicodeError, csv.Error, json.JSONDecodeError, EOFError):
            continue
    return {}, 0, 'missing', None


def esco_status() -> dict:
    _, count, origin, path = _snapshot()
    return {
        'loaded': count > 0, 'concept_count': count,
        'version': ESCO_VERSION if count else None,
        'source_url': ESCO_SOURCE_URL, 'source_kind': origin,
        'reference_path': path,
        'message': ('ESCO v1.2.1 full reference from team Git data' if origin == 'kw_main_full_index' else
                    'Official ESCO English skills CSV loaded' if count else
                    'ESCO reference unavailable; skills remain local or custom until the team index is installed.'),
    }


def normalise_skill(label: str, evidence: str = '') -> dict:
    raw = label.strip()[:100]
    known = find_skill_by_label(raw)
    labels, count, _, _ = _snapshot()
    matches = labels.get(_clean(raw), ())
    # Never silently resolve an ambiguous label to a random ESCO URI.
    match = matches[0] if count and len(matches) == 1 else None
    return {
        'original_text': raw,
        'canonical_name': match[1] if match else (known['name'] if known else raw),
        'esco_uri': match[0] if match else None,
        'source_version': ESCO_VERSION if match else None,
        'taxonomy_source': 'ESCO v1.2.1' if match else ('Local prototype vocabulary' if known else 'Custom'),
        'legacy_skill_id': known['id'] if known else None,
        'match_status': ('esco_exact' if match else
                         'esco_ambiguous_review' if len(matches) > 1 else
                         'local_only' if known else 'unmatched'),
        'evidence': evidence[:300],
    }
