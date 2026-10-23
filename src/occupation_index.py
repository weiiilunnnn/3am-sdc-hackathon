"""One version-pinned local inverted index. No network during discovery."""
from collections import defaultdict
from dataclasses import dataclass
from functools import lru_cache
import gzip
import hashlib
import json
import os
from pathlib import Path

from .data_repository import DATA_ROOT, get_catalogues, validate_catalogue
from .models import OccupationCatalog, SourceRegistry


@dataclass
class OccupationIndex:
    catalog: OccupationCatalog
    sources: dict
    coverage: str = "local_subset_fallback"
    manifest: dict | None = None
    warning: str | None = None

    def __post_init__(self):
        validate_catalogue(self.catalog, self.sources)
        self.roles = {r.role_id: r for r in self.catalog.occupations if r.status == 'released'}
        self.skills = {s.skill_id: s for s in self.catalog.skills}
        self.aliases = defaultdict(set)
        for skill in self.skills.values():
            for label in [skill.name, *skill.aliases]:
                self.aliases[' '.join(label.casefold().split())].add(skill.skill_id)
        self.reverse = defaultdict(set)
        self.edges = {}
        for rid, role in self.roles.items():
            self.edges[rid] = {r.skill_id: r for r in role.required_skills}
            for sid in self.edges[rid]:
                self.reverse[sid].add(rid)
        self.n = len(self.roles)
        self.df = {sid: len(roles) for sid, roles in self.reverse.items()}
        self.fingerprint = (self.manifest or {}).get('artifact_sha256', self.catalog.dataset_id + ':' + self.catalog.dataset_version)


def load_occupation_index(path=None):
    bundle = get_catalogues()
    path = Path(path or os.getenv('ESCO_INDEX_PATH', str(DATA_ROOT / 'index/esco_v1.2.1_en.json.gz')))
    try:
        if not path.exists():
            raise ValueError('Full index not installed. Run the explicit ESCO index build; only the 15-role demo fallback is available.')
        manifest = json.loads(path.with_suffix('.manifest.json').read_text(encoding='utf-8'))
        if manifest.get('esco_release') != bundle.occupations.dataset_version or manifest.get('language') != 'en' or manifest.get('coverage') != 'full_api_collection':
            raise ValueError('Full-index version/language/coverage is incompatible')
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != manifest.get('artifact_sha256'):
            raise ValueError('Full-index checksum mismatch')
        obj = json.loads(gzip.decompress(raw))
        catalog = OccupationCatalog.model_validate(obj['catalogue'])
        sources = {s.source_id: s for s in SourceRegistry.model_validate(obj['sources']).sources}
        if catalog.dataset_version != manifest['esco_release'] or len(catalog.occupations) != manifest['occupation_count'] or len(catalog.skills) != manifest['skill_count']:
            raise ValueError('Full-index manifest does not match its records')
        # Existing reviewed evidence identities remain byte-for-byte compatible
        # for legacy team clients; the import has checked all local role anchors.
        sources.update(bundle.sources)
        return OccupationIndex(catalog, sources, 'local_full', manifest)
    except (ValueError, OSError, KeyError) as exc:
        return OccupationIndex(bundle.occupations, bundle.sources, warning=str(exc))


@lru_cache(maxsize=1)
def get_occupation_index():
    return load_occupation_index()
