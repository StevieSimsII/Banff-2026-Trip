"""Process selected Banff trip media for the static website.

How to run:
  1. Put selected originals in media/raw/.
  2. Install Pillow if needed: python -m pip install Pillow
  3. Optional HEIC support: python -m pip install pillow-heif
  4. Run: python scripts/process_media.py

The script writes compressed images to media/optimized/, thumbnails to
media/thumbs/, selected videos to media/videos/, and updates data/photos.json.
"""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - friendly runtime fallback
    Image = None
    ImageOps = None

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
    HEIC_SUPPORTED = True
except ImportError:  # pragma: no cover - optional dependency
    HEIC_SUPPORTED = False


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "media" / "raw"
OPTIMIZED_DIR = ROOT / "media" / "optimized"
THUMBS_DIR = ROOT / "media" / "thumbs"
VIDEOS_DIR = ROOT / "media" / "videos"
DATA_FILE = ROOT / "data" / "photos.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".heic"}
VIDEO_EXTS = {".mov", ".mp4"}
MAX_IMAGE_SIZE = (2000, 2000)
MAX_THUMB_SIZE = (720, 720)


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "banff-media"


def titleize(value: str) -> str:
    return slugify(value).replace("-", " ").title()


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def load_existing() -> list[dict[str, Any]]:
    if not DATA_FILE.exists():
        return []
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"Could not read existing photos.json: {exc}")
        return []
    return data if isinstance(data, list) else []


def find_existing(item_by_id: dict[str, dict[str, Any]], item_by_source: dict[str, dict[str, Any]], source: Path) -> dict[str, Any]:
    source_name = source.name
    slug = slugify(source.stem)
    return item_by_source.get(source_name) or item_by_id.get(slug) or {}


def infer_tags(source: Path) -> list[str]:
    text = source.stem.lower()
    tags: list[str] = []
    for tag in ["lake", "waterfall", "family", "landscape", "town", "food"]:
        if tag in text:
            tags.append(tag)
    if "falls" in text or "fall" in text:
        tags.append("waterfall")
    if source.suffix.lower() in VIDEO_EXTS:
        tags.append("video")
    return sorted(set(tags)) or ["landscape"]


def ensure_unique_id(base_id: str, used_ids: set[str]) -> str:
    candidate = base_id
    counter = 2
    while candidate in used_ids:
        candidate = f"{base_id}-{counter}"
        counter += 1
    used_ids.add(candidate)
    return candidate


def process_image(source: Path, item_id: str) -> tuple[str, str] | None:
    if Image is None or ImageOps is None:
        print(f"Skipped image without Pillow installed: {source.name}")
        return None

    if source.suffix.lower() == ".heic" and not HEIC_SUPPORTED:
        print(f"Skipped HEIC without pillow-heif installed: {source.name}")
        return None

    optimized_path = OPTIMIZED_DIR / f"{item_id}.jpg"
    thumb_path = THUMBS_DIR / f"{item_id}.jpg"

    try:
        with Image.open(source) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")

            optimized = image.copy()
            optimized.thumbnail(MAX_IMAGE_SIZE)
            optimized.save(optimized_path, "JPEG", quality=84, optimize=True, progressive=True)

            thumb = image.copy()
            thumb.thumbnail(MAX_THUMB_SIZE)
            thumb.save(thumb_path, "JPEG", quality=78, optimize=True, progressive=True)
    except Exception as exc:  # noqa: BLE001 - report and keep processing
        print(f"Skipped unreadable image {source.name}: {exc}")
        return None

    return rel(optimized_path), rel(thumb_path)


def process_video(source: Path, item_id: str) -> str:
    target = VIDEOS_DIR / f"{item_id}{source.suffix.lower()}"
    if source.resolve() != target.resolve():
        shutil.copy2(source, target)
    return rel(target)


def build_record(source: Path, existing: dict[str, Any], used_ids: set[str]) -> dict[str, Any] | None:
    extension = source.suffix.lower()
    base_id = slugify(str(existing.get("id") or source.stem))
    item_id = ensure_unique_id(base_id, used_ids)

    record = dict(existing)
    record["id"] = item_id
    record["title"] = str(existing.get("title") or titleize(source.stem))
    record["day"] = str(existing.get("day") or "Unsorted")
    record["location"] = str(existing.get("location") or "Banff / Canadian Rockies")
    record["caption"] = str(existing.get("caption") or "")
    record["tags"] = existing.get("tags") if isinstance(existing.get("tags"), list) else infer_tags(source)
    record["featured"] = bool(existing.get("featured", False))
    record["sourceName"] = source.name

    if extension in IMAGE_EXTS:
        processed = process_image(source, item_id)
        if processed is None:
            return None
        record["src"], record["thumb"] = processed
        record["type"] = "image"
        return record

    if extension in VIDEO_EXTS:
        record["src"] = process_video(source, item_id)
        record.pop("thumb", None)
        record["type"] = "video"
        return record

    print(f"Skipped unsupported file: {source.name}")
    return None


def main() -> None:
    OPTIMIZED_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing_items = load_existing()
    item_by_id = {str(item.get("id")): item for item in existing_items if item.get("id")}
    item_by_source = {
        str(item.get("sourceName")): item
        for item in existing_items
        if item.get("sourceName")
    }

    if not RAW_DIR.exists():
        print("No media/raw/ folder found. Create it and add selected originals when ready.")
        print("Nothing processed.")
        return

    raw_files = sorted(path for path in RAW_DIR.iterdir() if path.is_file())
    processed_by_source: dict[str, dict[str, Any]] = {}
    processed_by_id: dict[str, dict[str, Any]] = {}
    used_ids: set[str] = set()
    skipped = 0

    for source in raw_files:
        extension = source.suffix.lower()
        if extension not in IMAGE_EXTS | VIDEO_EXTS:
            print(f"Skipped unsupported file: {source.name}")
            skipped += 1
            continue

        existing = find_existing(item_by_id, item_by_source, source)
        record = build_record(source, existing, used_ids)
        if record is None:
            skipped += 1
            continue

        processed_by_source[source.name] = record
        processed_by_id[record["id"]] = record

    updated: list[dict[str, Any]] = []
    added_ids: set[str] = set()

    for item in existing_items:
        replacement = processed_by_source.get(str(item.get("sourceName"))) or processed_by_id.get(str(item.get("id")))
        if replacement:
            updated.append(replacement)
            added_ids.add(replacement["id"])
        else:
            updated.append(item)
            if item.get("id"):
                added_ids.add(str(item["id"]))

    for record in processed_by_source.values():
        if record["id"] not in added_ids:
            updated.append(record)
            added_ids.add(record["id"])

    DATA_FILE.write_text(json.dumps(updated, indent=2) + "\n", encoding="utf-8")

    image_count = sum(1 for item in processed_by_source.values() if item.get("type") == "image")
    video_count = sum(1 for item in processed_by_source.values() if item.get("type") == "video")
    print("Processing complete.")
    print(f"Images processed: {image_count}")
    print(f"Videos copied: {video_count}")
    print(f"Skipped files: {skipped}")
    print(f"Updated: {rel(DATA_FILE)}")


if __name__ == "__main__":
    main()
