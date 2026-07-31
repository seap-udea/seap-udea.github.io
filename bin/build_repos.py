#!/usr/bin/env python3
"""Build repos.json (and papers.json) from the seap-udea GitHub account."""

from __future__ import annotations

import html as html_lib
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "repos.json"
PAPERS_OUT = ROOT / "papers.json"

# Private repos are not always returned by the list endpoint.
EXTRA_REPOS = ["Argus", "AreciboWow", "pympact"]

# Known PyPI project names when they differ from the GitHub repo name.
PYPI_NAMES = {
    "pryngles": "pryngles",
    "pymcel": "pymcel",
    "fargopy": "fargopy",
    "multimin": "multimin",
    "MontuPython": "montu",
    "MultiREx-public": "MultiREx",
}

# Papers + software citations curated from repo READMEs (also written to papers.json).
PAPERS = json.loads((ROOT / "papers.json").read_text(encoding="utf-8")) if (ROOT / "papers.json").exists() else []


def gh_api(path: str):
    r = subprocess.run(["gh", "api", path], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"gh api {path}: {r.stderr.strip()}")
    return json.loads(r.stdout) if r.stdout.strip() else None


def gh_api_raw(path: str) -> str | None:
    r = subprocess.run(
        ["gh", "api", path, "-H", "Accept: application/vnd.github.raw"],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        return None
    return r.stdout


def strip_to_prose(text: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", text)
    text = re.sub(r"(?is)<!--.*?-->", " ", text)
    text = re.sub(r"(?is)<(img|br|hr|meta|link)[^>]*/?>", " ", text)
    text = re.sub(
        r"(?is)</?(p|div|span|h[1-6]|center|strong|em|b|i|a|ul|ol|li|table|tr|td|th|pre|code)[^>]*>",
        " ",
        text,
    )
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = html_lib.unescape(text)
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"`[^`]*`", " ", text)
    text = re.sub(r"!\[.*?\]\(.*?\)", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"^#+\s*", "", text, flags=re.M)
    text = re.sub(r"^={3,}\s*$", "", text, flags=re.M)
    text = re.sub(r"^-{3,}\s*$", "", text, flags=re.M)
    text = re.sub(r"[*_~|]+", " ", text)
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" .-:;,\n\t")
    return text


def abstract_from_readme(name: str, fallback: str) -> str:
    raw = gh_api_raw(f"repos/seap-udea/{name}/readme")
    candidates: list[str] = []
    if raw:
        for block in re.split(r"\n\s*\n", raw):
            prose = strip_to_prose(block)
            if len(prose.split()) < 8:
                continue
            lower = prose.lower()
            if "badge" in lower or "shields.io" in lower:
                continue
            candidates.append(prose)
    text = " ".join(candidates) if candidates else strip_to_prose(fallback or "")
    if not text:
        text = strip_to_prose(fallback or name)
    words = text.split()
    if len(words) <= 50:
        return " ".join(words)
    clipped = " ".join(words[:50]).rstrip(",.;:")
    if not clipped.endswith("."):
        clipped += "."
    return clipped


def last_commit_date(name: str, fallback: str | None) -> str | None:
    try:
        commits = gh_api(f"repos/seap-udea/{name}/commits?per_page=1")
        if commits:
            return commits[0]["commit"]["committer"]["date"][:10]
    except Exception as exc:  # noqa: BLE001
        print(f"  ! commit date {name}: {exc}", file=sys.stderr)
    return (fallback or "")[:10] or None


def pypi_url(name: str, repo_type: str | None) -> str | None:
    if repo_type and repo_type != "package":
        return None
    project = PYPI_NAMES.get(name, name.lower())
    url = f"https://pypi.org/pypi/{project}/json"
    try:
        with urllib.request.urlopen(url, timeout=20) as resp:
            if resp.status != 200:
                return None
            data = json.load(resp)
            return data.get("info", {}).get("package_url") or f"https://pypi.org/project/{project}/"
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None


