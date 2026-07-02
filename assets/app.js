const FALLBACK_MEDIA = [
  {
    id: "moraine-lake-01",
    title: "Moraine Lake Morning",
    day: "Day 2",
    location: "Moraine Lake",
    src: "media/optimized/moraine-lake-01.jpg",
    thumb: "media/thumbs/moraine-lake-01.jpg",
    caption: "Early morning views at Moraine Lake.",
    tags: ["lake", "mountains", "highlight"],
    featured: true,
    type: "image",
  },
  {
    id: "lake-louise-01",
    title: "Lake Louise Shoreline",
    day: "Day 2",
    location: "Lake Louise",
    src: "media/optimized/lake-louise-01.jpg",
    thumb: "media/thumbs/lake-louise-01.jpg",
    caption: "Glacier water and classic Lake Louise views.",
    tags: ["lake", "landscape", "highlight"],
    featured: true,
    type: "image",
  },
  {
    id: "banff-gondola-01",
    title: "Sulphur Mountain Lookout",
    day: "Day 3",
    location: "Banff Gondola",
    src: "media/optimized/banff-gondola-01.jpg",
    thumb: "media/thumbs/banff-gondola-01.jpg",
    caption: "Views from the boardwalk above Banff.",
    tags: ["landscape", "mountains"],
    featured: true,
    type: "image",
  },
  {
    id: "johnston-canyon-01",
    title: "Johnston Canyon Falls",
    day: "Day 3",
    location: "Johnston Canyon",
    src: "media/optimized/johnston-canyon-01.jpg",
    thumb: "media/thumbs/johnston-canyon-01.jpg",
    caption: "Mist, canyon walls, and waterfall trails.",
    tags: ["waterfall", "landscape"],
    featured: false,
    type: "image",
  },
  {
    id: "canmore-town-01",
    title: "Canmore Evening",
    day: "Day 3",
    location: "Canmore",
    src: "media/optimized/canmore-town-01.jpg",
    thumb: "media/thumbs/canmore-town-01.jpg",
    caption: "A relaxed mountain town stop after a full day out.",
    tags: ["town", "food", "family"],
    featured: false,
    type: "image",
  },
  {
    id: "yoho-park-01",
    title: "Yoho Valley Views",
    day: "Day 4",
    location: "Yoho National Park",
    src: "media/optimized/yoho-park-01.jpg",
    thumb: "media/thumbs/yoho-park-01.jpg",
    caption: "A scenic day across the British Columbia side of the Rockies.",
    tags: ["landscape", "mountains"],
    featured: false,
    type: "image",
  },
  {
    id: "wapta-falls-01",
    title: "Wapta Falls Trail",
    day: "Day 5",
    location: "Wapta Falls",
    src: "media/optimized/wapta-falls-01.jpg",
    thumb: "media/thumbs/wapta-falls-01.jpg",
    caption: "A big waterfall finish for the final exploring day.",
    tags: ["waterfall", "highlight"],
    featured: true,
    type: "image",
  },
  {
    id: "takakkaw-falls-01",
    title: "Takakkaw Falls",
    day: "Day 5",
    location: "Takakkaw Falls",
    src: "media/optimized/takakkaw-falls-01.jpg",
    thumb: "media/thumbs/takakkaw-falls-01.jpg",
    caption: "Standing near one of Yoho's most dramatic falls.",
    tags: ["waterfall", "landscape"],
    featured: false,
    type: "image",
  },
  {
    id: "full-trip-album",
    title: "Full Trip Album",
    day: "All Days",
    location: "Google Photos",
    externalUrl: "https://photos.app.goo.gl/TDwcVwiQXMaVxXPSA",
    caption: "The full Google Photos archive for the trip.",
    tags: ["video", "highlight"],
    featured: false,
    type: "video",
  },
];

const TAGS = ["highlight", "family", "landscape", "waterfall", "lake", "town", "food", "video"];

const state = {
  media: [],
  activeTag: "all",
};

