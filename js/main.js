(function () {
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  var toggle = document.getElementById("menu-toggle");
  var nav = document.getElementById("header-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var links = document.querySelectorAll(".nav-link");
  var sections = ["about", "repositories", "contributors", "contact"]
    .map(function (id) {
      return document.getElementById(id);
    })
    .filter(Boolean);

  function setActive() {
    var scrollY = window.scrollY + 100;
    var current = sections[0] && sections[0].id;

    sections.forEach(function (section) {
      if (section.offsetTop <= scrollY) {
        current = section.id;
      }
    });

    links.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      link.classList.toggle("active", href === "#" + current);
    });
  }

  window.addEventListener("scroll", setActive, { passive: true });
  setActive();
})();
