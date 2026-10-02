#!/usr/bin/env sh
# Serve the project workspace locally at http://localhost:8000
cd "$(dirname "$0")/../site" && exec python3 -m http.server "${PORT:-8000}"
