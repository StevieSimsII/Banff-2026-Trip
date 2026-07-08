# Banff & Yoho — June 2026

A cinematic, scrollytelling photo journal of five days in the Canadian Rockies,
built as a static site for GitHub Pages. No build step, no framework — open
`index.html` or push to Pages and it works.

**Live experience:** full-bleed hero, day-by-day chapters with parallax openers,
justified photo galleries with lightbox, inline films, and for every hike an
interactive topo map (Leaflet + onX GPS tracks) with an animated, hover-synced
elevation profile.

## Built with Claude Fable 5

This site was co-created with [Claude Fable 5](https://www.anthropic.com/news/claude-fable-5-mythos-5),
Anthropic's frontier model, working in Cowork mode on a folder of raw trip
files: ~150 iPhone photos, 12 MOV clips, and a single onX Backcountry GPX
export. From that starting point, the model handled the full pipeline:

**Photo curation.** Fable 5 wrote and ran a perceptual-hash (dHash) +
Laplacian-sharpness pipeline to find burst shots and retakes, then *visually
reviewed* every candidate group on contact sheets before acting — catching two
false positives the algorithm wanted to delete (a distinct landscape
composition and a posed portrait). 42 near-duplicates were archived, keeping
the sharpest frame of each; 114 photos remain.

**Metadata forensics.** The original day labels were wrong — "Banff Gondola"
day was actually the Icefields Parkway. Fable 5 cross-referenced photo EXIF
timestamps against GPX trackpoint times (correcting UTC to Mountain time),
confirmed the fix by inspecting the photos themselves, and rebuilt every
day/location/caption assignment from ground truth.

**Hiking data.** It parsed 2,800+ GPX trackpoints into per-hike distance,
smoothed elevation gain, and downsampled profiles; merged out-and-back track
pairs into single hikes; and — noticing the onX timestamps implied impossible
hiking speeds — chose to omit pace/duration rather than publish bad numbers.

**Media engineering.** All 12 HEVC MOV clips were re-encoded to web-playable
H.264 MP4 with poster frames, and the git strategy keeps originals local while
shipping only optimized derivatives.

**The site itself.** Design and code are Fable 5's: the dark photo-forward
visual system, the justified-row gallery algorithm, lazy-initialized Leaflet
minimaps with animated track drawing, SVG elevation profiles that sync a
marker onto the map as you hover, and the scroll-driven chapter structure.
Before delivery it smoke-tested its own code headlessly with a stubbed DOM,
catching and fixing two initialization-order bugs.

Total human input: a folder of files, four multiple-choice answers, and one
screenshot pointing out leftover duplicates.

## Structure

```
index.html              page shell
assets/
  styles.css            all styling (dark, photo-forward)
  app.js                scrollytelling engine (vanilla JS + Leaflet)
  site-data.js          generated — all photos, videos, days, hike stats
data/
  photos.json           canonical media metadata (generated)
  trails.json           canonical hike stats (generated)
media/
  optimized/            web-size photos (site uses these)
  thumbs/               gallery thumbnails
  video-web/            H.264 MP4s (site uses these)
  video-posters/        poster frames
  raw/, videos/         originals — local only, git-ignored
  archive/              near-duplicate photos removed from the site — local only
trails/gpx/             onX GPX export (13 tracks)
scripts/
  build_site_data.py    regenerates site-data.js / photos.json / trails.json
  process_media.py      photo import & resize pipeline
```

## Regenerating data

After adding media or editing captions/day metadata (edit the constants at the
top of the script):

```
python3 scripts/build_site_data.py
```

## Notes

- Day/location assignments were verified against GPX timestamps (UTC−6).
- onX "markup" tracks carry sparse timestamps, so pace/duration are not shown;
  distance, elevation gain and profiles are computed from the trackpoints.
- Out-and-back pairs (Ink Pots, Wapta Falls) are merged into single hikes.
- Trip totals: 32.1 km on foot, 1,367 m of climbing, high point 2,128 m.
