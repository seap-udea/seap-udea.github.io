(function () {
  var OWNER = "seap-udea";
  var IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i;
  var COLUMNS_DEFAULT = 4;

  // Set tracking meta before site-analytics.js fires pageview.
  (function setGalleryTrackMeta() {
    try {
      var params = new URLSearchParams(window.location.search);
      var repo = (params.get("repo") || "").trim();
      if (repo && document.body) {
        document.body.dataset.trackPage = "gallery";
        document.body.dataset.trackId = repo;
        document.body.dataset.trackName = repo + " gallery";
      }
    } catch (e) {}
  })();

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  var toggle = document.getElementById("menu-toggle");
  var nav = document.getElementById("header-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var root = document.getElementById("gallery-root");
  var statusEl = document.getElementById("gallery-status");
  var lightbox = document.getElementById("gallery-lightbox");
  var lightboxImg = document.getElementById("lightbox-image");
  var lightboxCaption = document.getElementById("lightbox-caption");
  var lightboxClose = document.getElementById("lightbox-close");
  var fullscreenEl = document.getElementById("gallery-fullscreen");
  var fsImage = document.getElementById("fs-image");
  var fsCaption = document.getElementById("fs-caption");
  var fsCounter = document.getElementById("fs-counter");
  var fsClose = document.getElementById("fs-close");
  var fsPrev = document.getElementById("fs-prev");
  var fsNext = document.getElementById("fs-next");

  var state = {
    images: [],
    index: 0,
    showPreview: true,
    showGrid: true,
    columns: COLUMNS_DEFAULT,
    fitWidth: false,
    fullscreen: false,
    title: "",
    repoName: "",
    repoUrl: "",
    branch: "main",
    startWith: null,
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", !!isError);
    statusEl.hidden = !message;
  }

  /** Lenient JSON parse: strips trailing commas (common in hand-edited configs). */
  function parseGalleryJson(text) {
    var cleaned = String(text).replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(cleaned);
  }

  function queryRepo() {
    var params = new URLSearchParams(window.location.search);
    return (params.get("repo") || "").trim();
  }

  function queryId() {
    var params = new URLSearchParams(window.location.search);
    return (params.get("id") || "").trim();
  }

  function rawUrl(repo, branch, path) {
    return (
      "https://raw.githubusercontent.com/" +
      OWNER +
      "/" +
      encodeURIComponent(repo) +
      "/" +
      encodeURIComponent(branch) +
      "/" +
      path
        .split("/")
        .map(encodeURIComponent)
        .join("/")
    );
  }

  function apiUrl(path) {
    return "https://api.github.com/" + path.replace(/^\//, "");
  }

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) {
        var err = new Error("HTTP " + res.status + " for " + url);
        err.status = res.status;
        throw err;
      }
      return res.json();
    });
  }

  function fetchText(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) {
        var err = new Error("HTTP " + res.status + " for " + url);
        err.status = res.status;
        throw err;
      }
      return res.text();
    });
  }

  function findRepoMeta(repos, name) {
    var lower = name.toLowerCase();
    for (var i = 0; i < repos.length; i++) {
      if (repos[i] && String(repos[i].name).toLowerCase() === lower) {
        return repos[i];
      }
    }
    return null;
  }

  function normalizePath(path) {
    return String(path || "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
  }

  function basename(path) {
    var parts = String(path).split("/");
    return parts[parts.length - 1] || path;
  }

  function stemName(filename) {
    var name = String(filename || "");
    var dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(0, dot) : name;
  }

  /** Lightweight WebP preview produced by bin/seap-udea-gallery.sh */
  function previewPathFor(dirPath, filename) {
    return normalizePath(dirPath) + "/.gallery/" + stemName(filename) + ".webp";
  }

  function thumbSrc(img) {
    return (img && (img.previewUrl || img.url)) || "";
  }

  function loadDefaultBranch(repo) {
    return fetchJson(apiUrl("repos/" + OWNER + "/" + encodeURIComponent(repo))).then(
      function (data) {
        return data.default_branch || "main";
      }
    );
  }

  function loadGalleryConfig(repo, branch) {
    var url = rawUrl(repo, branch, ".seap-udea-gallery.json");
    return fetchText(url).then(parseGalleryJson);
  }

  function githubBlobUrl(repo, branch, path) {
    return (
      "https://github.com/" +
      OWNER +
      "/" +
      encodeURIComponent(repo) +
      "/blob/" +
      encodeURIComponent(branch) +
      "/" +
      String(path || "")
        .split("/")
        .map(encodeURIComponent)
        .join("/")
    );
  }

  function imageNameLinkHtml(img) {
    if (!img) return "";
    var href = img.githubUrl || img.url || "#";
    return (
      '<a href="' +
      escapeHtml(href) +
      '" target="_blank" rel="noopener noreferrer" title="' +
      escapeHtml(img.path || img.name) +
      '">' +
      escapeHtml(img.name) +
      "</a>"
    );
  }

  function setNameLink(el, img) {
    if (!el || !img) return;
    el.innerHTML = imageNameLinkHtml(img);
  }

  function loadImageList(repo, branch, path) {
    var clean = normalizePath(path);
    var url = apiUrl(
      "repos/" + OWNER + "/" + encodeURIComponent(repo) + "/contents/" + clean
    );
    return fetchJson(url).then(function (entries) {
      if (!Array.isArray(entries)) {
        throw new Error("Gallery path is not a directory: " + clean);
      }
      return entries
        .filter(function (entry) {
          return entry && entry.type === "file" && IMAGE_EXT.test(entry.name || "");
        })
        .sort(function (a, b) {
          return String(a.name).localeCompare(String(b.name), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        })
        .map(function (entry) {
          var filePath = entry.path || clean + "/" + entry.name;
          var previewPath = previewPathFor(clean, entry.name);
          return {
            name: entry.name,
            path: filePath,
            url:
              entry.download_url ||
              rawUrl(repo, branch, filePath),
            previewUrl: rawUrl(repo, branch, previewPath),
            githubUrl: githubBlobUrl(repo, branch, filePath),
          };
        });
    });
  }

  function openLightbox(index) {
    var img = state.images[index];
    if (!img || !lightbox) return;
    lightboxImg.src = img.url;
    lightboxImg.alt = img.name;
    setNameLink(lightboxCaption, img);
    lightbox.hidden = false;
    document.body.classList.add("gallery-lightbox-open");
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    lightboxImg.removeAttribute("src");
    document.body.classList.remove("gallery-lightbox-open");
  }

  function updateFullscreen() {
    if (!state.fullscreen || !fullscreenEl || !fsImage) return;
    var img = state.images[state.index];
    if (!img) return;
    fsImage.src = img.url;
    fsImage.alt = img.name;
    setNameLink(fsCaption, img);
    if (fsCounter) {
      fsCounter.textContent = state.index + 1 + " / " + state.images.length;
    }
  }

  function openFullscreen(index) {
    if (!fullscreenEl || !state.images.length) return;
    if (typeof index === "number") state.index = index;
    state.fullscreen = true;
    fullscreenEl.hidden = false;
    document.body.classList.add("gallery-fs-open");
    updateFullscreen();
    updatePreview();
    updateGridActive();
    if (fullscreenEl.requestFullscreen) {
      fullscreenEl.requestFullscreen().catch(function () {});
    } else if (fullscreenEl.webkitRequestFullscreen) {
      try {
        fullscreenEl.webkitRequestFullscreen();
      } catch (e) {}
    }
  }

  function closeFullscreen() {
    state.fullscreen = false;
    if (!fullscreenEl) return;
    fullscreenEl.hidden = true;
    if (fsImage) fsImage.removeAttribute("src");
    document.body.classList.remove("gallery-fs-open");
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(function () {});
    } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      try {
        document.webkitExitFullscreen();
      } catch (e) {}
    }
  }

  function downloadImage(img) {
    fetch(img.url)
      .then(function (res) {
        if (!res.ok) throw new Error("Download failed");
        return res.blob();
      })
      .then(function (blob) {
        var objectUrl = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = objectUrl;
        a.download = img.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      })
      .catch(function () {
        window.open(img.url, "_blank", "noopener,noreferrer");
      });
  }

  function resolveStartIndex(startWith, images) {
    if (startWith == null || startWith === "" || startWith === "null") return 0;
    if (typeof startWith === "number" && isFinite(startWith)) {
      var asNum = Math.floor(startWith);
      if (asNum >= 0 && asNum < images.length) return asNum;
      return 0;
    }
    var target = String(startWith).trim();
    var targetBase = basename(target);
    for (var i = 0; i < images.length; i++) {
      if (images[i].name === target || images[i].name === targetBase) return i;
      if (images[i].path === target) return i;
    }
    return 0;
  }

  function setIndex(next) {
    if (!state.images.length) return;
    var n = state.images.length;
    state.index = ((next % n) + n) % n;
    updatePreview();
    updateGridActive();
    updateFullscreen();
  }

  function applyFitWidth() {
    var stage = document.getElementById("gallery-preview-stage");
    var btn = document.getElementById("gallery-fit");
    if (stage) stage.classList.toggle("is-fit-width", !!state.fitWidth);
    if (btn) {
      btn.classList.toggle("is-active", !!state.fitWidth);
      btn.setAttribute("aria-pressed", state.fitWidth ? "true" : "false");
      btn.textContent = state.fitWidth ? "Normal size" : "Fit to width";
    }
  }

  function updatePreview() {
    var stage = document.getElementById("gallery-preview-stage");
    var counter = document.getElementById("gallery-counter");
    var nameEl = document.getElementById("gallery-preview-name");
    var imgEl = document.getElementById("gallery-preview-image");
    if (!stage || !imgEl) return;

    var img = state.images[state.index];
    if (!img) return;

    imgEl.src = img.url;
    imgEl.alt = img.name;
    if (nameEl) setNameLink(nameEl, img);
    if (counter) {
      counter.textContent = state.index + 1 + " / " + state.images.length;
    }

    var strip = document.getElementById("gallery-filmstrip");
    if (strip) {
      var thumb = strip.querySelector('[data-index="' + state.index + '"]');
      if (thumb) {
        var target =
          thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2;
        strip.scrollTo({
          left: Math.max(0, target),
          behavior: "smooth",
        });
      }
      strip.querySelectorAll(".gallery-filmstrip-item").forEach(function (el) {
        el.classList.toggle(
          "is-active",
          Number(el.getAttribute("data-index")) === state.index
        );
      });
    }
  }

  function updateGridActive() {
    var grid = document.getElementById("gallery-grid");
    if (!grid) return;
    grid.querySelectorAll(".gallery-grid-item").forEach(function (el) {
      el.classList.toggle(
        "is-active",
        Number(el.getAttribute("data-index")) === state.index
      );
    });
  }

  function renderHeader(repoMeta, config) {
    var abstract = (repoMeta && (repoMeta.abstract || repoMeta.description)) || "";
    var repoUrl =
      (repoMeta && repoMeta.url) ||
      "https://github.com/" + OWNER + "/" + encodeURIComponent(state.repoName);

    return (
      '<header class="gallery-hero">' +
      '<p class="gallery-eyebrow"><a href="' +
      escapeHtml(repoUrl) +
      '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(OWNER) +
      "/" +
      escapeHtml(state.repoName) +
      "</a></p>" +
      "<h1 class=\"gallery-repo-name\">" +
      escapeHtml(state.repoName) +
      "</h1>" +
      (abstract
        ? '<p class="gallery-abstract">' + escapeHtml(abstract) + "</p>"
        : "") +
      (config.title
        ? '<h2 class="gallery-title">' + escapeHtml(config.title) + "</h2>"
        : "") +
      '<p class="gallery-meta">' +
      '<span id="gallery-image-count"></span>' +
      (config.path
        ? ' · <code class="gallery-path">' +
          escapeHtml(normalizePath(config.path)) +
          "</code>"
        : "") +
      "</p>" +
      "</header>"
    );
  }

  function renderPreview() {
    if (!state.showPreview || !state.images.length) return "";

    var filmstrip = state.images
      .map(function (img, i) {
        return (
          '<button type="button" class="gallery-filmstrip-item' +
          (i === state.index ? " is-active" : "") +
          '" data-index="' +
          i +
          '" title="' +
          escapeHtml(img.name) +
          '">' +
          '<img src="' +
          escapeHtml(thumbSrc(img)) +
          '" data-fallback="' +
          escapeHtml(img.url) +
          '" alt="" loading="lazy" decoding="async">' +
          "</button>"
        );
      })
      .join("");

    return (
      '<section class="gallery-preview" aria-label="Image preview">' +
      '<div class="gallery-preview-toolbar">' +
      '<button type="button" class="gallery-nav-btn" id="gallery-prev" aria-label="Previous image">‹</button>' +
      '<span class="gallery-counter" id="gallery-counter"></span>' +
      '<button type="button" class="gallery-nav-btn" id="gallery-next" aria-label="Next image">›</button>' +
      '<span class="gallery-hint">Swipe or use ← → to browse</span>' +
      "</div>" +
      '<div class="gallery-preview-stage" id="gallery-preview-stage">' +
      '<img id="gallery-preview-image" alt="" decoding="async">' +
      '<div class="gallery-preview-actions">' +
      '<button type="button" class="gallery-action-btn" id="gallery-view" title="View large">View</button>' +
      '<button type="button" class="gallery-action-btn" id="gallery-download" title="Download">Download</button>' +
      '<button type="button" class="gallery-action-btn" id="gallery-fit" aria-pressed="false" title="Fit image to page width">Fit to width</button>' +
      '<button type="button" class="gallery-action-btn" id="gallery-fullscreen" title="Browse images in fullscreen">Fullscreen</button>' +
      "</div>" +
      '<p class="gallery-preview-name" id="gallery-preview-name"></p>' +
      "</div>" +
      '<div class="gallery-filmstrip" id="gallery-filmstrip" tabindex="0">' +
      filmstrip +
      "</div>" +
      "</section>"
    );
  }

  function renderGrid() {
    if (!state.showGrid || !state.images.length) return "";

    var cols = state.columns || COLUMNS_DEFAULT;
    var items = state.images
      .map(function (img, i) {
        return (
          '<button type="button" class="gallery-grid-item' +
          (i === state.index ? " is-active" : "") +
          '" data-index="' +
          i +
          '" title="' +
          escapeHtml(img.name) +
          '">' +
          '<span class="gallery-grid-thumb">' +
          '<img src="' +
          escapeHtml(thumbSrc(img)) +
          '" data-fallback="' +
          escapeHtml(img.url) +
          '" alt="' +
          escapeHtml(img.name) +
          '" loading="lazy" decoding="async">' +
          "</span>" +
          '<span class="gallery-grid-name">' +
          imageNameLinkHtml(img) +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    return (
      '<section class="gallery-grid-section" aria-label="Image grid">' +
      "<h2 class=\"gallery-section-heading\">All images</h2>" +
      '<div class="gallery-grid" id="gallery-grid" style="--gallery-cols:' +
      cols +
      '">' +
      items +
      "</div>" +
      "</section>"
    );
  }

  function bindThumbFallbacks(rootEl) {
    if (!rootEl) return;
    rootEl.addEventListener(
      "error",
      function (event) {
        var el = event.target;
        if (!el || el.tagName !== "IMG") return;
        var fallback = el.getAttribute("data-fallback");
        if (!fallback || el.getAttribute("data-fell-back") === "1") return;
        el.setAttribute("data-fell-back", "1");
        el.src = fallback;
      },
      true
    );
  }

  /**
   * Horizontal swipe navigation for touch screens.
   * Swipe left → next image; swipe right → previous image.
   */
  function bindSwipe(el, options) {
    if (!el) return;
    options = options || {};
    var threshold = options.threshold || 48;
    var maxVertical = options.maxVertical || 80;
    var startX = 0;
    var startY = 0;
    var tracking = false;

    el.addEventListener(
      "touchstart",
      function (event) {
        if (!event.touches || event.touches.length !== 1) return;
        if (event.target.closest("button, a, input, textarea, select")) return;
        tracking = true;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      },
      { passive: true }
    );

    el.addEventListener(
      "touchcancel",
      function () {
        tracking = false;
      },
      { passive: true }
    );

    el.addEventListener(
      "touchend",
      function (event) {
        if (!tracking) return;
        tracking = false;
        if (!event.changedTouches || !event.changedTouches.length) return;
        if (!state.images.length) return;

        var endX = event.changedTouches[0].clientX;
        var endY = event.changedTouches[0].clientY;
        var dx = endX - startX;
        var dy = endY - startY;

        if (Math.abs(dx) < threshold) return;
        if (Math.abs(dx) < Math.abs(dy)) return;
        if (Math.abs(dy) > maxVertical) return;

        if (dx < 0) setIndex(state.index + 1);
        else setIndex(state.index - 1);
      },
      { passive: true }
    );
  }

  function bindInteractions() {
    var prevBtn = document.getElementById("gallery-prev");
    var nextBtn = document.getElementById("gallery-next");
    var viewBtn = document.getElementById("gallery-view");
    var downloadBtn = document.getElementById("gallery-download");
    var fitBtn = document.getElementById("gallery-fit");
    var fullscreenBtn = document.getElementById("gallery-fullscreen");
    var strip = document.getElementById("gallery-filmstrip");
    var grid = document.getElementById("gallery-grid");
    var stage = document.getElementById("gallery-preview-stage");
    var fsStage = document.querySelector(".gallery-fs-stage");

    bindThumbFallbacks(strip);
    bindThumbFallbacks(grid);
    bindSwipe(stage);
    bindSwipe(fsStage);
    bindSwipe(fullscreenEl);
    bindSwipe(lightbox);

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        setIndex(state.index - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        setIndex(state.index + 1);
      });
    }
    if (viewBtn) {
      viewBtn.addEventListener("click", function () {
        openLightbox(state.index);
      });
    }
    if (downloadBtn) {
      downloadBtn.addEventListener("click", function () {
        var img = state.images[state.index];
        if (img) downloadImage(img);
      });
    }
    if (fitBtn) {
      fitBtn.addEventListener("click", function () {
        state.fitWidth = !state.fitWidth;
        applyFitWidth();
      });
    }
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", function () {
        openFullscreen(state.index);
      });
    }
    if (fsPrev) {
      fsPrev.addEventListener("click", function (event) {
        event.stopPropagation();
        setIndex(state.index - 1);
      });
    }
    if (fsNext) {
      fsNext.addEventListener("click", function (event) {
        event.stopPropagation();
        setIndex(state.index + 1);
      });
    }
    if (fsClose) {
      fsClose.addEventListener("click", function (event) {
        event.stopPropagation();
        closeFullscreen();
      });
    }
    if (strip) {
      strip.addEventListener("click", function (event) {
        var item = event.target.closest("[data-index]");
        if (!item) return;
        setIndex(Number(item.getAttribute("data-index")));
      });
    }
    if (grid) {
      grid.addEventListener("click", function (event) {
        if (event.target.closest("a")) return;
        var item = event.target.closest("[data-index]");
        if (!item) return;
        setIndex(Number(item.getAttribute("data-index")));
        var preview = document.querySelector(".gallery-preview");
        if (preview) {
          preview.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) {
        return;
      }
      if (event.key === "Escape") {
        if (state.fullscreen) {
          closeFullscreen();
          return;
        }
        closeLightbox();
        return;
      }
      if (!state.images.length) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex(state.index + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex(state.index - 1);
      }
    });

    document.addEventListener("fullscreenchange", function () {
      if (!document.fullscreenElement && state.fullscreen) {
        closeFullscreen();
      }
    });
    document.addEventListener("webkitfullscreenchange", function () {
      if (!document.webkitFullscreenElement && state.fullscreen) {
        closeFullscreen();
      }
    });

    if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
    if (lightbox) {
      lightbox.addEventListener("click", function (event) {
        if (event.target === lightbox) closeLightbox();
      });
    }
  }

  function render(repoMeta, config) {
    setStatus("");
    root.innerHTML =
      renderHeader(repoMeta, config) + renderPreview() + renderGrid();

    var countEl = document.getElementById("gallery-image-count");
    if (countEl) {
      countEl.textContent =
        state.images.length +
        (state.images.length === 1 ? " image" : " images");
    }

    bindInteractions();
    if (state.showPreview) {
      updatePreview();
      applyFitWidth();
    }
    updateGridActive();
  }

  function boot() {
    var repo = queryRepo();
    if (!repo) {
      setStatus(
        "Missing repository. Open this page as /gallery?repo=PRisma",
        true
      );
      return;
    }

    state.repoName = repo;
    setStatus("Loading gallery for " + OWNER + "/" + repo + "…");

    Promise.all([
      fetchJson("../repos.json").catch(function () {
        return [];
      }),
      loadDefaultBranch(repo),
    ])
      .then(function (results) {
        var repos = results[0] || [];
        var branch = results[1];
        var repoMeta = findRepoMeta(repos, repo);
        state.branch = branch;
        state.repoUrl =
          (repoMeta && repoMeta.url) ||
          "https://github.com/" + OWNER + "/" + repo;

        return loadGalleryConfig(repo, branch).then(function (configData) {
          var config = configData;
          if (Array.isArray(configData)) {
            var targetId = queryId();
            if (targetId) {
              config = null;
              for (var i = 0; i < configData.length; i++) {
                if (configData[i].id === targetId) {
                  config = configData[i];
                  break;
                }
              }
              if (!config) {
                throw new Error(
                  "Gallery ID \"" + targetId + "\" not found in .seap-udea-gallery.json."
                );
              }
            } else {
              config = configData[0];
            }
          }

          if (!config || !config.path) {
            throw new Error(
              "Invalid .seap-udea-gallery.json: missing required field \"path\"."
            );
          }

          var conf = config.configuration || {};
          state.showPreview = conf.preview !== false;
          state.showGrid = conf.grid !== false;
          state.columns =
            typeof conf.columns === "number" && conf.columns > 0
              ? conf.columns
              : COLUMNS_DEFAULT;
          state.title = config.title || "";
          // Prefer start_with; accept star_with typo for compatibility.
          state.startWith =
            config.start_with !== undefined
              ? config.start_with
              : config.star_with !== undefined
                ? config.star_with
                : conf.start_with !== undefined
                  ? conf.start_with
                  : null;

          if (!state.showPreview && !state.showGrid) {
            state.showPreview = true;
          }

          setStatus("Loading images from " + normalizePath(config.path) + "…");

          return loadImageList(repo, branch, config.path).then(function (images) {
            state.images = images;
            state.index = resolveStartIndex(state.startWith, images);
            if (!images.length) {
              setStatus(
                "No images found in " + normalizePath(config.path) + ".",
                true
              );
              root.innerHTML = renderHeader(repoMeta, config);
              return;
            }
            render(repoMeta, config);
          });
        });
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        if (err && err.status === 404) {
          msg =
            "Could not find .seap-udea-gallery.json (or the image path) in " +
            OWNER +
            "/" +
            repo +
            ".";
        }
        setStatus(msg, true);
      });
  }

  boot();
})();
