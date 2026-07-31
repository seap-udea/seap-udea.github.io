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
  var sections = ["about", "developer", "apps", "repositories", "forked", "papers", "contributors", "contact"]
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

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCommitDate(isoDate) {
    if (!isoDate) return "";
    var parts = String(isoDate).slice(0, 10).split("-");
    if (parts.length !== 3) return isoDate;
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var month = months[Number(parts[1]) - 1] || parts[1];
    return month + " " + Number(parts[2]) + ", " + parts[0];
  }

  function repoIconSvg() {
    return '<svg class="repo-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.5H2A1.5 1.5 0 0 1 2 2.5h10.5Z"></path></svg>';
  }

  function renderRepoCard(repo, options) {
    options = options || {};
    var abstract = repo.abstract || repo.description || "";
    var dateLabel = formatCommitDate(repo.last_commit);
    var badges = [];
    if (repo.private) badges.push('<span class="repo-badge">Private</span>');
    else badges.push('<span class="repo-badge">Public</span>');
    if (repo.type) badges.push('<span class="repo-type">' + escapeHtml(repo.type) + "</span>");

    var meta = [];
    if (dateLabel) meta.push('<span class="repo-updated">Updated ' + escapeHtml(dateLabel) + "</span>");
    if (typeof repo.stars === "number") meta.push("<span>★ " + repo.stars + "</span>");
    if (repo.pypi) {
      meta.push(
        '<a class="repo-pypi" href="' +
          escapeHtml(repo.pypi) +
          '" target="_blank" rel="noopener noreferrer">PyPI</a>'
      );
    }

    return (
      '<article class="repo-card">' +
        '<div class="repo-top">' +
          repoIconSvg() +
          '<a class="repo-name" href="' +
          escapeHtml(repo.url) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(repo.name) +
          "</a>" +
          '<span class="repo-badges">' +
          badges.join("") +
          "</span>" +
        "</div>" +
        (options.showFork && repo.parent
          ? '<p class="repo-fork-line">Forked from <a href="https://github.com/' +
            escapeHtml(repo.parent) +
            '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(repo.parent) +
            "</a></p>"
          : "") +
        '<p class="repo-desc">' +
        escapeHtml(abstract) +
        "</p>" +
        '<div class="repo-meta">' +
        meta.join("") +
        "</div>" +
      "</article>"
    );
  }

  function renderFeatured(repos) {
    var grid = document.getElementById("featured-repos");
    var countEl = document.getElementById("featured-count");
    if (!grid) return;

    var featured = (repos || []).filter(function (repo) {
      return repo && repo.featured === true;
    });

    if (countEl) countEl.textContent = String(featured.length);

    if (!featured.length) {
      grid.innerHTML = '<p class="repo-loading">No featured repositories yet.</p>';
      return;
    }

    grid.innerHTML = featured.map(function (repo) {
      return renderRepoCard(repo, { showFork: false });
    }).join("");
  }

  function renderForked(repos) {
    var grid = document.getElementById("forked-repos");
    var countEl = document.getElementById("forked-count");
    if (!grid) return;

    var forks = (repos || []).filter(function (repo) {
      return repo && repo.fork === true;
    });

    if (countEl) countEl.textContent = String(forks.length);

    if (!forks.length) {
      grid.innerHTML = '<p class="repo-loading">No forked repositories found.</p>';
      return;
    }

    grid.innerHTML = forks.map(function (repo) {
      return renderRepoCard(repo, { showFork: true });
    }).join("");
  }

  function renderPapers(papers) {
    var list = document.getElementById("papers-list");
    var countEl = document.getElementById("papers-count");
    if (!list) return;

    papers = papers || [];
    if (countEl) countEl.textContent = String(papers.length);

    if (!papers.length) {
      list.innerHTML = '<p class="repo-loading">No papers listed yet.</p>';
      return;
    }

    list.innerHTML = papers.map(function (paper) {
      var repos = (paper.repos || [])
        .map(function (name) {
          return (
            '<a class="paper-repo" href="https://github.com/seap-udea/' +
            encodeURIComponent(name) +
            '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(name) +
            "</a>"
          );
        })
        .join(" ");

      var metaBits = [];
      if (paper.authors) metaBits.push(escapeHtml(paper.authors));
      if (paper.year) metaBits.push(String(paper.year));
      if (paper.venue) metaBits.push(escapeHtml(paper.venue));
      if (paper.doi) metaBits.push("DOI: " + escapeHtml(paper.doi));
      else if (paper.arxiv) metaBits.push("arXiv:" + escapeHtml(paper.arxiv));

      return (
        '<article class="paper-card">' +
          '<h3 class="paper-title"><a href="' +
          escapeHtml(paper.url) +
          '" target="_blank" rel="noopener noreferrer">' +
          escapeHtml(paper.title) +
          "</a></h3>" +
          '<p class="paper-meta">' +
          metaBits.join(" · ") +
          "</p>" +
          (repos ? '<p class="paper-repos">Related repo: ' + repos + "</p>" : "") +
        "</article>"
      );
    }).join("");
  }

  Promise.all([
    fetch("repos.json").then(function (r) {
      if (!r.ok) throw new Error("repos.json");
      return r.json();
    }),
    fetch("papers.json").then(function (r) {
      if (!r.ok) throw new Error("papers.json");
      return r.json();
    }),
  ])
    .then(function (results) {
      renderFeatured(results[0]);
      renderForked(results[0]);
      renderPapers(results[1]);
    })
    .catch(function () {
      ["featured-repos", "forked-repos", "papers-list"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<p class="repo-loading">Could not load data.</p>';
      });
    });
})();
