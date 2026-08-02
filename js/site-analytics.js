import { trackEvent, trackPageView } from "./visitor-tracker.js";

function readBodyMeta() {
  const body = document.body;
  return {
    page: body?.dataset?.trackPage || "",
    id: body?.dataset?.trackId || "",
    name: body?.dataset?.trackName || "",
  };
}

function initPageView() {
  const { page, id, name } = readBodyMeta();
  if (page === "home") {
    trackPageView("home");
    return;
  }
  if (page === "gallery") {
    trackEvent("gallery_page_view", {
      galleryId: id,
      galleryName: name || id || "gallery",
      repo: id || "",
    });
  }
}

function initClickTracking() {
  document.addEventListener(
    "click",
    (event) => {
      const el = event.target.closest("[data-track]");
      if (!el) return;

      const eventType = el.dataset.track;
      if (!eventType) return;

      trackEvent(eventType, {
        targetId: el.dataset.trackId || "",
        targetName: el.dataset.trackName || "",
        href: el.getAttribute("href") || "",
        label: (el.textContent || "").trim().slice(0, 120),
      });
    },
    true,
  );
}

function boot() {
  initPageView();
  initClickTracking();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