def fetch_listed_repos() -> list[dict]:
    repos: list[dict] = []
    page = 1
    while True:
        batch = gh_api(f"users/seap-udea/repos?per_page=100&page={page}&type=all")
        if not batch:
            break
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return repos


def load_existing_list() -> list[dict]:
    if not OUT.exists():
        return []
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return []


def normalize_repo(r: dict, existing: dict[str, dict]) -> dict:
    name = r["name"]
    prev = existing.get(name, {})
    desc = r.get("description") or prev.get("description") or ""
    featured = bool(prev.get("featured", False))
    hidden = bool(prev.get("hidden", False))
    repo_type = prev.get("type")
    fork = bool(r.get("fork"))
    parent = None
    if fork:
        try:
            detail = gh_api(f"repos/seap-udea/{name}")
            parent = ((detail or {}).get("parent") or {}).get("full_name")
        except Exception as exc:  # noqa: BLE001
            print(f"  ! parent {name}: {exc}", file=sys.stderr)

    abstract = prev.get("abstract") or ""
    if not abstract or (not featured and len(str(abstract).split()) < 5):
        abstract = abstract_from_readme(name, desc)

    entry = {
        "name": name,
        "url": r.get("html_url") or f"https://github.com/seap-udea/{name}",
        "description": desc,
        "stars": r.get("stargazers_count", prev.get("stars", 0)),
        "last_commit": last_commit_date(name, r.get("pushed_at")) or prev.get("last_commit"),
        "abstract": abstract,
        "featured": featured,
        "hidden": hidden,
        "fork": fork,
        "private": bool(r.get("private")),
        "archived": bool(r.get("archived")),
        "parent": parent,
        "type": repo_type,
        "pypi": None,
        "topics": r.get("topics") or prev.get("topics") or [],
    }

    wants_pypi = repo_type == "package" or name in PYPI_NAMES or bool(prev.get("pypi"))
    if wants_pypi:
        entry["pypi"] = pypi_url(name, repo_type or "package") or prev.get("pypi")

    return entry


def main() -> None:
    prev_list = load_existing_list()
    existing = {r["name"]: r for r in prev_list}
    listed = fetch_listed_repos()
    by_name = {r["name"]: r for r in listed}

    for name in EXTRA_REPOS:
        if name not in by_name:
            try:
                by_name[name] = gh_api(f"repos/seap-udea/{name}")
                print(f"+ extra private/public repo: {name}")
            except Exception as exc:  # noqa: BLE001
                print(f"! could not fetch extra {name}: {exc}", file=sys.stderr)

    featured_order = [r["name"] for r in prev_list if r.get("featured") and r["name"] in by_name]

    ordered: list[str] = list(featured_order)
    for name in sorted(by_name):
        if name in ordered:
            continue
        if not by_name[name].get("fork"):
            ordered.append(name)
    for name in sorted(by_name):
        if name in ordered:
            continue
        ordered.append(name)

    out: list[dict] = []
    for i, name in enumerate(ordered, 1):
        r = by_name[name]
        print(
            f"[{i}/{len(ordered)}] {name} fork={r.get('fork')} "
            f"private={r.get('private')} featured={existing.get(name, {}).get('featured', False)} "
            f"hidden={existing.get(name, {}).get('hidden', False)}"
        )
        out.append(normalize_repo(r, existing))

    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    # Preserve curated papers.json (source of truth); only rewrite if empty.
    if PAPERS:
        PAPERS_OUT.write_text(json.dumps(PAPERS, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    featured = [x for x in out if x["featured"] and not x.get("hidden")]
    forks = [x for x in out if x["fork"] and not x.get("hidden")]
    print(f"Wrote {OUT}: {len(out)} repos ({len(featured)} featured, {len(forks)} forks visible)")
    print(f"Papers file: {PAPERS_OUT} ({len(PAPERS)} entries)")
    for x in featured:
        print(f"  ★ {x['name']} type={x.get('type')} pypi={x.get('pypi')}")
    for x in forks:
        print(f"  ↳ {x['name']} <- {x.get('parent')} type={x.get('type')}")


if __name__ == "__main__":
    main()
