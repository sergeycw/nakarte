#!/bin/sh
# Синтетическая проверка своих сервисов клона на проде: сайт, новое приложение /next/, файлы движка, тайл BRouter,
# API и тайлы высот, хранилище треков, CORS-прокси. Только чтение, без сети к чужим сайтам:
# прокси проверяется preflight'ом, хранилище треков — чтением несуществующего ключа (404 из R2).
# Запускают workflow «prod check» (раз в день и после деплоя) и человек: sh scripts/prod-check.sh
set -u

SITE=${SITE:-https://nakarte-routing.pages.dev}
ELEVATION=${ELEVATION:-https://nakarte-elevation.nakarte-routing.workers.dev}
TRACKS=${TRACKS:-https://nakarte-tracks.nakarte-routing.workers.dev}
PROXY=${PROXY:-https://nakarte-cors-proxy.nakarte-routing.workers.dev}
# Тбилиси: тестовый район из AGENTS.md; тайлы высот z11 (на лету) и z5 (из архива) над ним
POINT='41.687 44.776'
TILE_LIVE=11/1278/762
TILE_ARCHIVE=5/19/11

failed=0
headers=$(mktemp)
body=$(mktemp)
trap 'rm -f "$headers" "$body"' EXIT

# fetch <curl args...>: статус в stdout, заголовки и тело — во временные файлы
fetch() {
    curl -sS --retry 2 --retry-all-errors --max-time 30 -D "$headers" -o "$body" -w '%{http_code}' "$@"
}

header() {
    grep -i "^$1:" "$headers" | head -1 | cut -d' ' -f2- | tr -d '\r'
}

report() {
    if [ "$2" = ok ]; then
        echo "ok    $1"
    else
        echo "FAIL  $1: $2"
        failed=1
    fi
}

check_range() {
    status=$(fetch -r 0-0 "$2")
    if [ "$status" = 206 ] && [ -n "$(header content-range)" ]; then report "$1" ok; else report "$1" "status $status"; fi
}

status=$(fetch "$SITE/")
if [ "$status" = 200 ] && grep -q '<title>' "$body"; then report 'site' ok; else report 'site' "status $status"; fi

# новое приложение web/ (openspec/specs/web-client): заголовок из web/index.html. Одного статуса мало —
# без build/next/ Pages отвечают на /next/ корневым index.html старого клиента с кодом 200
status=$(fetch "$SITE/next/")
if [ "$status" = 200 ] && grep -q '<title>nakarte routing</title>' "$body"; then
    report 'site next' ok
else
    report 'site next' "status $status, title $(grep -o '<title>[^<]*' "$body" | head -1 | cut -c8-)"
fi

check_range 'engine jar' "$SITE/brouter-wasm/lib/brouter.jar"
check_range 'engine lookups.dat' "$SITE/brouter-wasm/profiles/lookups.dat"
check_range 'brouter tile' "$SITE/tiles/E40_N40.rd5"

status=$(fetch -H "Origin: $SITE" --data-binary "$POINT
" "$ELEVATION/")
if [ "$status" = 200 ] && grep -qE '^-?[0-9]+\.[0-9]{2}$' "$body"; then
    report 'elevation api' ok
else
    report 'elevation api' "status $status, body $(head -c 80 "$body")"
fi

for tile in "$TILE_LIVE" "$TILE_ARCHIVE"; do
    status=$(fetch "$ELEVATION/tiles/$tile")
    if [ "$status" = 200 ] && [ "$(header content-type)" = application/octet-stream ]; then
        report "elevation tile $tile" ok
    else
        report "elevation tile $tile" "status $status"
    fi
done

status=$(fetch -H "Origin: $SITE" "$TRACKS/track/AAAAAAAAAAAAAAAAAAAAAA")
if [ "$status" = 404 ] && grep -q 'Track not found' "$body"; then report 'tracks' ok; else report 'tracks' "status $status"; fi

status=$(fetch -X OPTIONS -H "Origin: $SITE" -H 'Access-Control-Request-Method: GET' "$PROXY/https/example.com/")
if [ "$status" = 204 ] && [ "$(header access-control-allow-origin)" = "$SITE" ]; then
    report 'cors proxy' ok
else
    report 'cors proxy' "status $status"
fi

exit "$failed"
