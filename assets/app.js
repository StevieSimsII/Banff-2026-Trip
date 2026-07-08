/* Banff & Yoho '26 — cinematic scrollytelling engine */
(function () {
  "use strict";
  const D = window.SITE_DATA;
  const $ = (s, el) => (el || document).querySelector(s);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TILES = {
    topo: {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      opts: { maxZoom: 16, attribution: "© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)" },
    },
    sat: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      opts: { maxZoom: 17, attribution: "Esri, Maxar, Earthstar Geographics" },
    },
  };
  const TRAIL_COLORS = ["#57c4c9", "#d9a441", "#9fd8dc", "#e0876a", "#8fbf6b"];

  const pendingMaps = []; // hike minimaps awaiting lazy init

  /* reveal-on-scroll (declared early: galleries reference it) */
  const revealObs = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
  function observeReveals(root) {
    (root || document).querySelectorAll(".reveal:not(.in)").forEach((el) => revealObs.observe(el));
  }

  /* ---------------- nav + progress ---------------- */
  const navDays = $("#navDays");
  D.days.forEach((d) => {
    const a = document.createElement("a");
    a.href = "#day-" + d.n;
    a.innerHTML = d.n + ' <span class="nav-label">· ' + d.title.split("&")[0].trim() + "</span>";
    a.dataset.day = d.n;
    navDays.appendChild(a);
  });

  addEventListener("scroll", () => {
    const h = document.documentElement;
    $("#progressBar").style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100 + "%";
    $("#nav").classList.toggle("scrolled", h.scrollTop > 40);
  }, { passive: true });

  /* ---------------- stat band ---------------- */
  const t = D.totals;
  $("#statBand").innerHTML = [
    [t.days, "days"], [t.hikes, "trails hiked"], [t.distanceKm + " km", "on foot"],
    [t.gainM.toLocaleString() + " m", "climbed"], [t.maxEleM.toLocaleString() + " m", "high point"],
    [t.photos, "photos"], [t.videos, "films"],
  ].map(([v, l]) => `<div class="stat-cell"><b>${v}</b><span>${l}</span></div>`).join("");
  $("#footerStats").textContent =
    `${t.distanceKm} km hiked · ${t.gainM.toLocaleString()} m of elevation gain · ${t.photos} photographs · ${t.videos} films`;

  /* ---------------- chapters ---------------- */
  const story = $("#story");
  const lightboxList = []; // flat, in page order

  D.days.forEach((day) => {
    const media = D.media.filter((m) => m.day === day.n);
    const opener = D.media.find((m) => m.id === day.opener);
    const hikes = D.hikes.filter((h) => h.day === day.n);

    const sec = document.createElement("section");
    sec.className = "chapter";
    sec.id = "day-" + day.n;
    sec.dataset.day = day.n;

    sec.innerHTML = `
      <div class="chapter-opener">
        <div class="co-media"><img src="${opener.src}" alt="${esc(opener.caption)}" loading="lazy"></div>
        <div class="co-scrim"></div>
        <div class="co-day" aria-hidden="true">${"0" + day.n}</div>
        <div class="co-content">
          <p class="co-date">Day ${day.n} · ${day.date}</p>
          <h2 class="co-title">${day.title}</h2>
          <p class="co-sub">${day.sub}</p>
        </div>
      </div>
      <div class="chapter-body">
        <div class="chapter-inner">
          <p class="chapter-narrative reveal">${day.narrative}</p>
          ${hikes.length ? `<p class="section-kicker reveal" style="text-align:center">The Trails — Day ${day.n}</p><div class="hike-grid"></div>` : ""}
          <div class="gallery-zone"></div>
        </div>
      </div>`;
    story.appendChild(sec);

    if (!reduceMotion) enableParallax(sec.querySelector(".co-media"));

    if (hikes.length) {
      const grid = sec.querySelector(".hike-grid");
      hikes.forEach((h, i) => grid.appendChild(hikeCard(h, TRAIL_COLORS[i % TRAIL_COLORS.length])));
    }

    /* gallery grouped by stop, chronological */
    const zone = sec.querySelector(".gallery-zone");
    const stops = [];
    media.forEach((m) => {
      const last = stops[stops.length - 1];
      if (!last || last.name !== m.stop) stops.push({ name: m.stop, items: [m] });
      else last.items.push(m);
    });
    stops.forEach((stop) => {
      if (stops.length > 1) {
        const lbl = document.createElement("p");
        lbl.className = "stop-label reveal";
        lbl.textContent = stop.name;
        zone.appendChild(lbl);
      }
      zone.appendChild(buildGallery(stop.items));
    });
  });

  /* ---------------- justified gallery ---------------- */
  function buildGallery(items) {
    const wrap = document.createElement("div");
    wrap.className = "gallery";
    items.forEach((m) => (m._lb = lightboxList.push(m) - 1));

    function layout() {
      wrap.innerHTML = "";
      const W = wrap.clientWidth || story.clientWidth || 1100;
      const target = W < 640 ? 200 : W < 1000 ? 260 : 300;
      const gap = 6;
      let row = [], rowAR = 0;
      const flush = (last) => {
        if (!row.length) return;
        let h = (W - gap * (row.length - 1)) / rowAR;
        if (last && h > target * 1.25) h = target;
        const rowEl = document.createElement("div");
        rowEl.className = "g-row";
        row.forEach((m) => {
          const ar = Math.max(0.4, Math.min(2.6, m.w / m.h));
          const el = document.createElement("figure");
          el.className = "g-item reveal" + (m.type === "video" ? " is-video" : "");
          el.style.width = h * ar + "px";
          el.style.height = h + "px";
          const img = document.createElement("img");
          img.loading = "lazy";
          img.decoding = "async";
          img.alt = m.caption;
          img.src = m.type === "video" ? m.poster : m.thumb;
          img.onload = () => img.classList.add("loaded");
          if (img.complete) img.classList.add("loaded");
          el.appendChild(img);
          const cap = document.createElement("figcaption");
          cap.className = "g-cap";
          cap.textContent = (m.type === "video" ? "▶ " : "") + m.caption;
          el.appendChild(cap);
          el.addEventListener("click", () => openLightbox(m._lb));
          rowEl.appendChild(el);
        });
        wrap.appendChild(rowEl);
        row = []; rowAR = 0;
      };
      items.forEach((m) => {
        const ar = Math.max(0.4, Math.min(2.6, m.w / m.h));
        row.push(m); rowAR += ar;
        if ((W - gap * (row.length - 1)) / rowAR <= target) flush(false);
      });
      flush(true);
      observeReveals(wrap);
    }
    requestAnimationFrame(layout);
    let tmr;
    addEventListener("resize", () => { clearTimeout(tmr); tmr = setTimeout(layout, 180); });
    return wrap;
  }

  /* ---------------- hike cards ---------------- */
  function hikeCard(h, color) {
    const card = document.createElement("article");
    card.className = "hike-card reveal";
    card.innerHTML = `
      <div class="hike-map" id="map-${h.id}"></div>
      <div class="hike-info">
        <p class="hike-kind">${h.kind}${h.startLocal ? " · set off " + fmtTime(h.startLocal) : ""}</p>
        <h3 class="hike-name">${h.name}</h3>
        <p class="hike-blurb">${h.blurb}</p>
        <div class="hike-stats">
          <div class="hike-stat"><b>${h.distanceKm}</b><span>km</span></div>
          <div class="hike-stat"><b>+${h.gainM}</b><span>m gain</span></div>
          <div class="hike-stat"><b>${h.maxEleM.toLocaleString()}</b><span>m high point</span></div>
        </div>
        <div class="elev-wrap"></div>
      </div>`;
    card.querySelector(".elev-wrap").appendChild(elevProfile(h, color, card));
    pendingMaps.push({ el: card.querySelector(".hike-map"), hike: h, color, card });
    return card;
  }

  const mapObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      mapObserver.unobserve(e.target);
      const job = pendingMaps.find((j) => j.el === e.target);
      if (job) initMiniMap(job);
    });
  }, { rootMargin: "400px" });

  function initMiniMap({ el, hike, color, card }) {
    const map = L.map(el, {
      zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile,
    });
    L.tileLayer(TILES.topo.url, TILES.topo.opts).addTo(map);
    const latlngs = hike.coords;
    L.polyline(latlngs, { color: "#0a0d0c", weight: 6, opacity: 0.55 }).addTo(map);
    const line = L.polyline(latlngs, { color, weight: 3, opacity: 0.95 }).addTo(map);
    L.circleMarker(latlngs[0], { radius: 5, color: "#0a0d0c", weight: 1.5, fillColor: "#8fbf6b", fillOpacity: 1 }).addTo(map).bindTooltip("Start", { className: "trail-tip" });
    L.circleMarker(latlngs[latlngs.length - 1], { radius: 5, color: "#0a0d0c", weight: 1.5, fillColor: "#e0876a", fillOpacity: 1 }).addTo(map).bindTooltip("End", { className: "trail-tip" });
    map.fitBounds(L.latLngBounds(latlngs), { padding: [28, 28] });
    if (!reduceMotion) {
      line.setLatLngs([latlngs[0]]);
      let i = 1;
      const total = latlngs.length, dur = 1600, t0 = performance.now();
      (function step(now) {
        const k = Math.min(1, (now - t0) / dur);
        const upto = Math.max(1, Math.floor(k * total));
        if (upto > i) { line.setLatLngs(latlngs.slice(0, upto)); i = upto; }
        if (k < 1) requestAnimationFrame(step);
        else line.setLatLngs(latlngs);
      })(t0);
    }
    const probe = L.circleMarker(latlngs[0], { radius: 6, color: "#0a0d0c", weight: 1.5, fillColor: "#9fd8dc", opacity: 0, fillOpacity: 0 }).addTo(map);
    card._probe = { marker: probe, map };
  }

  /* ---------------- elevation profile (SVG) ---------------- */
  function elevProfile(h, color, card) {
    const W = 400, H = 84, padB = 14, padT = 6;
    const prof = h.profile;
    const xs = prof.map((p) => p[0]), ys = prof.map((p) => p[1]);
    const xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
    const ySpan = Math.max(30, yMax - yMin);
    const X = (d) => (d / xMax) * W;
    const Y = (e) => padT + (1 - (e - yMin) / ySpan) * (H - padT - padB);
    let path = "M" + X(xs[0]).toFixed(1) + " " + Y(ys[0]).toFixed(1);
    for (let i = 1; i < prof.length; i++) path += " L" + X(xs[i]).toFixed(1) + " " + Y(ys[i]).toFixed(1);
    const gid = "eg-" + h.id;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = `
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="0.45"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0.02"/>
      </linearGradient></defs>
      <path d="${path} L${W} ${H - padB} L0 ${H - padB} Z" fill="url(#${gid})"/>
      <path class="elev-line" d="${path}" style="stroke:${color}"/>
      <text class="elev-axis" x="2" y="${H - 2}">0 km</text>
      <text class="elev-axis" x="${W - 2}" y="${H - 2}" text-anchor="end">${xMax.toFixed(1)} km</text>
      <text class="elev-axis" x="2" y="${padT + 8}">${Math.round(yMax)} m</text>
      <circle class="elev-dot" r="4" cx="-10" cy="-10"></circle>
      <text class="elev-label" x="0" y="0"></text>`;
    const line = svg.querySelectorAll("path")[1];
    if (!reduceMotion) {
      const len = 1200;
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      new IntersectionObserver((es, o) => {
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          o.disconnect();
          line.style.transition = "stroke-dashoffset 1.8s cubic-bezier(0.22,1,0.36,1)";
          requestAnimationFrame(() => (line.style.strokeDashoffset = "0"));
        });
      }, { threshold: 0.4 }).observe(svg);
    }
    const dot = svg.querySelector(".elev-dot");
    const lbl = svg.querySelector(".elev-label");
    svg.addEventListener("pointermove", (ev) => {
      const r = svg.getBoundingClientRect();
      const fx = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      const km = fx * xMax;
      let idx = 0;
      while (idx < prof.length - 1 && prof[idx][0] < km) idx++;
      const cx = X(prof[idx][0]), cy = Y(prof[idx][1]);
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy);
      lbl.textContent = `${prof[idx][0].toFixed(1)} km · ${Math.round(prof[idx][1])} m`;
      lbl.setAttribute("x", Math.min(Math.max(cx + 8, 4), W - 100));
      lbl.setAttribute("y", Math.max(cy - 8, 12));
      if (card._probe) {
        const ci = Math.min(h.coords.length - 1, Math.round((idx / (prof.length - 1)) * (h.coords.length - 1)));
        card._probe.marker.setLatLng(h.coords[ci]);
        card._probe.marker.setStyle({ opacity: 1, fillOpacity: 1 });
      }
    });
    svg.addEventListener("pointerleave", () => {
      if (card._probe) card._probe.marker.setStyle({ opacity: 0, fillOpacity: 0 });
    });
    return svg;
  }

  /* ---------------- overview map ---------------- */
  function initOverview() {
    const map = L.map("overviewMap", { scrollWheelZoom: false });
    L.tileLayer(TILES.sat.url, TILES.sat.opts).addTo(map);
    L.tileLayer(TILES.topo.url, Object.assign({}, TILES.topo.opts, { opacity: 0.35 })).addTo(map);
    let bounds = null;
    D.hikes.forEach((h) => {
      const color = TRAIL_COLORS[(h.day - 1) % TRAIL_COLORS.length];
      L.polyline(h.coords, { color: "#0a0d0c", weight: 7, opacity: 0.5 }).addTo(map);
      const line = L.polyline(h.coords, { color, weight: 3.5, opacity: 0.95 }).addTo(map);
      line.bindTooltip(`<b>${h.name}</b> — Day ${h.day}<br>${h.distanceKm} km · +${h.gainM} m`, { className: "trail-tip", sticky: true });
      line.on("mouseover", () => line.setStyle({ weight: 6 }));
      line.on("mouseout", () => line.setStyle({ weight: 3.5 }));
      line.on("click", () => $("#day-" + h.day).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }));
      bounds = bounds ? bounds.extend(line.getBounds()) : L.latLngBounds(line.getBounds());
    });
    map.fitBounds(bounds, { padding: [40, 40] });
  }
  new IntersectionObserver((es, o) => {
    es.forEach((e) => { if (e.isIntersecting) { o.disconnect(); initOverview(); } });
  }, { rootMargin: "300px" }).observe($("#overviewMap"));

  /* ---------------- parallax ---------------- */
  function enableParallax(el) {
    const section = el.closest(".chapter-opener");
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = section.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      el.style.transform = `translateY(${k * -7}%)`;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------------- reveals + active nav ---------------- */
  observeReveals();
  document.querySelectorAll(".hike-map").forEach((el) => mapObserver.observe(el));

  const chapterObs = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      const n = e.target.dataset.day;
      navDays.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.day === n));
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll(".chapter").forEach((c) => chapterObs.observe(c));

  /* ---------------- lightbox ---------------- */
  const lb = $("#lightbox"), stage = $("#lbStage"), caption = $("#lbCaption");
  let lbIndex = -1;
  function openLightbox(i) {
    lbIndex = i;
    render();
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    stage.innerHTML = "";
  }
  function render() {
    const m = lightboxList[lbIndex];
    stage.innerHTML = "";
    if (m.type === "video") {
      const v = document.createElement("video");
      v.src = m.src; v.poster = m.poster; v.controls = true; v.autoplay = true; v.playsInline = true;
      stage.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.src = m.src; img.alt = m.caption;
      stage.appendChild(img);
    }
    const day = D.days[m.day - 1];
    caption.innerHTML = esc(m.caption) +
      `<span class="lb-meta">Day ${m.day} · ${day.date} · ${esc(m.stop)} · ${lbIndex + 1} / ${lightboxList.length}</span>`;
  }
  const step = (d) => { lbIndex = (lbIndex + d + lightboxList.length) % lightboxList.length; render(); };
  $("#lbClose").addEventListener("click", closeLightbox);
  $("#lbPrev").addEventListener("click", () => step(-1));
  $("#lbNext").addEventListener("click", () => step(1));
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  let sx = null;
  lb.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 48) step(dx > 0 ? -1 : 1);
    sx = null;
  }, { passive: true });

  /* ---------------- utils ---------------- */
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function fmtTime(hhmm) {
    const parts = hhmm.split(":").map(Number);
    const ap = parts[0] >= 12 ? "pm" : "am";
    return ((parts[0] % 12) || 12) + ":" + String(parts[1]).padStart(2, "0") + " " + ap;
  }
})();
