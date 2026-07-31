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
  var sectionIds = [
    "about",
    "developer",
    "apps",
    "repositories",
    "forked",
    "papers",
    "contributors",
    "contact",
  ];
  var sections = sectionIds
    .map(function (id) {
      return document.getElementById(id);
    })
    .filter(Boolean);

  function setActiveFromId(id) {
    links.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      link.classList.toggle("active", href === "#" + id);
    });
  }

  function setActive() {
    if (!sections.length) return;

    var marker = window.scrollY + Math.min(140, window.innerHeight * 0.25);
    var current = sections[0].id;
    var docBottom = window.scrollY + window.innerHeight;
    var pageBottom = document.documentElement.scrollHeight;

    // Near the end of the page: prefer the last section(s) so Contact / Contributors activate.
    if (docBottom >= pageBottom - 4) {
      current = sections[sections.length - 1].id;
    } else {
      sections.forEach(function (section) {
        var top = section.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) current = section.id;
      });
    }

    setActiveFromId(current);
  }

  links.forEach(function (link) {
    link.addEventListener("click", function () {
      var href = link.getAttribute("href") || "";
      if (href.charAt(0) === "#") {
        setActiveFromId(href.slice(1));
      }
    });
  });

  window.addEventListener("scroll", setActive, { passive: true });
  window.addEventListener("resize", setActive, { passive: true });
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

  var TYPE_EMOJI = {
    book: "📚",
    package: "📦",
    utilities: "🚙",
    data: "🔢",
    paper: "🔭",
  };

  function typeEmoji(type) {
    return TYPE_EMOJI[type] || "";
  }

  function repoIconSvg() {
    return '<svg class="repo-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.5H2A1.5 1.5 0 0 1 2 2.5h10.5Z"></path></svg>';
  }

  function renderRepoCard(repo, options) {
    options = options || {};
    var abstract = repo.abstract || repo.description || "";
    var dateLabel = formatCommitDate(repo.last_commit);
    var emoji = typeEmoji(repo.type);
    var badges = [];
    if (repo.private) badges.push('<span class="repo-badge">Private</span>');
    else badges.push('<span class="repo-badge">Public</span>');
    if (repo.type) {
      badges.push(
        '<span class="repo-type">' +
          (emoji ? '<span class="repo-type-emoji" aria-hidden="true">' + emoji + "</span> " : "") +
          escapeHtml(repo.type) +
          "</span>"
      );
    }

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
          (emoji
            ? '<span class="repo-emoji" title="' + escapeHtml(repo.type) + '" aria-hidden="true">' + emoji + "</span>"
            : repoIconSvg()) +
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

  function isVisible(repo) {
    return repo && !repo.hidden;
  }

  function renderFeatured(repos) {
    var grid = document.getElementById("featured-repos");
    var countEl = document.getElementById("featured-count");
    if (!grid) return;

    var featured = (repos || []).filter(function (repo) {
      return isVisible(repo) && repo.featured === true;
    });

    if (countEl) countEl.textContent = String(featured.length);

    if (!featured.length) {
      grid.innerHTML = '<p class="repo-loading">No featured repositories yet.</p>';
      return;
    }

    grid.innerHTML = featured
      .map(function (repo) {
        return renderRepoCard(repo, { showFork: false });
      })
      .join("");
  }

  function renderForked(repos) {
    var grid = document.getElementById("forked-repos");
    var countEl = document.getElementById("forked-count");
    if (!grid) return;

    var forks = (repos || []).filter(function (repo) {
      return isVisible(repo) && repo.fork === true;
    });

    if (countEl) countEl.textContent = String(forks.length);

    if (!forks.length) {
      grid.innerHTML = '<p class="repo-loading">No forked repositories found.</p>';
      return;
    }

    grid.innerHTML = forks
      .map(function (repo) {
        return renderRepoCard(repo, { showFork: true });
      })
      .join("");
  }

  function kindLabel(kind) {
    if (kind === "software") return "Software citation";
    if (kind === "preprint") return "Preprint";
    if (kind === "submitted") return "Submitted";
    if (kind === "in-preparation") return "In preparation";
    if (kind === "article") return "Article";
    return kind ? String(kind) : "";
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

    list.innerHTML = papers
      .map(function (paper) {
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
        var label = kindLabel(paper.kind);
        if (label) metaBits.push('<span class="paper-kind">' + escapeHtml(label) + "</span>");
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
      })
      .join("");
  }

  function parentOwner(parent) {
    if (!parent) return null;
    var parts = String(parent).split("/");
    return parts[0] || null;
  }

  function renderCollaborations(repos) {
    var grid = document.getElementById("collaborations-grid");
    if (!grid) return;

    var owners = {};
    (repos || []).forEach(function (repo) {
      if (!isVisible(repo) || !repo.fork || !repo.parent) return;
      var login = parentOwner(repo.parent);
      if (!login) return;
      if (!owners[login]) {
        owners[login] = { login: login, repos: [] };
      }
      owners[login].repos.push(repo);
    });

    var list = Object.keys(owners)
      .sort(function (a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      })
      .map(function (login) {
        return owners[login];
      });

    if (!list.length) {
      grid.innerHTML = "";
      return;
    }

    grid.innerHTML = list
      .map(function (owner) {
        var repoLinks = owner.repos
          .map(function (repo) {
            return (
              '<a href="' +
              escapeHtml(repo.url) +
              '" target="_blank" rel="noopener noreferrer">' +
              escapeHtml(repo.name) +
              "</a>"
            );
          })
          .join(", ");

        return (
          '<div class="contrib-card">' +
            '<a class="contrib-identity" href="https://github.com/' +
            encodeURIComponent(owner.login) +
            '" target="_blank" rel="noopener noreferrer">' +
              '<img class="contrib-avatar" src="https://github.com/' +
              encodeURIComponent(owner.login) +
              '.png?size=80" alt="" width="40" height="40">' +
              '<div class="contrib-info">' +
                '<div class="contrib-name">@' +
                escapeHtml(owner.login) +
                "</div>" +
              "</div>" +
            "</a>" +
            '<div class="contrib-login contrib-forks">Fork source · ' +
            repoLinks +
            "</div>" +
          "</div>"
        );
      })
      .join("");
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
      renderCollaborations(results[0]);
      setActive();
    })
    .catch(function () {
      ["featured-repos", "forked-repos", "papers-list"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<p class="repo-loading">Could not load data.</p>';
      });
    });
})();