const featuredGrid = document.querySelector("#featuredGrid");
const galleryGroups = document.querySelector("#galleryGroups");
const tagFilter = document.querySelector("#tagFilter");
const videoGrid = document.querySelector("#videoGrid");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxFallback = document.querySelector("#lightboxFallback");
const lightboxMeta = document.querySelector("#lightboxMeta");
const lightboxTitle = document.querySelector("#lightboxTitle");
const lightboxCaption = document.querySelector("#lightboxCaption");
const lightboxTags = document.querySelector("#lightboxTags");

async function loadMedia() {
  try {
    const response = await fetch("data/photos.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load photos.json: ${response.status}`);
    }
    const media = await response.json();
    return Array.isArray(media) ? media : FALLBACK_MEDIA;
  } catch (error) {
    console.info("Using built-in sample media. This is normal when opening index.html directly.", error);
    return FALLBACK_MEDIA;
  }
}

function normalizeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeTags(tags) {
  return Array.isArray(tags)
    ? tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
    : [];
}

function getImages() {
  return state.media.filter((item) => (item.type || "image") === "image");
}

function getVideos() {
  return state.media.filter((item) => item.type === "video");
}

function createChip(tag) {
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.textContent = tag;
  return chip;
}

function createImageCard(item, options = {}) {
  const card = document.createElement("article");
  card.className = "photo-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${normalizeText(item.title, "photo")}`);

  const visual = document.createElement("div");
  visual.className = "photo-card__visual";

  const image = document.createElement("img");
  image.loading = "lazy";
  image.src = item.thumb || item.src || "";
  image.alt = normalizeText(item.caption, normalizeText(item.title, "Banff trip photo"));
  image.addEventListener("error", () => {
    card.classList.add("image-missing");
    image.remove();
  });

  const fallback = document.createElement("div");
  fallback.className = "media-fallback";
  fallback.textContent = `${normalizeText(item.location, "Banff")} photo placeholder`;

  visual.append(image, fallback);

  const body = document.createElement("div");
  body.className = "photo-card__body";
  const title = document.createElement("h3");
  title.textContent = normalizeText(item.title, "Untitled Moment");
  const caption = document.createElement("p");
  caption.textContent = normalizeText(item.caption, "Caption coming soon.");

  const meta = document.createElement("div");
  meta.className = "photo-meta";
  meta.append(createChip(normalizeText(item.day, "Trip")));
  meta.append(createChip(normalizeText(item.location, "Canadian Rockies")));

  if (options.showTags) {
    normalizeTags(item.tags)
      .slice(0, 3)
      .forEach((tag) => meta.append(createChip(tag)));
  }

  body.append(title, caption, meta);
  card.append(visual, body);

  card.addEventListener("click", () => openLightbox(item));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLightbox(item);
    }
  });

  return card;
}

function createPlaceholderCard(title, caption) {
  return createImageCard(
    {
      title,
      day: "Soon",
      location: "Banff",
      caption,
      tags: ["highlight"],
      type: "image",
    },
    { showTags: true },
  );
}

function renderFeatured() {
  featuredGrid.innerHTML = "";
  const featured = getImages().filter((item) => item.featured).slice(0, 6);

  if (!featured.length) {
    [
      ["Favorite lake view", "A future hero from Moraine Lake or Lake Louise."],
      ["Best family moment", "A shared memory from the week in the Rockies."],
      ["Waterfall stop", "A dramatic canyon or Yoho waterfall photo."],
    ].forEach(([title, caption]) => featuredGrid.append(createPlaceholderCard(title, caption)));
    return;
  }

  featured.forEach((item) => featuredGrid.append(createImageCard(item, { showTags: true })));
}

function renderTagFilter() {
  tagFilter.innerHTML = "";
  ["all", ...TAGS].forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tag === "all" ? "All" : tag;
    button.classList.toggle("is-active", state.activeTag === tag);
    button.addEventListener("click", () => {
      state.activeTag = tag;
      renderTagFilter();
      renderGallery();
    });
    tagFilter.append(button);
  });
}

