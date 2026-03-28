import json
from pathlib import Path
from functools import lru_cache

REGISTRY_PATH = Path(__file__).resolve().parents[2] / "data" / "sources.yaml"


@lru_cache()
def load_sources_registry():
    if not REGISTRY_PATH.exists():
        return []
    try:
        import yaml  # type: ignore
    except Exception:
        return []
    with REGISTRY_PATH.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or []
    return data
