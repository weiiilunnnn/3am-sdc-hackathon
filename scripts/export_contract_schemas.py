"""Export reviewed v1 JSON schemas from the canonical Pydantic models."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src import models
from src.discovery_models import DiscoveryRequest, DiscoveryResponse, RoleSearchRequest, RoleSearchResponse

NAMES = ["UserProfile", "SourceRegistry", "OccupationCatalog", "ResourceCatalog", "TrendSnapshot",
         "ScenarioConfig", "SDGMappingSnapshot", "MatchRequest", "MatchResponse", "PathwayRequest", "PathwayResponse"]
if __name__ == "__main__":
    destination = ROOT / "docs/schemas"
    destination.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        (destination / f"{name}.json").write_text(
            json.dumps(getattr(models, name).model_json_schema(), indent=2) + "\n", encoding="utf-8")
    for contract in [DiscoveryRequest, DiscoveryResponse, RoleSearchRequest, RoleSearchResponse]:
        (destination / f"{contract.__name__}.json").write_text(json.dumps(contract.model_json_schema(), indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(NAMES)} v1 and 4 discovery/search schemas")
