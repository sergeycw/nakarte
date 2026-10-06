#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://brouter.de/brouter/segments4"
DIR="$(cd "$(dirname "$0")/.." && pwd)/brouter/segments4"
CONTAINER="nakarte-brouter"

usage() {
    cat <<USAGE
Usage:
  $(basename "$0") TILE...                               download tiles, e.g. E40_N40 E45_N40
  $(basename "$0") --bbox MIN_LON MIN_LAT MAX_LON MAX_LAT  download all tiles covering the box
  $(basename "$0") --world                               download the whole planet (~10 GB)
  $(basename "$0") --update                              refresh tiles that are already downloaded
  $(basename "$0") --list                                show downloaded tiles

Tiles are 5x5 degrees, named after the south-west corner.
USAGE
}

bbox_tiles() {
    awk -v min_lon="$1" -v min_lat="$2" -v max_lon="$3" -v max_lat="$4" '
        function floor5(v,  f) { f = int(v / 5); if (f * 5 > v) f--; return f * 5 }
        function name(lon, lat) {
            return (lon < 0 ? "W" (-lon) : "E" lon) "_" (lat < 0 ? "S" (-lat) : "N" lat)
        }
        BEGIN {
            for (lon = floor5(min_lon); lon < max_lon && lon < 180; lon += 5)
                for (lat = floor5(min_lat); lat < max_lat && lat < 90; lat += 5)
                    print name(lon, lat)
        }'
}

world_tiles() {
    curl -fsS "$BASE_URL/" | grep -oE 'href="[EW][0-9]+_[NS][0-9]+\.rd5"' | sed -E 's/href="(.*)\.rd5"/\1/'
}

local_tiles() {
    find "$DIR" -name '*.rd5' -exec basename {} .rd5 \; | sort
}

UPDATED=0

download() {
    local tile=$1 file="$DIR/$1.rd5" part="$DIR/$1.rd5.part" code
    local args=(-sS -o "$part" -w '%{http_code}')
    if [[ -f "$file" ]]; then
        args+=(-z "$file")
    fi
    code=$(curl "${args[@]}" "$BASE_URL/$tile.rd5") || code=000
    case "$code" in
        200)
            mv "$part" "$file"
            UPDATED=1
            echo "$tile: downloaded ($(du -h "$file" | cut -f1))"
            ;;
        304)
            rm -f "$part"
            echo "$tile: up to date"
            ;;
        404)
            rm -f "$part"
            echo "$tile: no data (ocean or outside coverage)"
            ;;
        *)
            rm -f "$part"
            echo "$tile: failed, HTTP $code" >&2
            ;;
    esac
}

mkdir -p "$DIR"

case "${1:-}" in
    ""|-h|--help)
        usage
        exit 0
        ;;
    --list)
        local_tiles
        exit 0
        ;;
    --bbox)
        [[ $# -eq 5 ]] || { usage; exit 1; }
        tiles=$(bbox_tiles "$2" "$3" "$4" "$5")
        ;;
    --world)
        tiles=$(world_tiles)
        ;;
    --update)
        tiles=$(local_tiles)
        ;;
    *)
        tiles="$*"
        ;;
esac

for tile in $tiles; do
    download "$tile"
done

if (( UPDATED )) && docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    docker restart "$CONTAINER" > /dev/null
    echo "restarted $CONTAINER"
fi
