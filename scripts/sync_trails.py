"""Sync trail metadata for local previews.

How to run:
  python scripts/sync_trails.py

Edit data/trails.json first, then run this script to refresh
assets/trail-data.js so the Trail Logs section also works when opening
index.html directly from your computer.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TRAILS_JSON = ROOT / "data" / "trails.json"
TRAIL_DATA_JS = ROOT / "assets" / "trail-data.js"


def main() -> None:
    trails = json.loads(TRAILS_JSON.read_text(encoding="utf-8"))
    TRAIL_DATA_JS.write_text(
        "// Generated from data/trails.json for local file previews.\n"
        f"window.BANFF_TRAILS = {json.dumps(trails, indent=2)};\n",
        encoding="utf-8",
    )
    print(f"Synced {TRAILS_JSON.relative_to(ROOT)} -> {TRAIL_DATA_JS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
