#!/usr/bin/env bash
# Regenerate the map tiles in public/tiles/ from a Protomaps daily planet build:
#   friesland.pmtiles     street-level detail (z0-13) for the province
#   surroundings.pmtiles  low-detail context (z0-10) for the wider area around it
# The map only zooms in past z10 over the province itself (see src/main.ts),
# so the surroundings never need more detail than that.
#
# Usage:
#   npm run tiles                 # uses the default build date below
#   npm run tiles -- 20261005     # uses a specific build (YYYYMMDD)
#   bash scripts/tiles.sh 20261005
#
# Available builds: https://maps.protomaps.com/builds/
# (machine-readable index: https://build-metadata.protomaps.dev/builds.json)
#
# The planet build must use the Protomaps tiles v4 schema (build "version" 4.x),
# which matches @protomaps/basemaps v4/v5.
set -euo pipefail

DEFAULT_BUILD="20260928" # tiles schema 4.15.2
BUILD="${1:-$DEFAULT_BUILD}"

# Covers all of Fryslân incl. Vlieland (~4.85°E) and Schiermonnikoog (~6.35°E), with a margin.
# z14 over this bbox is ~101 MB; z13 is ~52 MB. MapLibre overzooms beyond z13.
DETAIL_BBOX="4.60,52.60,6.60,53.65"
DETAIL_MAXZOOM=13
# What the zoomed-out overview can show around the province, from tall phones (north-south)
# to 32:9 monitors (east-west). ~19 MB.
SURROUNDINGS_BBOX="3.20,51.80,8.10,54.50"
SURROUNDINGS_MAXZOOM=10

if ! [[ "$BUILD" =~ ^[0-9]{8}$ ]]; then
  echo "error: build date must be YYYYMMDD, got '$BUILD'" >&2
  exit 1
fi

if ! command -v pmtiles >/dev/null 2>&1; then
  cat >&2 <<'EOF'
error: the 'pmtiles' CLI is not installed.
  macOS:  brew install pmtiles
  other:  https://github.com/protomaps/go-pmtiles/releases
EOF
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/public/tiles"
SRC="https://build.protomaps.com/${BUILD}.pmtiles"
TMP=""

mkdir -p "$OUT_DIR"
trap 'rm -f "$TMP"' EXIT

extract() { # name bbox maxzoom
  local out="$OUT_DIR/$1.pmtiles"
  TMP="$OUT_DIR/.$1.pmtiles.tmp"
  echo "Extracting $SRC"
  echo "  bbox=$2 maxzoom=$3 -> ${out#"$ROOT"/}"
  pmtiles extract "$SRC" "$TMP" --bbox="$2" --maxzoom="$3"
  mv "$TMP" "$out"
  pmtiles show "$out" | grep -E '^(bounds|min zoom|max zoom)'
  ls -lh "$out" | awk '{print "  size: " $5}'
  echo
}

extract friesland "$DETAIL_BBOX" "$DETAIL_MAXZOOM"
extract surroundings "$SURROUNDINGS_BBOX" "$SURROUNDINGS_MAXZOOM"
