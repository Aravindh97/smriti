#!/usr/bin/env bash
# Builds the live demo into DIR (default dist): the Go code compiled to
# WebAssembly plus the React frontend. Run from the repo root.
set -euo pipefail
out=$(realpath -m "${1:-dist}")
# optional: web/prebuild.sh prepares embedded data for cmd/web
[ -x web/prebuild.sh ] && ./web/prebuild.sh
mkdir -p web/public
GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o web/public/app.wasm ./cmd/web
install -m 644 "$(go env GOROOT)/lib/wasm/wasm_exec.js" web/public/wasm_exec.js
cd web
[ -d node_modules ] || npm ci --no-audit --no-fund --loglevel=error
npx tsc --noEmit
npx vite build --outDir "$out" --emptyOutDir --logLevel warn
touch "$out/.nojekyll"
echo "built $out ($(du -sh "$out/app.wasm" | cut -f1) wasm)"
