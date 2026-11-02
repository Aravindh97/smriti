#!/usr/bin/env bash
# Builds the live demo into DIR: the Go code compiled to WebAssembly plus
# the static frontend. Run from the repo root: ./web/build.sh dist
set -euo pipefail
out=${1:-dist}
mkdir -p "$out"
# optional: web/prebuild.sh prepares embedded data for cmd/web
[ -x web/prebuild.sh ] && ./web/prebuild.sh
GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o "$out/app.wasm" ./cmd/web
install -m 644 "$(go env GOROOT)/lib/wasm/wasm_exec.js" "$out/wasm_exec.js"
cp web/*.html web/*.js web/*.css "$out/"
touch "$out/.nojekyll"
echo "built $out ($(du -sh "$out/app.wasm" | cut -f1) wasm)"
