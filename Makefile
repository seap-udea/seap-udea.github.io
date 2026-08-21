.PHONY: help repos build-apps sync-books sync-site start stop restart status cleanall worker-deploy

PORT ?= 8000
HOST ?= 127.0.0.1
SITE := _site
LOG  := .server.log

help:
	@echo "Local preview server for seap-udea.github.io"
	@echo ""
	@echo "  make repos         - Refresh repos.json + papers.json from GitHub"
	@echo "  make build-apps    - Build Next.js apps under apps/"
	@echo "  make sync-books    - Fetch book HTML (e.g. Relatividad) into $(SITE)/books/"
	@echo "  make sync-site     - Assemble public files into $(SITE)/"
	@echo "  make start         - Build apps (if needed), assemble $(SITE)/, start server"
	@echo "  make stop          - Stop the server on port $(PORT)"
	@echo "  make restart       - Restart the local server"
	@echo "  make status        - Show whether a server is listening on $(PORT)"
	@echo "  make worker-deploy - Deploy analytics Cloudflare Worker"
	@echo "  make cleanall      - Remove local build artifacts (node_modules, .next, out, _site, logs)"
	@echo ""
	@echo "  Gallery previews (run inside a target repo):"
	@echo "    ./bin/seap-udea-gallery.sh /path/to/repo"
	@echo ""
	@echo "  PORT=3000 make start   - Use another port"

repos:
	@python3 bin/build_repos.py

build-apps:
	@echo "▶  Building Lighting Black Holes…"
	@cd apps/lighting-black-holes && npm ci && npm run build
	@echo "▶  Building Cloud Academy…"
	@cd apps/cloud_academy && npm ci --legacy-peer-deps && npm run build
	@echo "▶  Building Drake Calculator…"
	@cd apps/drake-calculator && npm ci && npm run build
	@echo "✓  Apps built"

sync-site:
	@test -f index.html || { echo "index.html not found. Run from the repository root."; exit 1; }
	@test -f repos.json || { echo "repos.json missing. Run: make repos"; exit 1; }
	@test -f papers.json || { echo "papers.json missing. Run: make repos"; exit 1; }
	@missing=0; \
	test -f apps/lighting-black-holes/out/index.html || missing=1; \
	test -f apps/cloud_academy/out/index.html || missing=1; \
	test -f apps/drake-calculator/out/index.html || missing=1; \
	if [ "$$missing" = 1 ]; then $(MAKE) build-apps; fi
	@rm -rf $(SITE)
	@mkdir -p $(SITE)/apps
	@cp index.html $(SITE)/
	@cp stats.html $(SITE)/
	@cp repos.json $(SITE)/
	@cp papers.json $(SITE)/
	@cp -r css $(SITE)/css
	@cp -r js $(SITE)/js
	@cp -r assets $(SITE)/assets
	@cp -r gallery $(SITE)/gallery
	@rm -rf $(SITE)/analytics && cp -r analytics $(SITE)/analytics
	@cp -r apps/lighting-black-holes/out $(SITE)/apps/lighting-black-holes
	@cp -r apps/cloud_academy/out $(SITE)/apps/cloud_academy
	@cp -r apps/drake-calculator/out $(SITE)/apps/drake-calculator
	@$(MAKE) sync-books
	@touch $(SITE)/.nojekyll
	@echo "✓  Site ready in $(SITE)/"
	@echo "   Apps: http://$(HOST):$(PORT)/apps/lighting-black-holes/"
	@echo "         http://$(HOST):$(PORT)/apps/cloud_academy/"
	@echo "         http://$(HOST):$(PORT)/apps/drake-calculator/"
	@echo "   Book:  http://$(HOST):$(PORT)/books/Relatividad-Zuluaga/"
	@echo "   Gallery: http://$(HOST):$(PORT)/gallery/?repo=PRisma"
	@echo "   Stats:   http://$(HOST):$(PORT)/stats.html"

sync-books:
	@./bin/sync_books.sh $(SITE)

start: sync-site
	@if lsof -tiTCP:$(PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "A process is already listening on $(PORT)."; \
		echo "Stop it with: make stop"; \
		exit 1; \
	fi
	@echo "Starting server on http://$(HOST):$(PORT)"
	@rm -f $(LOG)
	@cd $(SITE) && nohup python3 -m http.server "$(PORT)" --bind "$(HOST)" >../$(LOG) 2>&1 & echo $$! > ../.server.pid
	@sleep 0.4
	@if lsof -tiTCP:$(PORT) -sTCP:LISTEN >/dev/null 2>&1; then \
		echo "Started. Stop with: make stop"; \
		echo "  Home: http://$(HOST):$(PORT)/"; \
		echo "  App:  http://$(HOST):$(PORT)/apps/lighting-black-holes/"; \
		echo "  App:  http://$(HOST):$(PORT)/apps/cloud_academy/"; \
		echo "  App:  http://$(HOST):$(PORT)/apps/drake-calculator/"; \
		echo "  Book:  http://$(HOST):$(PORT)/books/Relatividad-Zuluaga/"; \
		echo "  Gallery: http://$(HOST):$(PORT)/gallery/?repo=PRisma"; \
		echo "  Stats:   http://$(HOST):$(PORT)/stats.html"; \
	else \
		echo "Failed to start server on port $(PORT)."; \
		[ -f $(LOG) ] && cat $(LOG); \
		rm -f .server.pid; \
		exit 1; \
	fi

stop:
	@echo "Stopping server on port $(PORT) (best-effort)"
	@PID="$$(lsof -tiTCP:$(PORT) -sTCP:LISTEN 2>/dev/null | head -n 1)"; \
	if [ -n "$$PID" ]; then \
		echo "Killing pid $$PID"; \
		kill "$$PID" 2>/dev/null || true; \
		sleep 0.2; \
		if kill -0 "$$PID" 2>/dev/null; then \
			echo "Still running, forcing stop (SIGKILL)"; \
			kill -9 "$$PID" 2>/dev/null || true; \
		fi; \
	else \
		echo "No process listening on $(PORT)."; \
	fi
	@rm -f .server.pid

restart: stop start

worker-deploy:
	@echo "▶  Deploying analytics worker…"
	@cd analytics/worker && npx wrangler deploy

status:
	@PID="$$(lsof -tiTCP:$(PORT) -sTCP:LISTEN 2>/dev/null | head -n 1)"; \
	if [ -n "$$PID" ]; then \
		echo "Server listening on http://$(HOST):$(PORT) (pid $$PID)"; \
	else \
		echo "No server listening on port $(PORT)."; \
	fi

cleanall: _dev_cleanall stop
	@echo "▶  Cleaning local build artifacts…"
	@rm -rf $(SITE)
	@rm -rf .cache/books
	@rm -f $(LOG) .server.pid
	@find apps -mindepth 1 -maxdepth 2 \( \
		-name node_modules -o \
		-name .next -o \
		-name out -o \
		-name .turbo -o \
		-name dist -o \
		-name build -o \
		-name .vercel -o \
		-name coverage \
	\) -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@find apps -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true
	@find . -name .DS_Store -type f -delete 2>/dev/null || true
	@echo "✓  Removed $(SITE)/, app node_modules/.next/out, server logs"
	@echo "   (context/ and source files were left untouched)"
# --- dev/cleanall (auto) ---
include .dev_common.mk
