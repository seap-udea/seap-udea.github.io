#!/usr/bin/env bash
# sync_books.sh — publish book HTML into the assembled site.
#
# Usage:
#   ./bin/sync_books.sh [_site]
#
# Strategy (fast path first):
#   1. If ./books/<dest> already exists in this repo (vendored), copy it — no clone.
#   2. Else use .cache/books sparse checkouts. Skip git fetch when the cached
#      HEAD already matches the remote tip (resolved via GitHub API).
#
# Env:
#   FORCE_BOOKS=1   — always re-fetch remote books
#   SKIP_BOOKS=1    — do nothing (deploy without books)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_ROOT="${1:-$ROOT/_site}"
CACHE_ROOT="$ROOT/.cache/books"
VENDOR_ROOT="$ROOT/books"
FORCE_BOOKS="${FORCE_BOOKS:-0}"
SKIP_BOOKS="${SKIP_BOOKS:-0}"

# owner/repo|source_subdir|dest_path_under_site
BOOKS=(
  "seap-udea/Relatividad-Zuluaga|html|books/Relatividad-Zuluaga"
)

log() { echo "▶  $*"; }

remote_tip_sha() {
  local repo="$1"
  if command -v gh >/dev/null 2>&1; then
    gh api "repos/${repo}" --jq .default_branch 2>/dev/null \
      | xargs -I{} gh api "repos/${repo}/commits/{}" --jq .sha 2>/dev/null \
      && return 0
  fi
  # Fallback: no gh — force update path
  return 1
}

default_remote_branch() {
  local cache_dir="$1"
  local branch
  branch="$(git -C "$cache_dir" rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's#^origin/##' || true)"
  if [[ -n "$branch" ]]; then
    echo "$branch"
    return
  fi
  if git -C "$cache_dir" show-ref --verify --quiet refs/remotes/origin/master; then
    echo master
  else
    echo main
  fi
}

copy_tree() {
  local src="$1" dest="$2"
  rm -rf "$dest"
  mkdir -p "$(dirname "$dest")"
  cp -R "$src" "$dest"
  rm -f "$dest/.gitignore"
}

fetch_book() {
  local spec="$1"
  local repo src_subdir dest_rel
  IFS='|' read -r repo src_subdir dest_rel <<<"$spec"

  local vendor_dir="$VENDOR_ROOT/${dest_rel#books/}"
  local cache_dir="$CACHE_ROOT/${repo##*/}"
  local dest_dir="$DEST_ROOT/$dest_rel"
  local tip local_sha branch

  # 1) Vendored copy in this repo — no network
  if [[ "$FORCE_BOOKS" != "1" && -f "$vendor_dir/index.html" ]]; then
    log "Using vendored $dest_rel/ (no clone)"
    copy_tree "$vendor_dir" "$dest_dir"
    return 0
  fi

  mkdir -p "$CACHE_ROOT"

  tip="$(remote_tip_sha "$repo" || true)"
  local_sha=""
  if [[ -d "$cache_dir/.git" ]]; then
    local_sha="$(git -C "$cache_dir" rev-parse HEAD 2>/dev/null || true)"
  fi

  # 2) Warm cache already at remote tip — only copy
  if [[ "$FORCE_BOOKS" != "1" && -n "$tip" && -n "$local_sha" && "$tip" == "$local_sha" \
        && -f "$cache_dir/$src_subdir/index.html" ]]; then
    log "Cache up to date for $repo ($tip) — copy only"
    copy_tree "$cache_dir/$src_subdir" "$dest_dir"
    return 0
  fi

  # 3) Need network
  if [[ ! -d "$cache_dir/.git" ]]; then
    log "Sparse-cloning $repo ($src_subdir)..."
    rm -rf "$cache_dir"
    git clone --filter=blob:none --sparse --depth 1 \
      "https://github.com/${repo}.git" "$cache_dir"
    git -C "$cache_dir" sparse-checkout set "$src_subdir"
  else
    log "Updating $repo..."
    git -C "$cache_dir" fetch --depth 1 origin
    branch="$(default_remote_branch "$cache_dir")"
    git -C "$cache_dir" sparse-checkout set "$src_subdir"
    git -C "$cache_dir" checkout -q "origin/$branch"
    git -C "$cache_dir" reset --hard -q "origin/$branch"
  fi

  if [[ ! -f "$cache_dir/$src_subdir/index.html" ]]; then
    echo "error: missing $cache_dir/$src_subdir/index.html" >&2
    return 1
  fi

  log "Copying -> $dest_rel/"
  copy_tree "$cache_dir/$src_subdir" "$dest_dir"
}

main() {
  if [[ "$SKIP_BOOKS" == "1" ]]; then
    log "SKIP_BOOKS=1 — not publishing books"
    return 0
  fi

  mkdir -p "$DEST_ROOT"
  local book dest_rel
  for book in "${BOOKS[@]}"; do
    fetch_book "$book"
  done
  log "Books ready under $DEST_ROOT"
  for book in "${BOOKS[@]}"; do
    IFS='|' read -r _ _ dest_rel <<<"$book"
    echo "   Book:  ${DEST_ROOT#$ROOT/}/$dest_rel/"
  done
}

main "$@"
