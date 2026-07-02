# Banff 2026 Trip Website

A polished static travel scrapbook for the June 24-29, 2026 Banff and Canadian
Rockies trip. The site is built with plain HTML, CSS, and JavaScript so it can
run directly on GitHub Pages.

## Project Structure

```text
index.html
assets/styles.css
assets/app.js
data/photos.json
media/optimized/
media/thumbs/
media/videos/
scripts/process_media.py
```

## Local Preview

Open `index.html` in a browser. The page includes graceful placeholders, so it
works before real images are added.

For the closest match to GitHub Pages behavior, you can also run a simple local
server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Recommended Photo Workflow

1. Keep full originals in Google Photos.
2. Put only selected website-ready photos into this repo.
3. Use compressed images and thumbnails for the website.
4. Link to the full Google Photos album for the full archive.

The full album button already points to:

```text
https://photos.app.goo.gl/TDwcVwiQXMaVxXPSA
```

## Adding Photos

1. Create a `media/raw/` folder.
2. Add selected JPG, JPEG, PNG, or HEIC files to `media/raw/`.
3. Run the processing script:

```bash
python scripts/process_media.py
```

The script creates optimized images in `media/optimized/`, thumbnails in
`media/thumbs/`, and updates `data/photos.json`.

HEIC files are supported when the optional dependency is installed:

```bash
python -m pip install pillow-heif
```

The main image processing dependency is Pillow:

```bash
python -m pip install Pillow
```

## Adding Videos

Selected MP4 or MOV files can be placed in `media/raw/` and processed into
`media/videos/` by the script. You can also add external video links in
`data/photos.json` with this shape:

```json
{
  "id": "gondola-video-01",
  "title": "Banff Gondola Clip",
  "day": "Day 3",
  "location": "Banff Gondola",
  "externalUrl": "https://example.com/video",
  "caption": "A short clip from the top of Sulphur Mountain.",
  "tags": ["video", "highlight"],
  "featured": false,
  "type": "video"
}
```

## Editing Captions

Open `data/photos.json` and edit:

- `title`
- `day`
- `location`
- `caption`
- `tags`
- `featured`

Set `"featured": true` for photos that should appear in the Featured Moments
section.

Supported tags include:

```text
highlight, family, landscape, waterfall, lake, town, food, video
```

## Publishing With GitHub Pages

1. Push this repo to GitHub.
2. Open the repository on GitHub.
3. Go to Settings -> Pages.
4. Under Build and deployment, choose Deploy from a branch.
5. Select the `master` branch and `/ (root)`.
6. Save.

GitHub will publish the static site from `index.html`.

## Large File Notes

Do not commit huge raw photos or videos by default. The `.gitignore` file keeps
`media/raw/`, HEIC originals, MOV files, and MP4 files out of Git unless a
selected video is intentionally placed in `media/videos/`.
