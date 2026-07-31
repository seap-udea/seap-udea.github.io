.PHONY: help sync-site start stop restart status

PORT ?= 8000
HOST ?= 127.0.0.1
SITE := _site
LOG  := .server.log

help:
	@echo "Local preview server for seap-udea.github.io"
	@echo ""
	@echo "  make sync-site  - Assemble public files into $(SITE)/"
	@echo "  make start      - Start http://$(HOST):$(PORT) (from $(SITE)/)"
	@echo "  make stop       - Stop the server on port $(PORT)"
	@echo "  make restart    - Restart the local server"
	@echo "  make status     - Show whether a server is listening on $(PORT)"
	@echo ""
	@echo "  PORT=3000 make start   - Use another port"

sync-site:
	@test -f index.html || { echo "index.html not found. Run from the repository root."; exit 1; }
	@rm -rf $(SITE)
	@mkdir -p $(SITE)
	@cp index.html $(SITE)/
	@cp -r css $(SITE)/css
	@cp -r js $(SITE)/js
	@touch $(SITE)/.nojekyll
	@echo "✓  Site ready in $(SITE)/"

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

status:
	@PID="$$(lsof -tiTCP:$(PORT) -sTCP:LISTEN 2>/dev/null | head -n 1)"; \
	if [ -n "$$PID" ]; then \
		echo "Server listening on http://$(HOST):$(PORT) (pid $$PID)"; \
	else \
		echo "No server listening on port $(PORT)."; \
	fi
