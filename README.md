# Banff & Yoho — June 2026

A cinematic, scrollytelling photo journal of five days in the Canadian Rockies,
built as a static site for GitHub Pages. No build step, no framework — open
`index.html` or push to Pages and it works.

**Live experience:** full-bleed hero, day-by-day chapters with parallax openers,
justified photo galleries with lightbox, inline films, and for every hike an
interactive topo map (Leaflet + onX GPS tracks) with an animated, hover-synced
elevation profile.

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
