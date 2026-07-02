const TRAIL_FALLBACK = [
  {
    id: "takakkaw-falls",
    title: "Takakkaw Falls",
    day: "June 28",
    location: "Yoho National Park",
    caption: "The short approach toward the mist, cliffs, and scale of Takakkaw Falls.",
    gpx: "trails/gpx/onx-markups-07012026.gpx",
    trackName: "Takakkaw Falls",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Takakkaw%20Falls%20Yoho%20National%20Park",
    tags: ["waterfall", "landscape", "onx"],
  },
];

const trailGrid = document.querySelector("#trailGrid");
const gpxTextCache = new Map();

async function loadTrails() {
  if (Array.isArray(window.BANFF_TRAILS) && window.BANFF_TRAILS.length) {
    return window.BANFF_TRAILS;
  }

  try {
    const response = await fetch("data/trails.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load trails.json: ${response.status}`);
    }
    const trails = await response.json();
    return Array.isArray(trails) ? trails : TRAIL_FALLBACK;
  } catch (error) {
    console.info("Using built-in sample trails because trails.json could not be loaded.", error);
    return TRAIL_FALLBACK;
  }
}

function trailText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function radians(value) {
  return (value * Math.PI) / 180;
}

function metersBetween(a, b) {
  const earthRadius = 6371000;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function gpxElements(parent, localName) {
  return [
    ...parent.getElementsByTagName(localName),
    ...parent.getElementsByTagNameNS("*", localName),
  ].filter((element, index, elements) => elements.indexOf(element) === index);
}

function directChildText(parent, localName) {
  const child = [...parent.children].find((element) => element.localName === localName);
  return child?.textContent?.trim() || "";
}

function parseGpxPoint(node) {
  const lat = Number(node.getAttribute("lat"));
  const lon = Number(node.getAttribute("lon"));
  const ele = Number(directChildText(node, "ele"));
  const timeText = directChildText(node, "time");
  return {
    lat,
    lon,
    ele: Number.isFinite(ele) ? ele : null,
    time: timeText ? new Date(timeText) : null,
  };
}

function matchTrackByName(tracks, trackName) {
  const requested = trailText(trackName).toLowerCase();
  if (!requested) {
    return tracks[0] || null;
  }

  return (
    tracks.find((track) => directChildText(track, "name").toLowerCase() === requested) ||
    tracks.find((track) => directChildText(track, "name").toLowerCase().includes(requested)) ||
    null
  );
}

function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters <= 0) {
    return "Pending";
  }
  const miles = meters / 1609.344;
  return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
}

function formatElevation(meters) {
  if (!Number.isFinite(meters) || meters <= 0) {
    return "Pending";
  }
  return `${Math.round(meters * 3.28084).toLocaleString()} ft`;
}

function formatDuration(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) {
    return "Pending";
  }
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (!minutes) {
    return "Pending";
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function parseGpx(xmlText, trackName = "") {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid GPX XML");
  }

  const tracks = gpxElements(doc, "trk");
  const track = matchTrackByName(tracks, trackName);
  if (trailText(trackName) && tracks.length && !track) {
    throw new Error(`GPX track not found: ${trackName}`);
  }
  const nodes = track
    ? gpxElements(track, "trkpt")
    : [...gpxElements(doc, "trkpt"), ...gpxElements(doc, "rtept")];
  const points = nodes
    .map(parseGpxPoint)
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));

  if (points.length < 2) {
    throw new Error(`GPX track does not contain enough route points: ${trackName || "first available route"}`);
  }

  return points;
}

function summarizeRoute(points) {
  let distance = 0;
  let elevationGain = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    distance += metersBetween(previous, current);

    if (previous.ele !== null && current.ele !== null) {
      const gain = current.ele - previous.ele;
      if (gain > 1) {
        elevationGain += gain;
      }
    }
  }

  const timedPoints = points.filter(
    (point) => point.time instanceof Date && !Number.isNaN(point.time.getTime()),
  );
  return {
    distance,
    elevationGain,
    duration: timedPoints.length >= 2 ? formatDuration(timedPoints[0].time, timedPoints.at(-1).time) : "Pending",
    points: points.length,
  };
}

function buildRoutePath(points) {
  const sampleStep = Math.max(1, Math.ceil(points.length / 480));
  const sampled = points.filter((_, index) => index % sampleStep === 0);
  const lats = sampled.map((point) => point.lat);
  const lons = sampled.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latSpan = maxLat - minLat || 0.001;
  const lonSpan = maxLon - minLon || 0.001;
  const pad = 18;
  const width = 320 - pad * 2;
  const height = 210 - pad * 2;

  const coordinates = sampled.map((point) => {
    const x = pad + ((point.lon - minLon) / lonSpan) * width;
    const y = pad + (1 - (point.lat - minLat) / latSpan) * height;
    return { x, y };
  });

  return {
    line: coordinates.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
    start: coordinates[0],
    end: coordinates.at(-1),
  };
}

