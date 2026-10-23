"""Explicit resumable full official API import, or import saved bulk envelopes.

Never follows server pagination URLs (the live API's links and offset semantics
disagree). Uses measured page-number offsets and verifies total/unique counts.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import sys
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.services.sources.esco import EscoClient
from src.models.future_roles import OccupationCatalog, SourceRegistry
from src.services.future_roles.data_repository import validate_catalogue

VERSION = "v1.2.1"
SCRIPT_VERSION = "full-esco-api-import-v1"


def save(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.GzipFile(filename=str(path), mode='wb', mtime=0) as stream:
        stream.write(json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode())


def collect(kind, cache, client, page_size=50):
    def fetch_page(page):
        path = cache / f'{kind}-{VERSION}-{page_size}-{page}.json.gz'
        if path.exists():
            envelope = json.loads(gzip.decompress(path.read_bytes()))
        else:
            envelope = EscoClient(timeout=30).fetch(kind, VERSION, collection=True, limit=page_size, offset=page)
            save(path, envelope)
        return envelope
    first = fetch_page(0)
    expected = first['record'].get('total')
    if not isinstance(expected, int) or expected <= 0 or expected > 100000:
        raise ValueError('Invalid source collection total')
    records, logs = {}, []
    pages = (expected + page_size - 1) // page_size
    def envelopes():
        yield first
        # At most two concurrent official requests, build-time only.
        with ThreadPoolExecutor(max_workers=2) as pool:
            yield from pool.map(fetch_page, range(1, pages))
    for page, envelope in enumerate(envelopes()):
        if envelope['requested_version'] != VERSION or envelope.get('returned_version') not in [None, VERSION]:
            raise ValueError('Cached response version mismatch')
        data = envelope['record']
        total = data.get('total')
        if not isinstance(total, int) or total <= 0 or expected is not None and total != expected:
            raise ValueError('Unstable or invalid upstream total')
        expected = total
        rows = data.get('_embedded', {})
        if not rows or any(uri in records for uri in rows):
            raise ValueError('Duplicate/empty page: pagination or source changed; do not activate')
        for uri, row in rows.items():
            if row.get('uri') != uri or row.get('className', '').casefold() != kind:
                raise ValueError('Unexpected bulk concept identity')
        records.update(rows)
        logs.append({k: v for k, v in envelope.items() if k != 'record'})
        print(f'{kind} page {page}: {len(records)}/{expected}', flush=True)
    if len(records) != expected:
        raise ValueError('Source total does not equal unique concepts')
    return records, logs


def materialise(occupations, skills, logs, destination):
    now = datetime.now(timezone.utc).date().isoformat()
    sources, definitions, roles, anomalies = [], {}, [], []
    def source(uri, title, kind, claims):
        sid = 'esco:' + kind + ':' + uri.rsplit('/', 1)[-1]
        sources.append({'source_id': sid, 'evidence_status': 'verified', 'source_type': 'official_esco_bulk_record',
            'title': f'ESCO {VERSION}: {title}', 'publisher': 'European Commission',
            'url': 'https://ec.europa.eu/esco/api/resource/' + kind + '?uri=' + uri + '&language=en&selectedVersion=' + VERSION,
            'native_record_id': uri, 'dataset_version': VERSION, 'accessed_at': now, 'region': 'EU',
            'license': 'European Commission reuse conditions; ESCO acknowledgement required',
            'license_url': 'https://esco.ec.europa.eu/en/about-esco/faq?page=1',
            'supported_claims': claims, 'transformations': 'English extraction from complete official bulk records; canonical IDs retained; application scores are not ESCO weights.'})
        return sid
    for uri, row in skills.items():
        if row.get('status') != 'released':
            continue
        links = row.get('_links', {})
        kind = next((x['uri'].rsplit('/', 1)[-1] for x in links.get('hasSkillType', [])), 'unknown')
        if kind not in ['skill', 'knowledge', 'unknown']:
            raise ValueError('Unrecognised skill type')
        sid = source(uri, row['preferredLabel']['en'], 'skill', ['skill_labels', 'skill_hierarchy'])
        definitions[uri] = {'skill_id': uri, 'name': row['preferredLabel']['en'], 'skill_type': kind,
            'aliases': sorted(set(row.get('alternativeLabel', {}).get('en', []))), 'source_ids': [sid],
            'broader_skill_ids': sorted({x['uri'] for x in links.get('broaderSkill', [])}),
            'reuse_level': next((x['uri'].rsplit('/', 1)[-1] for x in links.get('hasReuseLevel', [])), None)}
    for uri, row in occupations.items():
        if row.get('status') != 'released':
            continue
        title = row['preferredLabel']['en']
        sid = source(uri, title, 'occupation', ['occupation', 'skill_labels', 'role_skill_relationships'])
        requirements = {}
        for key, importance in [('hasOptionalSkill', 'optional'), ('hasEssentialSkill', 'essential')]:
            for link in row.get('_links', {}).get(key, []):
                skill = definitions.get(link['uri'])
                if skill is None:
                    raise ValueError(f'Orphan/obsolete requirement: {uri} / {link["uri"]}')
                if link['uri'] in requirements:
                    anomalies.append({'role_id': uri, 'skill_id': link['uri'], 'rule': 'essential precedence, canonical URI deduplication'})
                requirements[link['uri']] = {'skill_id': skill['skill_id'], 'name': skill['name'], 'skill_type': skill['skill_type'], 'requirement': importance, 'source_ids': [sid]}
        description = row.get('description', {}).get('en', {})
        description = description.get('literal', '') if isinstance(description, dict) else description
        roles.append({'role_id': uri, 'title': title, 'description': description,
            'aliases': row.get('alternativeLabel', {}).get('en', []), 'status': 'released', 'language': 'en',
            'esco_code': row.get('code'), 'required_skills': sorted(requirements.values(), key=lambda x: x['skill_id']),
            'source_ids': [sid], 'region': 'EU', 'evidence_status': 'verified', 'requirements_complete': True,
            'expected_essential_count': sum(x['requirement'] == 'essential' for x in requirements.values())})
    for skill in definitions.values():
        # Retain only active canonical broader-skill edges; unresolved parents
        # are reported and cannot become invented display groups.
        absent = set(skill['broader_skill_ids']) - definitions.keys()
        if absent:
            anomalies.append({'skill_id': skill['skill_id'], 'unavailable_broader_parents': sorted(absent)})
        skill['broader_skill_ids'] = [x for x in skill['broader_skill_ids'] if x in definitions]
    subset = json.loads((ROOT / 'data/occupations/esco_v1.2.1_en.json').read_text(encoding='utf-8'))
    for s in subset['skills']:
        if s['skill_id'] not in definitions:
            raise ValueError('Original reference skill missing from full import')
        definitions[s['skill_id']]['aliases'] = sorted(set(definitions[s['skill_id']]['aliases'] + s['aliases']))
    by_id = {r['role_id']: r for r in roles}
    for old in subset['occupations']:
        new = by_id[old['role_id']]
        if {(r['skill_id'], r['requirement']) for r in old['required_skills']} != {(r['skill_id'], r['requirement']) for r in new['required_skills']}:
            raise ValueError('Pinned API import disagrees with existing local version anchor')
    catalog = OccupationCatalog.model_validate({'schema_version': '1.1', 'dataset_id': 'esco-full-official-api', 'dataset_version': VERSION,
        'is_synthetic': False, 'occupations': sorted(roles, key=lambda r: r['role_id']), 'skills': sorted(definitions.values(), key=lambda s: s['skill_id'])})
    registry = SourceRegistry(schema_version='1.0', sources=sources)
    validate_catalogue(catalog, {s.source_id: s for s in registry.sources})
    counts = Counter(x.requirement for r in catalog.occupations for x in r.required_skills)
    manifest = {'schema_version': '1.0', 'import_script_version': SCRIPT_VERSION, 'esco_release': VERSION, 'language': 'en',
        'acquisition': 'Official bulk API, explicit selectedVersion; not a manually downloaded CSV package',
        'source_page': 'https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api',
        'download_page': 'https://esco.ec.europa.eu/en/use-esco/download', 'retrieved_date': now,
        'coverage': 'full_api_collection', 'source_occupation_total': len(occupations), 'source_skill_total': len(skills),
        'occupation_count': len(roles), 'skill_count': len(definitions), 'essential_edge_count': counts['essential'], 'optional_edge_count': counts['optional'],
        'inactive_occupations_excluded': len(occupations)-len(roles), 'inactive_skills_excluded': len(skills)-len(definitions),
        'version_assurance': 'Explicit selectedVersion; invalid-version rejection tested; all 15 local version anchors checked. API does not expose returned_version.',
        'returned_version': None, 'pagination': 'offset is page index (live limit=1/2 probes); totals/unique counts checked, upstream next links not trusted',
        'attribution': 'This service uses the ESCO classification of the European Commission.',
        'anomalies': anomalies, 'retrievals': logs}
    artifact = {'catalogue': catalog.model_dump(mode='json'), 'sources': registry.model_dump(mode='json')}
    save(destination, artifact)
    manifest['artifact_sha256'] = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix('.manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in manifest.items() if k not in ['retrievals', 'anomalies']}, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, default=ROOT / '.cache/esco-bulk')
    parser.add_argument('--output', type=Path, default=ROOT / 'data/index/esco_v1.2.1_en.json.gz')
    args = parser.parse_args()
    client = EscoClient()
    roles, rlog = collect('occupation', args.cache_dir, client)
    skills, slog = collect('skill', args.cache_dir, client)
    materialise(roles, skills, rlog+slog, args.output)
