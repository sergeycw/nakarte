#!/usr/bin/env bash
# Архив тайлов высот z0–9 (`elevation-tiles build`) → R2, ключ `tiles/elevation-z0-9`.
#
#   DATA=/path/with/dem3 scripts/elevation-tiles.sh                  # локальные градусы → локальный R2
#   DATA=/path/with/dem3 BBOX=40,41,47,45 scripts/elevation-tiles.sh # только блоки z5, задевающие область
#   R2_MODE=--remote scripts/elevation-tiles.sh                      # весь `dem3/` из бакета → бакет
#
# Запускать из workers/elevation после `cargo build --release -p elevation-tiles`.
# По умолчанию (R2_MODE=--local) берёт градусы из $DATA/dem3 и кладёт архив в локальный R2 wrangler
# для `wrangler dev`. R2_MODE=--remote скачивает весь `dem3/` через S3 API R2 (13.1 ГБ, нужен
# свободный диск) и заливает архив туда же: нужны R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (токен R2 с
# Object Read & Write на бакет, тот же, что у elevation-data.sh) и R2_ENDPOINT.
#
# Подвохи:
# - кеш изолята Worker держит страницы индекса: после перезаливки архива Worker передеплоить;
# - архив пишется целиком на диск (весь мир ≈ 3.5 ГБ) и уходит одним объектом: aws CLI сам режет
#   его на части одного размера, как требует составная загрузка R2.
set -euo pipefail

BUCKET="${BUCKET:-nakarte-elevation}"
R2_MODE="${R2_MODE:---local}"
KEY="tiles/elevation-z0-9"
TILES="${TILES:-$PWD/target/release/elevation-tiles}"
BBOX="${BBOX:-}"

work=$(mktemp -d "${WORK_DIR:-${TMPDIR:-/tmp}}/elevation-tiles.XXXXXX")
trap 'rm -rf "$work"' EXIT
started=$(date +%s)

if [ "$R2_MODE" = --remote ]; then
    # ключи из секретов GitHub часто приходят с переводом строки после копирования из дашборда
    AWS_ACCESS_KEY_ID=$(printf '%s' "$R2_ACCESS_KEY_ID" | tr -d '[:space:]')
    AWS_SECRET_ACCESS_KEY=$(printf '%s' "$R2_SECRET_ACCESS_KEY" | tr -d '[:space:]')
    export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
    export AWS_DEFAULT_REGION=auto AWS_CONFIG_FILE="$work/aws-config"
    printf '[default]\ns3 =\n  max_concurrent_requests = 32\n' >"$AWS_CONFIG_FILE"
    DATA="$work/data"
    mkdir -p "$DATA/dem3"
    aws s3 sync "s3://$BUCKET/dem3/" "$DATA/dem3/" --endpoint-url "$R2_ENDPOINT" --only-show-errors
    echo "downloaded $(find "$DATA/dem3" -type f | wc -l) degrees, $(du -sh "$DATA/dem3" | cut -f1), $(($(date +%s) - started)) s"
else
    if [ -z "${DATA:-}" ] || [ ! -d "$DATA/dem3" ]; then
        sed -n '2,18p' "$0"
        exit 2
    fi
fi

built=$(date +%s)
args=(build --data "$DATA" --out "$work/archive")
if [ -n "$BBOX" ]; then
    args+=(--bbox "$BBOX")
fi
"$TILES" "${args[@]}" | tee "$work/report.txt"
size=$(wc -c <"$work/archive" | tr -d ' ')
echo "archive $size bytes, built in $(($(date +%s) - built)) s"

if [ "$R2_MODE" = --remote ]; then
    # исходные градусы больше не нужны, а диск раннера впритык
    rm -rf "$DATA"
    aws s3 cp "$work/archive" "s3://$BUCKET/$KEY" --endpoint-url "$R2_ENDPOINT" \
        --content-type application/octet-stream --only-show-errors
else
    npx --yes wrangler@4 r2 object put "$BUCKET/$KEY" --file "$work/archive" \
        --content-type application/octet-stream --local >/dev/null
fi

summary="$(tail -1 "$work/report.txt"); archive $size bytes; total $(($(date +%s) - started)) s"
echo "$summary"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    { echo '```'; cat "$work/report.txt"; echo '```'; echo "$summary"; } >>"$GITHUB_STEP_SUMMARY"
fi
