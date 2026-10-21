"""Export the existing ESCO index to Excel-compatible CSVs (standard library only).

Run: python scripts/export_esco_csv.py
Optional: --source PATH --destination DIR --manifest PATH
List-valued metadata is preserved as JSON inside CSV cells. Occupation skill
requirements are exported separately, retaining every relationship field.
"""

import argparse
import csv
import gzip
import hashlib
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]


def cell(value):
    if isinstance(value, (list, dict)) or value is None or isinstance(value, bool):
        return json.dumps(value, ensure_ascii=False)
    return value


def write_csv(path, rows, default_fields):
    fields = list(dict.fromkeys(key for row in rows for key in row)) or default_fields
    with path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows({key: cell(value) for key, value in row.items()} for row in rows)
    # Verify decoded values too, including non-ASCII labels and quoted metadata.
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != fields:
            raise ValueError(f'{path.name}: header verification failed')
        count = 0
        for count, actual in enumerate(reader, start=1):
            expected = {key: str(cell(rows[count - 1][key])) if key in rows[count - 1] else ''
                        for key in fields}
            if actual != expected:
                raise ValueError(f'{path.name}: value verification failed at row {count}')
        if count != len(rows):
            raise ValueError(f'{path.name}: row count verification failed')
    return count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'data/index/esco_v1.2.1_en.json.gz')
    parser.add_argument('--destination', type=Path, default=ROOT / 'data/csv')
    parser.add_argument('--manifest', type=Path)
    args = parser.parse_args()
    manifest_path = args.manifest or args.source.with_suffix('.manifest.json')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    original_hash = hashlib.sha256(args.source.read_bytes()).hexdigest()
    if original_hash != manifest['artifact_sha256']:
        raise ValueError('Source checksum does not match manifest')
    with gzip.open(args.source, 'rt', encoding='utf-8') as stream:
        catalogue = json.load(stream)['catalogue']
    occupations = catalogue['occupations']
    skills = catalogue['skills']
    essential, optional = [], []
    for occupation in occupations:
        for edge in occupation['required_skills']:
            if edge['requirement'] not in ('essential', 'optional'):
                raise ValueError(f"Unsupported requirement: {edge['requirement']}")
            row = {'role_id': occupation['role_id'], **edge}
            (essential if edge['requirement'] == 'essential' else optional).append(row)
    aliases = [{'skill_id': skill['skill_id'], 'alias': alias}
               for skill in skills for alias in skill.get('aliases', [])]
    broader = [{'skill_id': skill['skill_id'], 'broader_skill_id': parent}
               for skill in skills for parent in skill.get('broader_skill_ids', [])]
    for key, rows in [('occupation_count', occupations), ('skill_count', skills),
                      ('essential_edge_count', essential), ('optional_edge_count', optional)]:
        if len(rows) != manifest[key]:
            raise ValueError(f'{key}: source {len(rows)} != manifest {manifest[key]}')
    # Alias and hierarchy totals are verified against source arrays: the manifest
    # does not declare counts for these two tables.
    exports = [
        ('occupations.csv', [{k: v for k, v in row.items() if k != 'required_skills'}
                             for row in occupations], ['role_id', 'title']),
        ('skills.csv', skills, ['skill_id', 'name']),
        ('essential_relationships.csv', essential, ['role_id', 'skill_id', 'requirement']),
        ('optional_relationships.csv', optional, ['role_id', 'skill_id', 'requirement']),
        ('skill_aliases.csv', aliases, ['skill_id', 'alias']),
        ('broader_skill_relationships.csv', broader, ['skill_id', 'broader_skill_id']),
    ]
    args.destination.mkdir(parents=True, exist_ok=True)
    results = [(name, write_csv(args.destination / name, rows, fields))
               for name, rows, fields in exports]
    if hashlib.sha256(args.source.read_bytes()).hexdigest() != original_hash:
        raise ValueError('Source checksum changed during export')
    for name, count in results:
        print(f'{(args.destination / name).as_posix()}: {count} rows')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, csv.Error) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