function createStat(label, value) {
  const item = document.createElement("div");
  item.className = "trail-stat";
  const statValue = document.createElement("strong");
  statValue.textContent = value;
  const statLabel = document.createElement("span");
  statLabel.textContent = label;
  item.append(statValue, statLabel);
  return item;
}

function renderPlaceholderRoute(svg) {
  svg.innerHTML = `
    <path class="route-grid-line" d="M34 48 H286 M34 104 H286 M34 160 H286" />
    <path class="route-grid-line" d="M72 24 V186 M160 24 V186 M248 24 V186" />
    <path class="route-placeholder-line" d="M45 160 C74 104 98 134 121 92 S174 45 203 76 239 151 279 58" />
    <circle class="route-point route-start" cx="45" cy="160" r="5" />
    <circle class="route-point route-end" cx="279" cy="58" r="5" />
  `;
}

function renderRoute(svg, points) {
  const route = buildRoutePath(points);
  svg.innerHTML = `
    <path class="route-grid-line" d="M34 48 H286 M34 104 H286 M34 160 H286" />
    <path class="route-grid-line" d="M72 24 V186 M160 24 V186 M248 24 V186" />
    <polyline class="route-line" points="${route.line}" />
    <circle class="route-point route-start" cx="${route.start.x.toFixed(1)}" cy="${route.start.y.toFixed(1)}" r="5" />
    <circle class="route-point route-end" cx="${route.end.x.toFixed(1)}" cy="${route.end.y.toFixed(1)}" r="5" />
  `;
}

function createTrailCard(trail) {
  const card = document.createElement("article");
  card.className = "trail-card";

  const visual = document.createElement("div");
  visual.className = "trail-card__visual";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 320 210");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${trailText(trail.title, "Trail")} route preview`);
  renderPlaceholderRoute(svg);
  visual.append(svg);

  const body = document.createElement("div");
  body.className = "trail-card__body";

  const meta = document.createElement("p");
  meta.className = "trail-meta";
  meta.textContent = `${trailText(trail.day, "Trip")} / ${trailText(trail.location, "Canadian Rockies")}`;

  const title = document.createElement("h3");
  title.textContent = trailText(trail.title, "Trail Log");

  const caption = document.createElement("p");
  caption.textContent = trailText(trail.caption, "Trail notes coming soon.");

  const stats = document.createElement("div");
  stats.className = "trail-stats";
  stats.append(
    createStat("Distance", "Pending"),
    createStat("Gain", "Pending"),
    createStat("Time", "Pending"),
  );

  const tags = document.createElement("div");
  tags.className = "photo-meta";
  (Array.isArray(trail.tags) ? trail.tags : ["onx"]).forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = tag;
    tags.append(chip);
  });

  const actions = document.createElement("div");
  actions.className = "trail-actions";
  if (trail.mapUrl) {
    const mapLink = document.createElement("a");
    mapLink.className = "trail-link";
    mapLink.href = trail.mapUrl;
    mapLink.target = "_blank";
    mapLink.rel = "noreferrer";
    mapLink.textContent = "Open Area Map";
    actions.append(mapLink);
  }

  body.append(meta, title, caption, stats, tags, actions);
  card.append(visual, body);

  if (trail.gpx) {
    loadGpxIntoCard(trail, card, svg, stats, actions);
  }

  return card;
}

async function loadGpxIntoCard(trail, card, svg, stats, actions) {
  try {
    const text = await loadGpxText(trail.gpx);
    const points = parseGpx(text, trail.trackName);
    const summary = summarizeRoute(points);
    renderRoute(svg, points);
    card.classList.add("has-route");

    stats.innerHTML = "";
    stats.append(
      createStat("Distance", formatDistance(summary.distance)),
      createStat("Gain", formatElevation(summary.elevationGain)),
      createStat("Time", summary.duration),
    );

    const download = document.createElement("a");
    download.className = "trail-link";
    download.href = trail.gpx;
    download.download = "";
    download.textContent = "Download GPX";
    actions.append(download);
  } catch (error) {
    card.classList.add("route-pending");
    console.info(`Trail route pending for ${trail.id || trail.title}`, error);
  }
}

async function loadGpxText(path) {
  if (!gpxTextCache.has(path)) {
    gpxTextCache.set(
      path,
      fetch(path).then((response) => {
        if (!response.ok) {
          throw new Error(`GPX not found: ${response.status}`);
        }
        return response.text();
      }),
    );
  }

  return gpxTextCache.get(path);
}

function renderTrails(trails) {
  if (!trailGrid) {
    return;
  }

  trailGrid.innerHTML = "";
  if (!trails.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Trail logs coming soon.";
    trailGrid.append(empty);
    return;
  }

  trails.forEach((trail) => trailGrid.append(createTrailCard(trail)));
}

loadTrails().then(renderTrails);