function groupImages(images) {
  return images.reduce((groups, item) => {
    const day = normalizeText(item.day, "Trip");
    const location = normalizeText(item.location, "Canadian Rockies");
    const key = `${day} | ${location}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
    return groups;
  }, new Map());
}

function renderGallery() {
  galleryGroups.innerHTML = "";
  const images = getImages().filter((item) => {
    if (state.activeTag === "all") {
      return true;
    }
    return normalizeTags(item.tags).includes(state.activeTag);
  });

  if (!images.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No photos match this tag yet.";
    galleryGroups.append(empty);
    return;
  }

  groupImages(images).forEach((items, label) => {
    const group = document.createElement("section");
    group.className = "gallery-group";
    const heading = document.createElement("h3");
    heading.textContent = label;
    const grid = document.createElement("div");
    grid.className = "gallery-grid";
    items.forEach((item) => grid.append(createImageCard(item, { showTags: true })));
    group.append(heading, grid);
    galleryGroups.append(group);
  });
}

function renderVideos() {
  videoGrid.innerHTML = "";
  const videos = getVideos();

  if (!videos.length) {
    const card = document.createElement("article");
    card.className = "video-card";
    card.innerHTML = `
      <div class="video-card__visual video-missing">
        <div class="media-fallback">Video placeholder</div>
      </div>
      <div class="video-card__body">
        <h3>Trip clips coming soon</h3>
        <p>Add selected clips to media/videos or add external video links in data/photos.json.</p>
      </div>
    `;
    videoGrid.append(card);
    return;
  }

  videos.forEach((item) => {
    const card = document.createElement("article");
    card.className = "video-card";

    const visual = document.createElement("div");
    visual.className = "video-card__visual";

    if (item.src) {
      const video = document.createElement("video");
      video.controls = true;
      video.preload = "metadata";
      video.src = item.src;
      if (item.thumb) {
        video.poster = item.thumb;
      }
      visual.append(video);
    } else {
      visual.classList.add("video-missing");
      const fallback = document.createElement("div");
      fallback.className = "media-fallback";
      fallback.textContent = `${normalizeText(item.location, "Trip")} video link`;
      visual.append(fallback);
    }

    const body = document.createElement("div");
    body.className = "video-card__body";
    const title = document.createElement("h3");
    title.textContent = normalizeText(item.title, "Trip Video");
    const caption = document.createElement("p");
    caption.textContent = normalizeText(item.caption, "Video memory from the Banff trip.");
    body.append(title, caption);

    if (item.externalUrl) {
      const link = document.createElement("a");
      link.className = "button";
      link.href = item.externalUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Open Video Link";
      body.append(link);
    }

    card.append(visual, body);
    videoGrid.append(card);
  });
}

function openLightbox(item) {
  lightboxImage.src = item.src || item.thumb || "";
  lightboxImage.alt = normalizeText(item.caption, normalizeText(item.title, "Banff trip photo"));
  lightboxFallback.textContent = `${normalizeText(item.location, "Banff")} photo placeholder`;
  lightboxFallback.classList.remove("is-visible");
  lightboxImage.hidden = false;
  lightboxImage.onerror = () => {
    lightboxImage.hidden = true;
    lightboxFallback.classList.add("is-visible");
  };

  lightboxMeta.textContent = `${normalizeText(item.day, "Trip")} / ${normalizeText(
    item.location,
    "Canadian Rockies",
  )}`;
  lightboxTitle.textContent = normalizeText(item.title, "Untitled Moment");
  lightboxCaption.textContent = normalizeText(item.caption, "Caption coming soon.");
  lightboxTags.innerHTML = "";
  normalizeTags(item.tags).forEach((tag) => lightboxTags.append(createChip(tag)));

  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  document.querySelector(".lightbox-close").focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.removeAttribute("src");
  document.body.classList.remove("lightbox-open");
}

document.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lightbox.hidden) {
    closeLightbox();
  }
});

loadMedia().then((media) => {
  state.media = media;
  renderFeatured();
  renderTagFilter();
  renderGallery();
  renderVideos();
});
